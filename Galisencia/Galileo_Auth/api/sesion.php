<?php

require_once __DIR__ . "/_common.php";
api_metodo(["GET"]);
api_login_requerido();

$stmt = $pdo->prepare("SELECT u.id_usuario AS id, u.nombre, u.apellido, u.email, r.nombre AS rol, r.nombre AS rol_backend, u.debe_cambiar_password FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?");
$stmt->execute([usuarioActual()]);
$usuario = $stmt->fetch();
if (!$usuario) {
    session_unset();
    session_destroy();
    api_json(["ok" => false, "error" => "sesion invalida"], 401);
}
$usuario["debeCambiarPassword"] = (bool) $usuario["debe_cambiar_password"];
unset($usuario["debe_cambiar_password"]);
$usuarioIdSesion = usuarioActual();
if (strcasecmp((string) $usuario["rol"], "Alumno") === 0) {
    $alumnoStmt = $pdo->prepare("SELECT a.id_alumno AS id, CONCAT(c.anio, ' ', c.division) AS curso FROM alumnos a LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE a.usuario_id=? AND a.estado=1 LIMIT 1");
    $alumnoStmt->execute([$usuarioIdSesion]);
    $alumno = $alumnoStmt->fetch();
    if ($alumno) {
        $usuario["id"] = (string) $alumno["id"];
        $usuario["curso"] = $alumno["curso"];
    }
}
if (strcasecmp((string) $usuario["rol"], "Tutor") === 0) {
    $usuario["alumnos"] = api_alumnos_vinculados($usuarioIdSesion);
}
$permisos = api_permisos_usuario($usuarioIdSesion);
api_json(["ok" => true, "usuario" => $usuario, "permisos" => $permisos, "sistemas" => api_sistemas_usuario($usuarioIdSesion)]);
