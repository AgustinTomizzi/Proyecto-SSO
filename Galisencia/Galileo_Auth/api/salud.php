<?php

// Chequeo de salud público para monitores externos (UptimeRobot, etc.):
// 200 {"ok":true} si la API y la base responden; 503 si no. No expone detalles.
// El detalle lo ve el Administrador en estado_sistema.php.

require_once __DIR__ . "/_common.php";
api_metodo(["GET", "HEAD"]);
header("Cache-Control: no-store");

try {
    $pdo->query("SELECT 1")->fetchColumn();
} catch (Throwable $e) {
    error_log("salud: la base no responde: " . $e->getMessage());
    api_json(["ok" => false], 503);
}
api_json(["ok" => true]);
