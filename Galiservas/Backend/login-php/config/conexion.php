<?php
// config/conexion.php
// Un solo lugar para la conexión a la base de datos. Todos los demás
// archivos la incluyen con require en vez de repetir esta lógica.

$host = 'localhost';
$db   = 'login_app';
$user = 'root';       // cambia esto si tu MySQL tiene otro usuario
$pass = '';           // cambia esto si tu MySQL tiene contraseña
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$opciones = [
    // Que los errores de SQL lancen excepciones en vez de fallar en silencio
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    // Devolver arrays asociativos ['email' => ...] en vez de mezclados
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    // Usar sentencias preparadas reales del driver (más seguro)
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $opciones);
} catch (PDOException $e) {
    // No mostramos el mensaje real de la excepción al usuario final:
    // podría filtrar detalles de la base de datos.
    error_log($e->getMessage());
    die('No se pudo conectar a la base de datos. Intenta más tarde.');
}
