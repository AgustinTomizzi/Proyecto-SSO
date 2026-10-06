<?php

require_once __DIR__ . "/_common.php";

api_metodo(["POST"]);

$data = api_body();
$email = trim((string) ($data["email"] ?? ""));
$password = (string) ($data["password"] ?? "");

if ($email === "" || $password === "") {
    api_json(["ok" => false, "error" => "email y contraseña requeridos"], 400);
}

if (api_intentos_bloqueado($email)) {
    api_responder_bloqueo();
}

// Paso 1: el proveedor configurado verifica las credenciales (local por
// defecto; ver includes/autenticacion.php). Paso 2: se abre la sesión.
$u = auth_proveedor()->autenticar($email, $password);
if ($u === null) {
    api_registrar_intento_fallido($email);
    api_json(["ok" => false, "error" => "credenciales inválidas"], 401);
}
api_limpiar_intentos($email);
auth_iniciar_sesion($u);

function normalizarRol($nombre)
{
    $reemplazos = [
        "á" => "a", "é" => "e", "í" => "i", "ó" => "o", "ú" => "u",
        "Á" => "A", "É" => "E", "Í" => "I", "Ó" => "O", "Ú" => "U",
        "ñ" => "n", "Ñ" => "N",
    ];
    return strtr(trim($nombre), $reemplazos);
}

$map = [
    "alumno" => "alumno",
    "preceptor" => "preceptor",
    "directivo" => "directivo",
    "administrador academico" => "admin",
    "administrador" => "admin",
    "docente" => "preceptor",
];
$rol = $map[strtolower(normalizarRol($u["rol"]))] ?? "alumno";

$usuario = [
    "id" => (string) $u["id_usuario"],
    "nombre" => $u["nombre"],
    "email" => $u["email"],
    "rol" => $rol,
    "rol_backend" => $u["rol"],
    "debeCambiarPassword" => (bool) $u["debe_cambiar_password"],
];

if ($rol === "alumno") {
    $s = $pdo->prepare("
        SELECT a.id_alumno AS id, CONCAT(c.anio, ' ', c.division) AS curso
        FROM alumnos a
        LEFT JOIN cursos c ON a.curso_id = c.id_cursos
        WHERE a.usuario_id = ? AND a.estado = 1
        LIMIT 1
    ");
    $s->execute([$u["id_usuario"]]);
    $a = $s->fetch();
    if ($a) {
        $usuario["id"] = (string) $a["id"];
        $usuario["curso"] = $a["curso"];
    }
}

api_json([
    "ok" => true,
    "usuario" => $usuario,
    "permisos" => api_permisos_usuario((int) $u["id_usuario"]),
    "sistemas" => api_sistemas_usuario((int) $u["id_usuario"]),
]);
