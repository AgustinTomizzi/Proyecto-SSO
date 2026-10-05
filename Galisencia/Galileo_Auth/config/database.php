<?php

// Configuracion de base de datos basada en variables de entorno (Docker).
// Valores por defecto para desarrollo local (XAMPP/WAMP en localhost).

$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'ProyectoEstela';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';

// Zona horaria unica del sistema. En Docker tambien la fijan php.ini, TZ y
// --default-time-zone; se repite aca para instalaciones sin Docker (XAMPP).
date_default_timezone_set('America/Argentina/Buenos_Aires');

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    // NOW()/CURDATE() en hora argentina aunque el servidor MySQL use otra zona.
    // Offset fijo: Argentina no aplica horario de verano.
    $pdo->exec("SET time_zone = '-03:00'");
} catch (PDOException $e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "error de conexion a la base de datos"]);
    exit;
}
