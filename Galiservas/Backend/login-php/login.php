<?php
session_start();
require_once 'config/conexion.php';
require_once 'config/funciones.php';

// Si ya hay sesión activa, no tiene sentido ver el login de nuevo
if (!empty($_SESSION['usuario_id'])) {
    header('Location: dashboard.php');
    exit;
}

$errores = [];
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email    = limpiar($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        $errores[] = 'Completa email y contraseña.';
    } else {
        $stmt = $pdo->prepare('SELECT id, nombre, password FROM usuarios WHERE email = :email');
        $stmt->execute(['email' => $email]);
        $usuario = $stmt->fetch();

        // Mensaje genérico a propósito: no decimos si falló el email o
        // la contraseña, para no darle pistas a quien intenta adivinar cuentas.
        if (!$usuario || !password_verify($password, $usuario['password'])) {
            $errores[] = 'Email o contraseña incorrectos.';
        } else {
            // Regenerar el ID de sesión al loguear previene "session fixation"
            session_regenerate_id(true);
            $_SESSION['usuario_id']     = $usuario['id'];
            $_SESSION['usuario_nombre'] = $usuario['nombre'];

            header('Location: dashboard.php');
            exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Iniciar sesión</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<div class="caja">
    <h1>Iniciar sesión</h1>

    <?php if (isset($_GET['registrado'])): ?>
        <div class="alerta alerta-ok">Cuenta creada. Ya puedes iniciar sesión.</div>
    <?php endif; ?>

    <?php if ($errores): ?>
        <div class="alerta alerta-error">
            <ul>
                <?php foreach ($errores as $error): ?>
                    <li><?= limpiar($error) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <form method="post" action="login.php" novalidate>
        <label for="email">Email</label>
        <input type="email" id="email" name="email" value="<?= limpiar($email) ?>" required>

        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" required>

        <button type="submit">Entrar</button>
    </form>

    <p class="link-secundario">¿No tienes cuenta? <a href="registro.php">Regístrate</a></p>
</div>
</body>
</html>
