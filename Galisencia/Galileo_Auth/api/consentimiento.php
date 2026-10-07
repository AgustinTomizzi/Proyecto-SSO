<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST"]);
$usuarioId = (int) usuarioActual();

// Aceptación de la política de privacidad (Ley 25.326). GET: versión vigente y
// si el usuario la aceptó. POST {"version":"2026-1"}: registra la aceptación de
// la versión vigente (una versión vieja se rechaza).

if ($method === "GET") {
    [$version, $pendiente] = api_politica_pendiente($usuarioId);
    $stmt = $pdo->prepare("SELECT version, aceptado_en AS aceptadoEn FROM consentimientos WHERE usuario_id = ? ORDER BY aceptado_en DESC");
    $stmt->execute([$usuarioId]);
    api_json(["ok" => true, "versionVigente" => $version, "pendiente" => $pendiente, "aceptaciones" => $stmt->fetchAll()]);
}

$d = api_body();
[$version] = api_politica_pendiente($usuarioId);
if ((string) ($d["version"] ?? "") !== $version) {
    api_json(["ok" => false, "error" => "la política cambió: volvé a leer la versión vigente", "versionVigente" => $version], 409);
}
$pdo->prepare("INSERT IGNORE INTO consentimientos (usuario_id, version) VALUES (?, ?)")->execute([$usuarioId, $version]);
$_SESSION["politica_aceptada"] = $version;
registrarAuditoria("privacidad.aceptar_politica", "usuario", $usuarioId, ["version" => $version]);
api_json(["ok" => true, "version" => $version]);
