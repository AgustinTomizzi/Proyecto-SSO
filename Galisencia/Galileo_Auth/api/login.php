<?php

require_once __DIR__ . "/_common.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    api_json(["ok" => false, "error" => "método no permitido"], 405);
}

$data = api_body();
$email = trim((string) ($data["email"] ?? ""));
$password = (string) ($data["password"] ?? "");

if ($email === "" || $password === "") {
    api_json(["ok" => false, "error" => "email y contraseña requeridos"], 400);
}

$stmt = $pdo->prepare("
    SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.contrasena, r.nombre AS rol
    FROM usuarios u
    INNER JOIN roles r ON u.rol_id = r.id_rol
    WHERE u.email = ?
    LIMIT 1
");
$stmt->execute([$email]);
$u = $stmt->fetch();

if (!$u || !password_verify($password, $u["contrasena"])) {
    api_json(["ok" => false, "error" => "credenciales inválidas"], 401);
}

session_regenerate_id(true);
$_SESSION["id_usuario"] = $u["id_usuario"];
$_SESSION["nombre"] = $u["nombre"];
$_SESSION["apellido"] = $u["apellido"];
$_SESSION["email"] = $u["email"];
$_SESSION["rol"] = $u["rol"];

$map = [
    "Alumno" => "alumno",
    "Preceptor" => "preceptor",
    "Directivo" => "directivo",
    "Administrador Académico" => "admin",
    "Administrador" => "admin",
    "Docente" => "preceptor",
];
$rol = $map[$u["rol"]] ?? "alumno";

$usuario = [
    "id" => (string) $u["id_usuario"],
    "nombre" => $u["nombre"],
    "email" => $u["email"],
    "rol" => $rol,
];

if ($rol === "alumno") {
    $s = $pdo->prepare("
        SELECT a.id_alumno AS id, CONCAT(c.anio, ' ', c.division) AS curso
        FROM alumnos a
        LEFT JOIN cursos c ON a.curso_id = c.id_cursos
        WHERE a.email = ?
        LIMIT 1
    ");
    $s->execute([$u["email"]]);
    $a = $s->fetch();
    if ($a) {
        $usuario["id"] = (string) $a["id"];
        $usuario["curso"] = $a["curso"];
    }
}

api_json(["ok" => true, "usuario" => $usuario]);
