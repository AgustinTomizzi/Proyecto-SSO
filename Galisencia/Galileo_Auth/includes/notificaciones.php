<?php

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/config.php";

/*
 * Notificaciones por email. El backend solo encola (tabla notificaciones); el
 * envío lo hace cli/enviar_notificaciones.php por SMTP. Encolar nunca rompe la
 * operación que lo dispara: si falla, se registra en el log y se sigue.
 */

/** Tipos de notificación que el usuario puede apagar. */
function notif_tipos()
{
    return [
        "reserva_creada" => "Reserva creada",
        "reserva_modificada" => "Reserva modificada",
        "reserva_cancelada" => "Reserva cancelada",
        "reserva_recordatorio" => "Recordatorio antes de una reserva",
    ];
}

function notif_fecha_texto($fecha)
{
    $d = DateTime::createFromFormat("!Y-m-d", (string) $fecha);
    return $d ? $d->format("d/m/Y") : (string) $fecha;
}

/** Asunto y cuerpo (texto plano) de cada plantilla. */
function notif_plantilla($tipo, array $d)
{
    $detalle = "Recurso: {$d["recurso"]}\n"
        . "Fecha: " . notif_fecha_texto($d["fecha"]) . "\n"
        . "Horario: " . substr($d["inicio"], 0, 5) . " a " . substr($d["fin"], 0, 5) . "\n"
        . "Cantidad: {$d["cantidad"]}\n";
    $pie = "\nPodés ver y administrar tus reservas en Galiservas.\n"
        . "Para dejar de recibir este aviso, desactivalo en Galiservas > Notificaciones.\n";
    switch ($tipo) {
        case "reserva_creada":
            return ["Reserva confirmada: {$d["recurso"]} el " . notif_fecha_texto($d["fecha"]), "Hola {$d["nombre"]}:\n\nTu reserva quedó confirmada.\n\n$detalle$pie"];
        case "reserva_modificada":
            return ["Reserva modificada: {$d["recurso"]} el " . notif_fecha_texto($d["fecha"]), "Hola {$d["nombre"]}:\n\nTu reserva cambió. Así queda:\n\n$detalle$pie"];
        case "reserva_cancelada":
            return ["Reserva cancelada: {$d["recurso"]} el " . notif_fecha_texto($d["fecha"]), "Hola {$d["nombre"]}:\n\nTu reserva fue cancelada.\n\n$detalle$pie"];
        case "reserva_recordatorio":
            return ["Recordatorio: {$d["recurso"]} el " . notif_fecha_texto($d["fecha"]) . " a las " . substr($d["inicio"], 0, 5), "Hola {$d["nombre"]}:\n\nTe recordamos tu reserva.\n\n$detalle$pie"];
    }
    throw new InvalidArgumentException("plantilla desconocida: $tipo");
}

function notif_habilitada($usuarioId, $tipo)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT habilitada FROM notificacion_preferencias WHERE usuario_id = ? AND tipo = ?");
    $stmt->execute([$usuarioId, $tipo]);
    $valor = $stmt->fetchColumn();
    return $valor === false || (int) $valor === 1;
}

/**
 * Datos de una reserva para las plantillas, con el email y nombre del usuario.
 */
function notif_datos_reserva($reservaId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT rv.id_reservation, rv.user_id, rv.reservation_date AS fecha, rv.start_time AS inicio, rv.end_time AS fin, rv.quantity AS cantidad, rv.status, r.name AS recurso, u.email, u.nombre FROM reservations rv JOIN resources r ON r.id_resource = rv.resource_id JOIN usuarios u ON u.id_usuario = rv.user_id WHERE rv.id_reservation = ?");
    $stmt->execute([$reservaId]);
    return $stmt->fetch() ?: null;
}

/** Inserta en la cola si el usuario no apagó el tipo. Devuelve el id o null. */
function notif_encolar($usuarioId, $tipo, $destinatario, array $datos, $programadaPara = null, $referencia = null)
{
    global $pdo;
    if (!notif_habilitada($usuarioId, $tipo) || !filter_var($destinatario, FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    [$asunto, $cuerpo] = notif_plantilla($tipo, $datos);
    $stmt = $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, destinatario, asunto, cuerpo, referencia, programada_para) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))");
    $stmt->execute([$usuarioId, $tipo, $destinatario, mb_substr($asunto, 0, 200), $cuerpo, $referencia, $programadaPara]);
    return (int) $pdo->lastInsertId();
}

/**
 * Avisa el evento de una reserva ("creada", "modificada", "cancelada" o null
 * para no avisar) y deja programado (o quita) su recordatorio. No lanza
 * excepciones.
 */
function notif_reserva($reservaId, $evento)
{
    global $pdo;
    try {
        $d = notif_datos_reserva($reservaId);
        if (!$d) {
            return;
        }
        $datos = ["nombre" => $d["nombre"], "recurso" => $d["recurso"], "fecha" => $d["fecha"], "inicio" => $d["inicio"], "fin" => $d["fin"], "cantidad" => $d["cantidad"]];
        if ($evento !== null) {
            notif_encolar((int) $d["user_id"], "reserva_$evento", $d["email"], $datos);
        }

        // Un solo recordatorio pendiente por reserva: se reemplaza en cada cambio.
        $referencia = "reserva:$reservaId:recordatorio";
        $pdo->prepare("DELETE FROM notificaciones WHERE referencia = ? AND estado = 'pendiente'")->execute([$referencia]);
        $horas = (int) (config_institucion()["notificaciones.recordatorio_horas"] ?? 0);
        if ($evento === "cancelada" || !in_array($d["status"], ["pendiente", "confirmada"], true) || $horas <= 0) {
            return;
        }
        $inicio = new DateTimeImmutable("{$d["fecha"]} " . substr($d["inicio"], 0, 5));
        $cuando = $inicio->modify("-$horas hours");
        if ($cuando <= new DateTimeImmutable()) {
            return;
        }
        // El worker libera la referencia al enviar, así que acá solo puede haber pendientes (ya borrados).
        notif_encolar((int) $d["user_id"], "reserva_recordatorio", $d["email"], $datos, $cuando->format("Y-m-d H:i:s"), $referencia);
    } catch (Throwable $e) {
        error_log("notificaciones: no se pudo encolar ($evento, reserva $reservaId): " . $e->getMessage());
    }
}
