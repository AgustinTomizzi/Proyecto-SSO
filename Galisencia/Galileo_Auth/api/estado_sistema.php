<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_metodo(["GET"]);
api_requerir_permiso("config.gestionar");

// Monitoreo para el Administrador: base, backups, cola de emails, retención,
// sesiones y espacio en disco, con alertas cuando algo necesita atención.

$alertas = [];
$horasDesde = fn ($fecha) => $fecha ? round((time() - strtotime((string) $fecha)) / 3600, 1) : null;

// Base de datos.
$tamanioMb = (float) $pdo->query("SELECT ROUND(SUM(data_length + index_length) / 1048576, 1) FROM information_schema.TABLES WHERE table_schema = DATABASE()")->fetchColumn();
$base = [
    "version" => (string) $pdo->query("SELECT VERSION()")->fetchColumn(),
    "tamanioMb" => $tamanioMb,
    "alumnos" => (int) $pdo->query("SELECT COUNT(*) FROM alumnos WHERE estado = 1")->fetchColumn(),
    "usuarios" => (int) $pdo->query("SELECT COUNT(*) FROM usuarios")->fetchColumn(),
];

// Backups (servicio backup: /backups/estado.json, montado en solo lectura).
$backup = null;
$archivoEstado = "/backups/estado.json";
if (is_readable($archivoEstado)) {
    $backup = json_decode((string) file_get_contents($archivoEstado), true) ?: null;
}
if (!$backup) {
    $alertas[] = "No hay registro de backups: revisá el servicio backup.";
} else {
    $backup["horasDesdeUltimo"] = $horasDesde($backup["ultimo"] ?? null);
    if (empty($backup["ok"])) {
        $alertas[] = "El último backup falló: " . ($backup["error"] ?? "sin detalle") . ".";
    } elseif ($backup["horasDesdeUltimo"] !== null && $backup["horasDesdeUltimo"] > 26) {
        $alertas[] = "El último backup tiene más de un día ({$backup["horasDesdeUltimo"]} h).";
    }
}

// Espacio en disco donde se guardan los backups.
$disco = null;
if (is_dir("/backups")) {
    $libre = @disk_free_space("/backups");
    $total = @disk_total_space("/backups");
    if ($libre !== false && $total) {
        $disco = ["libreGb" => round($libre / 1073741824, 1), "totalGb" => round($total / 1073741824, 1), "usoPct" => (int) round(100 - $libre / $total * 100)];
        if ($disco["usoPct"] >= 90) {
            $alertas[] = "El disco está al {$disco["usoPct"]} %.";
        }
    }
}

// Cola de emails.
$porEstado = $pdo->query("SELECT estado, COUNT(*) FROM notificaciones GROUP BY estado")->fetchAll(PDO::FETCH_KEY_PAIR);
$pendienteMasViejo = $pdo->query("SELECT MIN(programada_para) FROM notificaciones WHERE estado = 'pendiente' AND programada_para <= NOW()")->fetchColumn();
$notificaciones = [
    "smtpConfigurado" => trim((string) getenv("SMTP_HOST")) !== "",
    "porEstado" => array_merge(["pendiente" => 0, "enviada" => 0, "error" => 0, "cancelada" => 0], array_map("intval", $porEstado)),
    "horasPendienteMasViejo" => $horasDesde($pendienteMasViejo ?: null),
];
if ($notificaciones["porEstado"]["error"] > 0) {
    $alertas[] = "Hay {$notificaciones["porEstado"]["error"]} emails que no se pudieron enviar.";
}
if ($notificaciones["horasPendienteMasViejo"] !== null && $notificaciones["horasPendienteMasViejo"] > 1) {
    $alertas[] = $notificaciones["smtpConfigurado"]
        ? "Hay emails esperando hace más de una hora: revisá el servicio notificador."
        : "Hay emails en cola pero el envío está deshabilitado (SMTP_HOST vacío).";
}

// Retención y actividad.
$ultimaRetencion = $pdo->query("SELECT MAX(fecha) FROM auditoria WHERE accion = 'privacidad.retencion'")->fetchColumn() ?: null;
if ($horasDesde($ultimaRetencion) === null || $horasDesde($ultimaRetencion) > 26) {
    $alertas[] = "La retención de datos no corrió en el último día: revisá el servicio notificador.";
}
$sesionesActivas = (int) $pdo->query("SELECT COUNT(*) FROM sesiones WHERE actualizada >= UNIX_TIMESTAMP() - 1800")->fetchColumn();

api_json([
    "ok" => true,
    "generadoEn" => date("Y-m-d H:i:s"),
    "entorno" => strtolower((string) (getenv("APP_ENV") ?: "dev")),
    "version" => (string) (getenv("APP_VERSION") ?: ""),
    "base" => $base,
    "backup" => $backup,
    "disco" => $disco,
    "notificaciones" => $notificaciones,
    "retencion" => ["ultima" => $ultimaRetencion],
    "sesionesActivas" => $sesionesActivas,
    "alertas" => $alertas,
]);
