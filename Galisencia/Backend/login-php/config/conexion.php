<?php
// config/conexion.php
// Unico lugar para la conexion a la base de datos. Todos los demas
// archivos la incluyen con require en vez de repetir esta logica.
//
// Conecta contra el servidor del colegio (phpMyAdmin / MySQL remoto).
// Ajusta estos valores si cambian. Para desarrollo local podes comentar
// el bloque remoto y usar el bloque "local" de abajo.

// ---------- Configuracion REMOTA (server del profe) ----------
$host = 'server.galileo.edu.ar';
$port = '81';
$db   = 'ProyectoEstela';      // BD de Galicencia
$user = 'alumno';              // usuario de la BD
$pass = 'alumnoGalileo';       // contrasena de la BD
// ------------------------------------------------------------

/*
// ---------- Configuracion LOCAL (desarrollo en tu PC) ----------
$host = 'localhost';
$port = '3306';
$db   = 'ProyectoEstela';
$user = 'root';
$pass = '';
// ---------------------------------------------------------------
*/

$charset = 'utf8mb4';

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";

$opciones = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $opciones);
} catch (PDOException $e) {
    error_log($e->getMessage());
    header('Content-Type: application/json');
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'No se pudo conectar a la base de datos.']);
    exit;
}
