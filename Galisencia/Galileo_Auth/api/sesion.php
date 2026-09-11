<?php

require_once __DIR__ . "/_common.php";
api_metodo(["GET"]);
api_login_requerido();

$stmt = $pdo->prepare("SELECT u.id_usuario AS id, u.nombre, u.apellido, u.email, r.nombre AS rol, r.nombre AS rol_backend FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?");
$stmt->execute([usuarioActual()]);
$usuario = $stmt->fetch();
if (!$usuario) {
    session_unset();
    session_destroy();
    api_json(["ok" => false, "error" => "sesion invalida"], 401);
}
$usuarioIdSesion = usuarioActual();
if (strcasecmp((string) $usuario["rol"], "Alumno") === 0) {
    $alumnoStmt = $pdo->prepare("SELECT a.id_alumno AS id, CONCAT(c.anio, ' ', c.division) AS curso FROM alumnos a LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE a.email=? AND a.estado=1 LIMIT 1");
    $alumnoStmt->execute([$usuario["email"]]);
    $alumno = $alumnoStmt->fetch();
    if ($alumno) {
        $usuario["id"] = (string) $alumno["id"];
        $usuario["curso"] = $alumno["curso"];
    }
}
$permisos = api_permisos_usuario($usuarioIdSesion);
api_json(["ok" => true, "usuario" => $usuario, "permisos" => $permisos, "sistemas" => api_sistemas_usuario($usuarioIdSesion)]);
