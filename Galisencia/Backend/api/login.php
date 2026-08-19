<?php
// api/login.php
// Endpoint JSON de autenticacion para el frontend (React).
// Devuelve JSON (no redirecciona) para que el SPA lo consuma.
// Reutiliza la conexion remota de config/conexion.php.
//
// NOTA: asume una tabla `usuarios` con columnas
//   id, nombre, email, password (password_hash), rol
// Si la BD del colegio usa otra estructura, ajusta el SELECT.

require_once __DIR__ . '/../login-php/config/conexion.php';

// CORS: permite que el frontend (otro origen) consuma el endpoint.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Responder a preflight (OPTIONS) sin procesar cuerpo.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo no permitido']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$email = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email y contrasena requeridos']);
    exit;
}

// Si la tabla no tiene columna `rol`, el alias devuelve NULL y el frontend
// usa el rol elegido en el selector de la demo.
$stmt = $pdo->prepare('SELECT id, nombre, email, password, rol FROM usuarios WHERE email = :email');
$stmt->execute(['email' => $email]);
$usuario = $stmt->fetch();

if (!$usuario || !password_verify($password, $usuario['password'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Email o contrasena incorrectos']);
    exit;
}

echo json_encode([
    'ok' => true,
    'usuario' => [
        'id'     => $usuario['id'],
        'nombre' => $usuario['nombre'],
        'email'  => $usuario['email'],
        'rol'    => $usuario['rol'] ?? null,
    ],
]);
