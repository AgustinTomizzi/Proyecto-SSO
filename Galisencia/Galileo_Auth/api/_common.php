<?php

// Capa API JSON para el frontend. Reutiliza la conexion PDO y el RBAC existente.

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../includes/auth.php";
require_once __DIR__ . "/../includes/permisos.php";

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function api_json($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function api_body()
{
    $raw = file_get_contents("php://input");
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function api_login_requerido()
{
    if (!estaLogueado()) {
        api_json(["ok" => false, "error" => "no autenticado"], 401);
    }
    return usuarioActual();
}

function api_requerir_permiso($permiso)
{
    if (!estaLogueado() || !tienePermiso(usuarioActual(), $permiso)) {
        api_json(["ok" => false, "error" => "sin permiso"], 403);
    }
}
