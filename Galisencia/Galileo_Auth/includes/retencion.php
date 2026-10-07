<?php

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/config.php";
require_once __DIR__ . "/auditoria.php";

/*
 * Política de retención (Ley 25.326: no conservar datos más de lo necesario).
 * Plazos en config_institucion (retencion.*). La aplica cli/retencion.php y,
 * una vez por día, el worker de notificaciones. Registra en la auditoría
 * cuántos registros borró (sin contenido).
 */
function retencion_aplicar(PDO $pdo)
{
    $c = config_institucion();
    $resultado = [];
    $borrar = function ($clave, $sql, array $params) use ($pdo, &$resultado) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $resultado[$clave] = $stmt->rowCount();
    };
    $borrar("auditoria", "DELETE FROM auditoria WHERE fecha < NOW() - INTERVAL ? MONTH", [$c["retencion.auditoria_meses"]]);
    $borrar("notificaciones", "DELETE FROM notificaciones WHERE estado IN ('enviada', 'error', 'cancelada') AND creada_en < NOW() - INTERVAL ? MONTH", [$c["retencion.notificaciones_meses"]]);
    $borrar("login_intentos", "DELETE FROM login_intentos WHERE fecha < NOW() - INTERVAL ? DAY", [$c["retencion.login_intentos_dias"]]);
    // El certificado se borra; la justificación (fechas y motivo) queda.
    $borrar("adjuntos_justificaciones", "UPDATE justificaciones SET adjunto = NULL, adjunto_nombre = NULL, adjunto_tipo = NULL WHERE adjunto IS NOT NULL AND creado_en < NOW() - INTERVAL ? MONTH", [$c["retencion.adjuntos_meses"]]);
    registrarAuditoria("privacidad.retencion", "sistema", null, ["borrados" => $resultado]);
    return $resultado;
}

/** Si pasó más de un día desde la última aplicación (según la auditoría). */
function retencion_corresponde(PDO $pdo)
{
    $ultima = $pdo->query("SELECT MAX(fecha) FROM auditoria WHERE accion = 'privacidad.retencion'")->fetchColumn();
    return !$ultima || strtotime((string) $ultima) < time() - 86400;
}
