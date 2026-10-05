<?php

require_once __DIR__ . "/_common.php";
api_metodo(["POST"]);
api_login_requerido();

// Autoservicio: cualquier usuario autenticado cambia su propia contrasena
// reingresando la actual. No requiere permiso RBAC.
$d = api_body();
$actual = (string) ($d["actual"] ?? "");
$nueva = (string) ($d["nueva"] ?? "");

if ($actual === "" || $nueva === "") {
    api_json(["ok" => false, "error" => "la contraseña actual y la nueva son requeridas"], 400);
}
// bcrypt solo considera los primeros 72 bytes.
if (strlen($nueva) < 8 || strlen($nueva) > 72) {
    api_json(["ok" => false, "error" => "la nueva contraseña debe tener entre 8 y 72 caracteres"], 400);
}
if (hash_equals($actual, $nueva)) {
    api_json(["ok" => false, "error" => "la nueva contraseña debe ser distinta de la actual"], 400);
}
if (strcasecmp($nueva, "demo1234") === 0) {
    api_json(["ok" => false, "error" => "demo1234 es solo para demostración: elegí otra contraseña"], 400);
}

$resultado = api_verificar_contrasena_actual($actual);
if ($resultado !== "ok") {
    api_rechazar_contrasena($resultado);
}
api_limpiar_intentos((string) ($_SESSION["email"] ?? ""), "reauth");

$pdo->prepare("UPDATE usuarios SET contrasena = ?, debe_cambiar_password = 0 WHERE id_usuario = ?")
    ->execute([password_hash($nueva, PASSWORD_DEFAULT), usuarioActual()]);
$_SESSION["debe_cambiar_password"] = 0;
session_regenerate_id(true);

registrarAuditoria("usuarios.cambiar_password", "usuario", usuarioActual());

api_json(["ok" => true]);
