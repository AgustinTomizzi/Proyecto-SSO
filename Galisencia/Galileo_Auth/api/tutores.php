<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "DELETE"]);
api_requerir_permiso("tutores.gestionar");
$usuarioId = (int) usuarioActual();

// Portal de familias: cuentas de tutores (rol Tutor) y su vínculo con alumnos.
// Gestiona tutores.gestionar (Administración Académica y Administrador). El
// Tutor solo lee lo de sus alumnos vinculados (alcance en cada endpoint).

const TUTOR_PARENTESCOS = ["Madre", "Padre", "Tutor legal", "Responsable", "Otro"];

function tutor_publico(array $t)
{
    return [
        "tutorId" => (string) $t["id_usuario"],
        "nombre" => $t["nombre"],
        "apellido" => $t["apellido"],
        "email" => $t["email"],
        "parentesco" => $t["parentesco"] ?? null,
        "pendienteDeIngreso" => (bool) $t["debe_cambiar_password"],
    ];
}

if ($method === "GET") {
    // Tutores de un alumno.
    if (isset($_GET["alumnoId"])) {
        $alumnoId = api_id_positivo($_GET["alumnoId"]);
        if ($alumnoId === null) {
            api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
        }
        $stmt = $pdo->prepare("SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.debe_cambiar_password, ta.parentesco FROM tutor_alumno ta JOIN usuarios u ON u.id_usuario = ta.tutor_id WHERE ta.alumno_id = ? ORDER BY u.apellido, u.nombre");
        $stmt->execute([$alumnoId]);
        api_json(["ok" => true, "tutores" => array_map("tutor_publico", $stmt->fetchAll()), "parentescos" => TUTOR_PARENTESCOS]);
    }
    // Todos los tutores con sus alumnos (o filtrados por texto).
    $q = trim((string) ($_GET["q"] ?? ""));
    $sql = "SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.debe_cambiar_password FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id AND r.nombre = 'Tutor'";
    $params = [];
    if ($q !== "") {
        $sql .= " WHERE CONCAT(u.nombre, ' ', u.apellido, ' ', u.email) LIKE ?";
        $params[] = "%" . addcslashes($q, "%_\\") . "%";
    }
    $stmt = $pdo->prepare($sql . " ORDER BY u.apellido, u.nombre LIMIT 200");
    $stmt->execute($params);
    $tutores = [];
    $vinculos = $pdo->prepare("SELECT a.id_alumno AS id, a.nombre, a.apellido, CONCAT(c.anio, ' ', c.division) AS curso, ta.parentesco FROM tutor_alumno ta JOIN alumnos a ON a.id_alumno = ta.alumno_id LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE ta.tutor_id = ? AND a.estado = 1 ORDER BY a.apellido, a.nombre");
    foreach ($stmt->fetchAll() as $t) {
        $vinculos->execute([$t["id_usuario"]]);
        $tutores[] = array_merge(tutor_publico($t), ["alumnos" => array_map(fn ($a) => array_merge($a, ["id" => (string) $a["id"]]), $vinculos->fetchAll())]);
    }
    api_json(["ok" => true, "tutores" => $tutores, "parentescos" => TUTOR_PARENTESCOS]);
}

$d = api_body();

if ($method === "DELETE") {
    $tutorId = api_id_positivo($d["tutorId"] ?? null);
    $alumnoId = api_id_positivo($d["alumnoId"] ?? null);
    if ($tutorId === null || $alumnoId === null) {
        api_json(["ok" => false, "error" => "tutorId y alumnoId son requeridos"], 400);
    }
    $stmt = $pdo->prepare("DELETE FROM tutor_alumno WHERE tutor_id = ? AND alumno_id = ?");
    $stmt->execute([$tutorId, $alumnoId]);
    if ($stmt->rowCount() === 0) {
        api_json(["ok" => false, "error" => "ese vínculo no existe"], 404);
    }
    // Avisos de inasistencia pendientes de ese tutor para ese alumno: ya no corresponden.
    $pdo->prepare("DELETE FROM notificaciones WHERE usuario_id = ? AND estado = 'pendiente' AND referencia LIKE ?")->execute([$tutorId, "inasistencia:$tutorId:$alumnoId:%"]);
    registrarAuditoria("tutores.desvincular", "tutor_alumno", "$tutorId:$alumnoId", ["tutor_id" => $tutorId, "alumno_id" => $alumnoId]);
    api_json(["ok" => true]);
}

