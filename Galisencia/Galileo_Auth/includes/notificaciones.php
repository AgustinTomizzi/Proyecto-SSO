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
        "inasistencia" => "Aviso diario de inasistencias",
    ];
}

/** Tipos que corresponden a un rol: las familias reciben inasistencias; el resto, avisos de reservas. */
function notif_tipos_del_rol($rol)
{
    $tipos = notif_tipos();
    return strcasecmp((string) $rol, "Tutor") === 0
        ? array_intersect_key($tipos, ["inasistencia" => true])
        : array_diff_key($tipos, ["inasistencia" => true]);
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
        case "inasistencia":
            $lista = implode("", array_map(fn ($m) => "- $m
", $d["materias"]));
            $cantidad = count($d["materias"]);
            return [
                "Inasistencia de {$d["alumno"]} el " . notif_fecha_texto($d["fecha"]),
                "Hola {$d["nombre"]}:

{$d["alumno"]} tiene " . ($cantidad === 1 ? "una inasistencia" : "$cantidad inasistencias") . " el " . notif_fecha_texto($d["fecha"]) . " en:

$lista
"
                    . "Si corresponde, acercá el justificativo a preceptoría. Podés ver el detalle en Galisencia.
"
                    . "Para dejar de recibir este aviso, desactivalo en Galisencia > Familia.
",
            ];
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

/**
 * Aviso de inasistencias a los tutores del alumno para una fecha: uno por
 * tutor, alumno y día (no uno por materia), programado a la hora de resumen.
 * Se recalcula en cada cambio: si ya no hay ausencias sin justificar, se borra.
 * Solo para fechas de los últimos 7 días (una carga atrasada de meses no avisa).
 * No lanza excepciones.
 */
function notif_inasistencias($alumnoId, $fecha)
{
    global $pdo;
    try {
        $hoy = date("Y-m-d");
        if ($fecha > $hoy || $fecha < date("Y-m-d", strtotime("-7 days"))) {
            return;
        }
        $stmt = $pdo->prepare("SELECT u.id_usuario, u.nombre, u.email FROM tutor_alumno ta JOIN usuarios u ON u.id_usuario = ta.tutor_id WHERE ta.alumno_id = ?");
        $stmt->execute([$alumnoId]);
        $tutores = $stmt->fetchAll();
        if (!$tutores) {
            return;
        }
        $stmt = $pdo->prepare("SELECT CONCAT(a.nombre, ' ', a.apellido) FROM alumnos a WHERE a.id_alumno = ?");
        $stmt->execute([$alumnoId]);
        $alumno = (string) $stmt->fetchColumn();
        $stmt = $pdo->prepare("SELECT m.nombre FROM asistencias asi JOIN materias m ON m.id_materia = asi.materia_id WHERE asi.alumno_id = ? AND asi.fecha = ? AND asi.estado = 'ausente' ORDER BY m.nombre");
        $stmt->execute([$alumnoId, $fecha]);
        $materias = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $hora = (string) (config_institucion()["notificaciones.hora_resumen_inasistencias"] ?? "18:00");
        $programada = max("$fecha $hora:00", date("Y-m-d H:i:s"));
        foreach ($tutores as $t) {
            $referencia = "inasistencia:{$t["id_usuario"]}:$alumnoId:$fecha";
            if (!$materias || !notif_habilitada((int) $t["id_usuario"], "inasistencia")) {
                $pdo->prepare("DELETE FROM notificaciones WHERE referencia = ? AND estado = 'pendiente'")->execute([$referencia]);
                continue;
            }
            [$asunto, $cuerpo] = notif_plantilla("inasistencia", ["nombre" => $t["nombre"], "alumno" => $alumno, "fecha" => $fecha, "materias" => $materias]);
            $actualizar = $pdo->prepare("UPDATE notificaciones SET asunto = ?, cuerpo = ? WHERE referencia = ? AND estado = 'pendiente'");
            $actualizar->execute([mb_substr($asunto, 0, 200), $cuerpo, $referencia]);
            if ($actualizar->rowCount() === 0) {
                $existe = $pdo->prepare("SELECT 1 FROM notificaciones WHERE referencia = ?");
                $existe->execute([$referencia]);
                if (!$existe->fetchColumn()) {
                    notif_encolar((int) $t["id_usuario"], "inasistencia", $t["email"], ["nombre" => $t["nombre"], "alumno" => $alumno, "fecha" => $fecha, "materias" => $materias], $programada, $referencia);
                }
            }
        }
    } catch (Throwable $e) {
        error_log("notificaciones: no se pudo armar el aviso de inasistencias (alumno $alumnoId, $fecha): " . $e->getMessage());
    }
}
