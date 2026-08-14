<?php
require_once 'config/conexion.php';
require_once 'config/funciones.php';

$errores = [];
$nombre = $email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nombre = limpiar($_POST['nombre'] ?? '');
    $email  = limpiar($_POST['email'] ?? '');
    $password  = $_POST['password'] ?? '';
    $password2 = $_POST['password2'] ?? '';

    // --- Validaciones ---
    if ($nombre === '') {
        $errores[] = 'El nombre es obligatorio.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errores[] = 'El email no es válido.';
    }
    if (strlen($password) < 8) {
        $errores[] = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if ($password !== $password2) {
        $errores[] = 'Las contraseñas no coinciden.';
    }

    // Verificar que el email no exista ya
    if (empty($errores)) {
        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE email = :email');
        $stmt->execute(['email' => $email]);
        if ($stmt->fetch()) {
            $errores[] = 'Ya existe una cuenta con ese email.';
        }
    }

    // Si todo está bien, crear el usuario
    if (empty($errores)) {
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare(
            'INSERT INTO usuarios (nombre, email, password) VALUES (:nombre, :email, :password)'
        );
        $stmt->execute([
            'nombre'   => $nombre,
            'email'    => $email,
            'password' => $hash,
        ]);

        header('Location: login.php?registrado=1');
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Crear cuenta</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<div class="caja">
    <h1>Crear cuenta</h1>

    <?php if ($errores): ?>
        <div class="alerta alerta-error">
            <ul>
                <?php foreach ($errores as $error): ?>
                    <li><?= limpiar($error) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <form method="post" action="registro.php" novalidate>
        <label for="nombre">Nombre</label>
        <input type="text" id="nombre" name="nombre" value="<?= limpiar($nombre) ?>" required>

        <label for="email">Email</label>
        <input type="email" id="email" name="email" value="<?= limpiar($email) ?>" required>

        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" required minlength="8">

        <label for="password2">Repetir contraseña</label>
        <input type="password" id="password2" name="password2" required minlength="8">

        <button type="submit">Crear cuenta</button>
    </form>

    <p class="link-secundario">¿Ya tienes cuenta? <a href="login.php">Inicia sesión</a></p>
</div>
</body>
</html>
