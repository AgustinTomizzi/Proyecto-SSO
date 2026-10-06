<?php

// Capa API JSON para el frontend. Reutiliza la conexion PDO y el RBAC existente.

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../includes/auth.php";
require_once __DIR__ . "/../includes/permisos.php";
require_once __DIR__ . "/../includes/auditoria.php";
require_once __DIR__ . "/../includes/autenticacion.php";
require_once __DIR__ . "/../includes/config.php";
require_once __DIR__ . "/../includes/notificaciones.php";

header("Content-Type: application/json; charset=utf-8");

// Cabeceras de seguridad: la API solo devuelve datos, nunca contenido embebible.
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header("Referrer-Policy: no-referrer");
header("Cache-Control: no-store");
$esHttps = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off")
    || strtolower((string) ($_SERVER["HTTP_X_FORWARDED_PROTO"] ?? "")) === "https";
if ($esHttps) {
    header("Strict-Transport-Security: max-age=31536000; includeSubDomains");
}

// CORS: en produccion solo los origenes de CORS_ALLOWED_ORIGINS (separados por
// coma); en APP_ENV=dev tambien cualquier puerto de localhost.
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";
$configuredOrigins = array_values(array_filter(array_map("trim", explode(",", getenv("CORS_ALLOWED_ORIGINS") ?: ""))));
$originHost = $origin !== "" ? parse_url($origin, PHP_URL_HOST) : null;
$isLocalOrigin = app_es_dev() && in_array($originHost, ["localhost", "127.0.0.1", "[::1]", "::1"], true);
if ($origin !== "" && (in_array($origin, $configuredOrigins, true) || $isLocalOrigin)) {
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Credentials: true");
    header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

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

// CSRF: toda escritura exige el header X-Requested-With: galileo (un formulario
// de otro sitio no puede enviarlo, y un fetch cruzado necesita preflight CORS)
// y un cuerpo JSON (multipart solo en los endpoints que suben archivos).
if (in_array($_SERVER["REQUEST_METHOD"] ?? "GET", ["POST", "PUT", "PATCH", "DELETE"], true)) {
    if (($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") !== "galileo") {
        http_response_code(403);
        echo json_encode(["ok" => false, "error" => "solicitud rechazada: falta el header X-Requested-With", "codigo" => "csrf"], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $tipoContenido = strtolower(trim(explode(";", (string) ($_SERVER["CONTENT_TYPE"] ?? ""))[0]));
    $tieneCuerpo = $tipoContenido !== "" || (int) ($_SERVER["CONTENT_LENGTH"] ?? 0) > 0;
    $tiposPermitidos = in_array(basename((string) ($_SERVER["SCRIPT_NAME"] ?? "")), ["horarios.php", "justificaciones.php"], true)
        ? ["application/json", "multipart/form-data"]
        : ["application/json"];
    if ($tieneCuerpo && !in_array($tipoContenido, $tiposPermitidos, true)) {
        http_response_code(415);
        echo json_encode(["ok" => false, "error" => "tipo de contenido no admitido: usá application/json", "codigo" => "csrf"], JSON_UNESCAPED_UNICODE);
        exit;
    }
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

/**
 * Rol vigente del usuario en sesion, leido de la base (usuarios.rol_id ->
 * roles.nombre) una vez por request. Refresca los datos de la sesion para que
 * un cambio de rol aplique en el request siguiente; si el usuario ya no
 * existe, vacia la sesion (los endpoints responden 401).
 */
function api_rol_actual()
{
    static $cache = [];
    if (!estaLogueado()) {
        return "";
    }
    $id = (int) usuarioActual();
    if (array_key_exists($id, $cache)) {
        return $cache[$id];
    }

    global $pdo;
    $stmt = $pdo->prepare("SELECT u.nombre, u.apellido, u.email, u.rol_id, u.debe_cambiar_password, r.nombre AS rol FROM usuarios u LEFT JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ? LIMIT 1");
    $stmt->execute([usuarioActual()]);
    $u = $stmt->fetch();
    if (!$u) {
        session_unset();
        return $cache[$id] = "";
    }

    $_SESSION["nombre"] = $u["nombre"];
    $_SESSION["apellido"] = $u["apellido"];
    $_SESSION["email"] = $u["email"];
    $_SESSION["rol_id"] = $u["rol_id"];
    $_SESSION["debe_cambiar_password"] = (int) $u["debe_cambiar_password"];
    $_SESSION["rol"] = (string) ($u["rol"] ?? "");
    return $cache[$id] = $_SESSION["rol"];
}

function api_es_administrador()
{
    return api_rol_es("Administrador");
}

function api_rol_es($rol)
{
    return estaLogueado() && strcasecmp(api_rol_actual(), $rol) === 0;
}

// ---- Limite de intentos de autenticacion (login y reconfirmacion) ----

const API_INTENTOS_MAXIMOS = 5;
const API_INTENTOS_VENTANA_MINUTOS = 15;
function api_intentos_bloqueado($email, $tipo = "login")
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM login_intentos WHERE email = ? AND tipo = ? AND fecha > NOW() - INTERVAL " . API_INTENTOS_VENTANA_MINUTOS . " MINUTE");
    $stmt->execute([strtolower(trim((string) $email)), $tipo]);
    return (int) $stmt->fetchColumn() >= API_INTENTOS_MAXIMOS;
}

function api_registrar_intento_fallido($email, $tipo = "login")
{
    global $pdo;
    $pdo->prepare("INSERT INTO login_intentos (email, ip, tipo) VALUES (?, ?, ?)")
        ->execute([strtolower(trim((string) $email)), substr((string) ($_SERVER["REMOTE_ADDR"] ?? ""), 0, 45) ?: null, $tipo]);
    $pdo->exec("DELETE FROM login_intentos WHERE fecha < NOW() - INTERVAL 1 DAY");
}

function api_limpiar_intentos($email, $tipo = "login")
{
    global $pdo;
    $pdo->prepare("DELETE FROM login_intentos WHERE email = ? AND tipo = ?")
        ->execute([strtolower(trim((string) $email)), $tipo]);
}

function api_responder_bloqueo()
{
    header("Retry-After: " . (API_INTENTOS_VENTANA_MINUTOS * 60));
    api_json(["ok" => false, "error" => "demasiados intentos fallidos: esperá unos minutos y volvé a probar"], 429);
}

/**
 * Operacion sensible: el usuario en sesion reingresa su contrasena.
 * Solo lee, asi que puede llamarse dentro de una transaccion.
 * Devuelve "ok", "bloqueado" o "incorrecta".
 */
function api_verificar_contrasena_actual($contrasena)
{
    global $pdo;
    $email = (string) ($_SESSION["email"] ?? "");
    if (api_intentos_bloqueado($email, "reauth")) {
        return "bloqueado";
    }
    $stmt = $pdo->prepare("SELECT contrasena FROM usuarios WHERE id_usuario = ? LIMIT 1");
    $stmt->execute([usuarioActual()]);
    $hash = $stmt->fetchColumn();
    $valida = is_string($hash) && $hash !== "" && (string) $contrasena !== "" && password_verify((string) $contrasena, $hash);
    return $valida ? "ok" : "incorrecta";
}

/**
 * Responde al rechazo de api_verificar_contrasena_actual(). Llamar fuera de
 * una transaccion (despues del rollBack) para que el intento quede registrado.
 */
function api_rechazar_contrasena($resultado)
{
    if ($resultado === "bloqueado") {
        api_responder_bloqueo();
    }
    api_registrar_intento_fallido((string) ($_SESSION["email"] ?? ""), "reauth");
    api_json(["ok" => false, "error" => "la contraseña actual es incorrecta"], 401);
}

function api_requerir_contrasena($contrasena)
{
    if (!estaLogueado()) {
        api_json(["ok" => false, "error" => "no autenticado"], 401);
    }
    $resultado = api_verificar_contrasena_actual($contrasena);
    if ($resultado !== "ok") {
        api_rechazar_contrasena($resultado);
    }
    api_limpiar_intentos((string) ($_SESSION["email"] ?? ""), "reauth");
}

/**
 * Resuelve la materia de un pedido: materiaId (preferido) o, por compatibilidad
 * durante un ciclo, el nombre en texto. La collation ignora tildes y
 * mayusculas ("matematica" == "Matemática"). Devuelve ["id", "nombre"] o null.
 */
function api_resolver_materia($materiaId, $materiaTexto)
{
    global $pdo;
    if ($materiaId !== null && $materiaId !== "") {
        $id = api_id_positivo($materiaId);
        if ($id === null) {
            return null;
        }
        $stmt = $pdo->prepare("SELECT id_materia AS id, nombre FROM materias WHERE id_materia = ?");
        $stmt->execute([$id]);
    } else {
        $texto = trim((string) $materiaTexto);
        if ($texto === "" || strlen($texto) > 255) {
            return null;
        }
        $stmt = $pdo->prepare("SELECT id_materia AS id, nombre FROM materias WHERE nombre = ? LIMIT 1");
        $stmt->execute([$texto]);
    }
    $materia = $stmt->fetch();
    return $materia ? ["id" => (int) $materia["id"], "nombre" => $materia["nombre"]] : null;
}

/** true si el pedido trae materiaId o materia (aunque sea invalida). */
function api_pide_materia($fuente)
{
    return (isset($fuente["materiaId"]) && $fuente["materiaId"] !== "")
        || (isset($fuente["materia"]) && trim((string) $fuente["materia"]) !== "");
}

function api_id_positivo($valor)
{
    $id = filter_var($valor, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    return $id === false ? null : (int) $id;
}

/**
 * Cursos a cargo del preceptor: los que tiene asignados más los que cubre
 * con una suplencia vigente hoy. $bloquear toma FOR UPDATE sobre los cursos
 * asignados (para operaciones que cambian alumnos de curso).
 */
function api_cursos_del_preceptor($usuarioId, $bloquear = false)
{
    global $pdo;
    $sql = "SELECT id_cursos FROM cursos WHERE preceptor_id = ?";
    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$usuarioId]);
    $cursos = array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));
    $stmt = $pdo->prepare("SELECT DISTINCT curso_id FROM cursos_suplencias WHERE preceptor_id = ? AND desde <= CURDATE() AND hasta >= CURDATE()");
    $stmt->execute([$usuarioId]);
    return array_values(array_unique(array_merge($cursos, array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN)))));
}

