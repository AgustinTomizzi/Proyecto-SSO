<?php

// Worker de notificaciones: envía por SMTP las pendientes cuya hora llegó.
//   php cli/enviar_notificaciones.php          una pasada
//   php cli/enviar_notificaciones.php --loop   cada NOTIF_INTERVALO segundos (30)
// En Docker lo corre el servicio "notificador". Solo por línea de comandos.

if (PHP_SAPI !== "cli") {
    http_response_code(404);
    exit;
}

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../includes/smtp.php";
require_once __DIR__ . "/../includes/retencion.php";

const NOTIF_MAX_INTENTOS = 5;
const NOTIF_LOTE = 50;

function notif_log($mensaje)
{
    fwrite(STDOUT, "[" . date("Y-m-d H:i:s") . "] $mensaje\n");
}

/** Una pasada por la cola. Devuelve [enviadas, errores]. */
function notif_procesar(PDO $pdo, array $cfg)
{
    // Reserva un lote marcándolo con un intento más, para que dos workers no
    // tomen las mismas filas (SKIP LOCKED, MySQL 8).
    $pdo->beginTransaction();
    $filas = $pdo->query("SELECT id_notificacion, destinatario, asunto, cuerpo, intentos FROM notificaciones WHERE estado = 'pendiente' AND programada_para <= NOW() ORDER BY programada_para, id_notificacion LIMIT " . NOTIF_LOTE . " FOR UPDATE SKIP LOCKED")->fetchAll();
    if (!$filas) {
        $pdo->commit();
        return [0, 0];
    }
    $ids = array_column($filas, "id_notificacion");
    $pdo->prepare("UPDATE notificaciones SET intentos = intentos + 1 WHERE id_notificacion IN (" . implode(",", array_fill(0, count($ids), "?")) . ")")->execute($ids);
    $pdo->commit();

    $enviada = $pdo->prepare("UPDATE notificaciones SET estado = 'enviada', enviada_en = NOW(), ultimo_error = NULL, referencia = NULL WHERE id_notificacion = ?");
    $fallo = $pdo->prepare("UPDATE notificaciones SET estado = IF(intentos >= ?, 'error', 'pendiente'), ultimo_error = ?, programada_para = IF(intentos >= ?, programada_para, NOW() + INTERVAL (intentos * 5) MINUTE) WHERE id_notificacion = ?");
    $ok = 0;
    $errores = 0;
    $cliente = null;
    try {
        $cliente = new SmtpCliente($cfg);
    } catch (Throwable $e) {
        foreach ($ids as $id) {
            $fallo->execute([NOTIF_MAX_INTENTOS, mb_substr($e->getMessage(), 0, 255), NOTIF_MAX_INTENTOS, $id]);
        }
        notif_log("SMTP no disponible: " . $e->getMessage());
        return [0, count($ids)];
    }
    foreach ($filas as $fila) {
        try {
            $cliente->enviar($fila["destinatario"], $fila["asunto"], $fila["cuerpo"]);
            $enviada->execute([$fila["id_notificacion"]]);
            $ok++;
        } catch (Throwable $e) {
            $fallo->execute([NOTIF_MAX_INTENTOS, mb_substr($e->getMessage(), 0, 255), NOTIF_MAX_INTENTOS, $fila["id_notificacion"]]);
            $errores++;
            notif_log("error en la notificación {$fila["id_notificacion"]}: " . $e->getMessage());
        }
    }
    $cliente->cerrar();
    return [$ok, $errores];
}

$cfg = smtp_config();
if ($cfg["host"] === "") {
    notif_log("SMTP_HOST vacío: el envío de notificaciones está deshabilitado (quedan en la cola).");
    if (!in_array("--loop", $argv, true)) {
        exit(0);
    }
}
$intervalo = max(5, (int) (getenv("NOTIF_INTERVALO") ?: 30));
do {
    // Una vez por día, la política de retención de datos.
    try {
        if (retencion_corresponde($pdo)) {
            notif_log("retención aplicada: " . json_encode(retencion_aplicar($pdo)));
        }
    } catch (Throwable $e) {
        notif_log("error al aplicar la retención: " . $e->getMessage());
    }
    if ($cfg["host"] !== "") {
        try {
            [$ok, $errores] = notif_procesar($pdo, $cfg);
            if ($ok || $errores) {
                notif_log("enviadas: $ok, con error: $errores");
            }
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            notif_log("error del worker: " . $e->getMessage());
        }
    }
    if (in_array("--loop", $argv, true)) {
        sleep($intervalo);
    }
} while (in_array("--loop", $argv, true));
