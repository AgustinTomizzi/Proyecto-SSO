<?php
session_start();
require_once 'config/funciones.php';

// Si no hay sesión activa, manda de vuelta al login
requerirSesion();
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Panel</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<div class="caja">
    <h1>Bienvenido, <?= limpiar($_SESSION['usuario_nombre']) ?></h1>
    <p>Iniciaste sesión correctamente. Esta página solo es visible con sesión activa.</p>
    <a class="boton-secundario" href="logout.php">Cerrar sesión</a>
</div>
</body>
</html>