/**
 * Cursos de los que el preceptor es titular (sin suplencias). Las altas, bajas y
 * cambios de curso de alumnos se limitan a estos: una suplencia da acceso a la
 * operación diaria (asistencia, justificaciones, consulta), no a la estructura.
 */
function api_cursos_titulares_del_preceptor($usuarioId, $bloquear = false)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT id_cursos FROM cursos WHERE preceptor_id = ?" . ($bloquear ? " FOR UPDATE" : ""));
    $stmt->execute([$usuarioId]);
    return array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));
}

/**
 * Condición SQL: la columna de curso es de un curso a cargo del preceptor
 * (asignado o en suplencia vigente). Devuelve [sql, params].
 */
function api_sql_curso_del_preceptor($usuarioId, $columnaCurso)
{
    return [
        "($columnaCurso IN (SELECT id_cursos FROM cursos WHERE preceptor_id = ?) OR $columnaCurso IN (SELECT curso_id FROM cursos_suplencias WHERE preceptor_id = ? AND desde <= CURDATE() AND hasta >= CURDATE()))",
        [$usuarioId, $usuarioId],
    ];
}

// ---- Alcance del Docente: lo que dicta según la grilla vigente hoy ----

const API_CLASE_VIGENTE = "hc.vigente_desde <= CURDATE() AND (hc.vigente_hasta IS NULL OR hc.vigente_hasta >= CURDATE())";

