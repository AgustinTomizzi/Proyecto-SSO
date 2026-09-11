<?php

// Capa API JSON para el frontend. Reutiliza la conexion PDO y el RBAC existente.

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../includes/auth.php";
require_once __DIR__ . "/../includes/permisos.php";
require_once __DIR__ . "/../includes/auditoria.php";

header("Content-Type: application/json; charset=utf-8");
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";
$configuredOrigins = array_values(array_filter(array_map("trim", explode(",", getenv("CORS_ALLOWED_ORIGINS") ?: ""))));
$originHost = $origin !== "" ? parse_url($origin, PHP_URL_HOST) : null;
$isLocalOrigin = in_array($originHost, ["localhost", "127.0.0.1", "::1"], true);
if ($origin !== "" && (in_array($origin, $configuredOrigins, true) || $isLocalOrigin)) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Credentials: true");
    header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

set_exception_handler(function ($e) {
    error_log("API error: " . $e->getMessage());
    if (!headers_sent()) {
        header("Content-Type: application/json; charset=utf-8");
        http_response_code(500);
    }
    echo json_encode(["ok" => false, "error" => "error interno del servidor"], JSON_UNESCAPED_UNICODE);
});

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
    if ($raw === false || trim($raw) === "") {
        return [];
    }
    $d = json_decode($raw, true);
    if (!is_array($d) || json_last_error() !== JSON_ERROR_NONE) {
        api_json(["ok" => false, "error" => "JSON invalido"], 400);
    }
    return $d;
}

function api_metodo($permitidos)
{
    $method = $_SERVER["REQUEST_METHOD"] ?? "GET";
    if (!in_array($method, $permitidos, true)) {
        header("Allow: " . implode(", ", $permitidos));
        api_json(["ok" => false, "error" => "metodo no permitido"], 405);
    }
    return $method;
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

function api_tiene_permiso($permiso)
{
    return estaLogueado() && tienePermiso(usuarioActual(), $permiso);
}

function api_permisos_usuario($usuarioId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT p.nombre FROM permisos p JOIN rol_permiso rp ON rp.permiso_id = p.id_permiso JOIN usuarios u ON u.rol_id = rp.rol_id WHERE u.id_usuario = ? ORDER BY p.nombre");
    $stmt->execute([$usuarioId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function api_sistemas_usuario($usuarioId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT s.nombre FROM sistemas s JOIN rol_sistema rs ON rs.sistema_id = s.id_sistema JOIN usuarios u ON u.rol_id = rs.rol_id WHERE u.id_usuario = ? AND s.activo = 1 ORDER BY s.nombre");
    $stmt->execute([$usuarioId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function api_requerir_sistema($sistema)
{
    if (!estaLogueado() || !in_array($sistema, api_sistemas_usuario(usuarioActual()), true)) {
        api_json(["ok" => false, "error" => "tu rol no tiene acceso a " . $sistema], 403);
    }
}

function api_es_administrador()
{
    return isset($_SESSION["rol"]) && strcasecmp($_SESSION["rol"], "Administrador") === 0;
}

function api_rol_es($rol)
{
    return isset($_SESSION["rol"]) && strcasecmp($_SESSION["rol"], $rol) === 0;
}

function api_id_positivo($valor)
{
    $id = filter_var($valor, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    return $id === false ? null : (int) $id;
}

function api_cursos_del_preceptor($usuarioId, $bloquear = false)
{
    global $pdo;
    $sql = "SELECT id_cursos FROM cursos WHERE preceptor_id = ?";
    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$usuarioId]);
    return array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function api_email_usuario($usuarioId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT email FROM usuarios WHERE id_usuario = ? LIMIT 1");
    $stmt->execute([$usuarioId]);
    $email = $stmt->fetchColumn();
    return $email === false ? null : $email;
}

function api_fecha_valida($fecha)
{
    if (!is_string($fecha)) {
        return false;
    }
    $d = DateTime::createFromFormat("!Y-m-d", $fecha);
    return $d && $d->format("Y-m-d") === $fecha;
}

function api_hora_valida($hora)
{
    foreach (["H:i", "H:i:s"] as $formato) {
        $valor = DateTime::createFromFormat("!" . $formato, $hora);
        if ($valor && $valor->format($formato) === $hora) {
            return true;
        }
    }
    return false;
}
