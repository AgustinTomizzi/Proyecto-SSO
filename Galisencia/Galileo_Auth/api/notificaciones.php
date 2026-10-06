<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "PUT"]);
$usuarioId = (int) usuarioActual();

// Notificaciones por email del usuario: preferencias por tipo e historial
// propio. ?cola=1 (config.gestionar) muestra el estado de la cola de envío.

function notif_preferencias($usuarioId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT tipo, habilitada FROM notificacion_preferencias WHERE usuario_id = ?");
    $stmt->execute([$usuarioId]);
    $guardadas = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $respuesta = [];
    foreach (notif_tipos() as $tipo => $etiqueta) {
        $respuesta[] = ["tipo" => $tipo, "etiqueta" => $etiqueta, "habilitada" => !isset($guardadas[$tipo]) || (int) $guardadas[$tipo] === 1];
    }
    return $respuesta;
}

if ($method === "GET") {
    if (isset($_GET["cola"])) {
        api_requerir_permiso("config.gestionar");
        $estados = $pdo->query("SELECT estado, COUNT(*) FROM notificaciones GROUP BY estado")->fetchAll(PDO::FETCH_KEY_PAIR);
        $errores = $pdo->query("SELECT id_notificacion AS id, tipo, destinatario, intentos, ultimo_error AS ultimoError, programada_para AS programadaPara FROM notificaciones WHERE estado = 'error' OR (estado = 'pendiente' AND intentos > 0) ORDER BY id_notificacion DESC LIMIT 50")->fetchAll();
        api_json([
            "ok" => true,
            "smtpConfigurado" => trim((string) getenv("SMTP_HOST")) !== "",
            "porEstado" => array_merge(["pendiente" => 0, "enviada" => 0, "error" => 0, "cancelada" => 0], array_map("intval", $estados)),
            "conProblemas" => $errores,
        ]);
    }
    $stmt = $pdo->prepare("SELECT id_notificacion AS id, tipo, asunto, estado, programada_para AS programadaPara, enviada_en AS enviadaEn, creada_en AS creadaEn FROM notificaciones WHERE usuario_id = ? ORDER BY id_notificacion DESC LIMIT 30");
    $stmt->execute([$usuarioId]);
    api_json(["ok" => true, "preferencias" => notif_preferencias($usuarioId), "notificaciones" => $stmt->fetchAll()]);
}

// PUT {"preferencias": {"reserva_recordatorio": false}}: cambio parcial.
$d = api_body();
$preferencias = $d["preferencias"] ?? null;
if (!is_array($preferencias) || !$preferencias || array_is_list($preferencias)) {
    api_json(["ok" => false, "error" => "preferencias debe ser un objeto {tipo: true|false}"], 400);
}
$tipos = notif_tipos();
foreach ($preferencias as $tipo => $valor) {
    if (!isset($tipos[$tipo]) || !is_bool($valor)) {
        api_json(["ok" => false, "error" => "tipo de notificación inválido o valor no booleano: $tipo"], 400);
    }
}
$guardar = $pdo->prepare("INSERT INTO notificacion_preferencias (usuario_id, tipo, habilitada) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE habilitada = VALUES(habilitada)");
foreach ($preferencias as $tipo => $valor) {
    $guardar->execute([$usuarioId, $tipo, $valor ? 1 : 0]);
}
// Apagar los recordatorios quita los pendientes del usuario.
if (($preferencias["reserva_recordatorio"] ?? true) === false) {
    $pdo->prepare("DELETE FROM notificaciones WHERE usuario_id = ? AND tipo = 'reserva_recordatorio' AND estado = 'pendiente'")->execute([$usuarioId]);
}
registrarAuditoria("notificaciones.preferencias", "usuario", $usuarioId, ["preferencias" => $preferencias]);
api_json(["ok" => true, "preferencias" => notif_preferencias($usuarioId)]);