/** Cursos en los que el docente tiene al menos una clase vigente. */
function api_cursos_del_docente($usuarioId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT DISTINCT hc.curso_id FROM horario_clases hc WHERE hc.docente_id = ? AND " . API_CLASE_VIGENTE);
    $stmt->execute([$usuarioId]);
    return array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));
}

/** Materias que el docente dicta (en un curso, si se indica). */
function api_materias_del_docente($usuarioId, $cursoId = null)
{
    global $pdo;
    $sql = "SELECT DISTINCT hc.materia_id FROM horario_clases hc WHERE hc.docente_id = ? AND " . API_CLASE_VIGENTE;
    $params = [$usuarioId];
    if ($cursoId !== null) {
        $sql .= " AND hc.curso_id = ?";
        $params[] = $cursoId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function api_docente_dicta($usuarioId, $cursoId, $materiaId)
{
    return $cursoId !== null && in_array((int) $materiaId, api_materias_del_docente($usuarioId, (int) $cursoId), true);
}

/**
 * Condición SQL: el par (curso, materia) de la fila lo dicta el docente.
 * Devuelve [sql, params] para sumar a un WHERE.
 */
function api_sql_docente_dicta($usuarioId, $columnaCurso, $columnaMateria)
{
    return [
        "EXISTS (SELECT 1 FROM horario_clases hc WHERE hc.docente_id = ? AND hc.curso_id = $columnaCurso AND hc.materia_id = $columnaMateria AND " . API_CLASE_VIGENTE . ")",
        [$usuarioId],
    ];
}

/** Alumno vinculado al usuario (alumnos.usuario_id); null si no hay. */
function api_alumno_del_usuario($usuarioId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT a.id_alumno, a.curso_id FROM alumnos a WHERE a.usuario_id = ? AND a.estado = 1 LIMIT 1");
    $stmt->execute([$usuarioId]);
    return $stmt->fetch() ?: null;
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

// Refresca rol y datos de la sesion desde la base en cada request autenticado.
api_rol_actual();

// Una cuenta marcada con debe_cambiar_password solo puede consultar su sesion,
// cambiar la contrasena o salir hasta que elija una contrasena propia.
if (
    estaLogueado()
    && !empty($_SESSION["debe_cambiar_password"])
    && !in_array(basename((string) ($_SERVER["SCRIPT_NAME"] ?? "")), ["login.php", "sesion.php", "cambiar_password.php", "logout.php"], true)
) {
    api_json(["ok" => false, "error" => "tenés que cambiar tu contraseña antes de continuar", "codigo" => "debe_cambiar_password"], 403);
}