// POST: vincula un tutor existente (por email) o crea la cuenta y lo vincula.
// {"alumnoId":12,"parentesco":"Madre","email":"...","nombre":"...","apellido":"...","passwordInicial":"..."}
$alumnoId = api_id_positivo($d["alumnoId"] ?? null);
$email = strtolower(trim((string) ($d["email"] ?? "")));
$parentesco = trim((string) ($d["parentesco"] ?? ""));
if ($alumnoId === null || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    api_json(["ok" => false, "error" => "alumnoId y un email válido son requeridos"], 400);
}
if ($parentesco !== "" && !in_array($parentesco, TUTOR_PARENTESCOS, true)) {
    api_json(["ok" => false, "error" => "parentesco debe ser uno de: " . implode(", ", TUTOR_PARENTESCOS)], 400);
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("SELECT id_alumno FROM alumnos WHERE id_alumno = ? AND estado = 1 FOR UPDATE");
    $stmt->execute([$alumnoId]);
    if (!$stmt->fetchColumn()) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no existe o está inactivo"], 404);
    }
    $stmt = $pdo->prepare("SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.debe_cambiar_password, r.nombre AS rol FROM usuarios u LEFT JOIN roles r ON r.id_rol = u.rol_id WHERE u.email = ? FOR UPDATE");
    $stmt->execute([$email]);
    $existente = $stmt->fetch();
    $creado = false;
    if ($existente) {
        if (strcasecmp((string) $existente["rol"], "Tutor") !== 0) {
            $pdo->rollBack();
            // No se revela qué rol tiene la otra cuenta.
            api_json(["ok" => false, "error" => "ese email ya pertenece a una cuenta que no es de tutor"], 409);
        }
        $tutorId = (int) $existente["id_usuario"];
    } else {
        $nombre = trim((string) ($d["nombre"] ?? ""));
        $apellido = trim((string) ($d["apellido"] ?? ""));
        $password = (string) ($d["passwordInicial"] ?? "");
        if ($nombre === "" || $apellido === "" || strlen($password) < 8 || strlen($password) > 72) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "para crear la cuenta del tutor hacen falta nombre, apellido y una contraseña inicial de 8 a 72 caracteres"], 400);
        }
        $pdo->prepare("INSERT INTO usuarios (nombre, apellido, email, contrasena, rol_id, debe_cambiar_password) VALUES (?, ?, ?, ?, (SELECT id_rol FROM roles WHERE nombre = 'Tutor'), 1)")
            ->execute([$nombre, $apellido, $email, password_hash($password, PASSWORD_DEFAULT)]);
        $tutorId = (int) $pdo->lastInsertId();
        $creado = true;
    }
    $stmt = $pdo->prepare("SELECT 1 FROM tutor_alumno WHERE tutor_id = ? AND alumno_id = ?");
    $stmt->execute([$tutorId, $alumnoId]);
    if ($stmt->fetchColumn()) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "ese tutor ya está vinculado con el alumno"], 409);
    }
    $pdo->prepare("INSERT INTO tutor_alumno (tutor_id, alumno_id, parentesco, creado_por) VALUES (?, ?, ?, ?)")
        ->execute([$tutorId, $alumnoId, $parentesco !== "" ? $parentesco : null, $usuarioId]);
    registrarAuditoria("tutores.vincular", "tutor_alumno", "$tutorId:$alumnoId", ["tutor_id" => $tutorId, "alumno_id" => $alumnoId, "cuenta_creada" => $creado]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

$stmt = $pdo->prepare("SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.debe_cambiar_password, ta.parentesco FROM tutor_alumno ta JOIN usuarios u ON u.id_usuario = ta.tutor_id WHERE ta.tutor_id = ? AND ta.alumno_id = ?");
$stmt->execute([$tutorId, $alumnoId]);
api_json(["ok" => true, "tutor" => tutor_publico($stmt->fetch()), "cuentaCreada" => $creado], 201);
