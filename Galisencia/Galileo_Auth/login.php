<?php

session_start();

require_once "config/database.php";

$error = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $email = trim($_POST["email"]);
    $contrasena = $_POST["contrasena"];

    if ($email === "" || $contrasena === "") {

        $error = "Completá todos los campos.";

    } else {

        $sql = "
            SELECT
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.email,
                u.contrasena,
                u.rol_id,
                r.nombre AS rol

            FROM usuarios u

            INNER JOIN roles r
                ON u.rol_id = r.id_rol

            WHERE u.email = ?

            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            $email
        ]);

        $usuario = $stmt->fetch();

        if (
            $usuario &&
            password_verify(
                $contrasena,
                $usuario["contrasena"]
            )
        ) {

            /*
             * Regeneramos el ID de sesión
             * después del login.
             */
            session_regenerate_id(true);

            $_SESSION["id_usuario"] =
                $usuario["id_usuario"];

            $_SESSION["nombre"] =
                $usuario["nombre"];

            $_SESSION["apellido"] =
                $usuario["apellido"];

            $_SESSION["email"] =
                $usuario["email"];

            $_SESSION["rol_id"] =
                $usuario["rol_id"];

            $_SESSION["rol"] =
                $usuario["rol"];

            header("Location: dashboard.php");
            exit;

        } else {

            $error = "Correo o contraseña incorrectos.";
        }
    }
}

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Galileo Auth - Login</title>

</head>

<body>

    <h1>Galileo Auth</h1>

    <h2>Iniciar sesión</h2>

    <?php if ($error !== ""): ?>

        <p style="color:red;">
            <?= htmlspecialchars($error) ?>
        </p>

    <?php endif; ?>


    <form method="POST">

        <div>

            <label>
                Correo
            </label>

            <br>

            <input
                type="email"
                name="email"
                required
            >

        </div>

        <br>

        <div>

            <label>
                Contraseña
            </label>

            <br>

            <input
                type="password"
                name="contrasena"
                required
            >

        </div>

        <br>

        <button type="submit">
            Iniciar sesión
        </button>

    </form>

</body>

</html>