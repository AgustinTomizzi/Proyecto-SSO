<?php

require_once "includes/auth.php";
require_once "includes/permisos.php";
require_once "config/database.php";

requerirLogin();

if ($_SESSION["rol"] !== "Administrador") {

    http_response_code(403);

    die("No tenés permiso.");
}


$mensaje = "";
$error = "";


if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $nombre = trim($_POST["nombre"]);
    $apellido = trim($_POST["apellido"]);
    $email = trim($_POST["email"]);
    $contrasena = $_POST["contrasena"];
    $rolId = intval($_POST["rol_id"]);


    if (
        $nombre === "" ||
        $apellido === "" ||
        $email === "" ||
        $contrasena === ""
    ) {

        $error = "Completá todos los campos.";

    } else {

        $hash = password_hash(
            $contrasena,
            PASSWORD_DEFAULT
        );


        try {

            $sql = "
                INSERT INTO usuarios
                (
                    nombre,
                    apellido,
                    email,
                    contrasena,
                    rol_id
                )

                VALUES (?, ?, ?, ?, ?)
            ";

            $stmt = $pdo->prepare($sql);

            $stmt->execute([
                $nombre,
                $apellido,
                $email,
                $hash,
                $rolId
            ]);


            $mensaje =
                "Usuario creado correctamente.";

        } catch (PDOException $e) {

            $error =
                "No se pudo crear el usuario.";
        }
    }
}


$roles = $pdo
    ->query(
        "SELECT id_rol, nombre
         FROM roles
         ORDER BY nombre"
    )
    ->fetchAll();

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Crear usuario</title>

</head>

<body>

    <h1>Crear usuario</h1>


    <?php if ($mensaje): ?>

        <p style="color:green;">
            <?= htmlspecialchars($mensaje) ?>
        </p>

    <?php endif; ?>


    <?php if ($error): ?>

        <p style="color:red;">
            <?= htmlspecialchars($error) ?>
        </p>

    <?php endif; ?>


    <form method="POST">


        <label>
            Nombre
        </label>

        <br>

        <input
            type="text"
            name="nombre"
            required
        >

        <br><br>


        <label>
            Apellido
        </label>

        <br>

        <input
            type="text"
            name="apellido"
            required
        >

        <br><br>


        <label>
            Email
        </label>

        <br>

        <input
            type="email"
            name="email"
            required
        >

        <br><br>


        <label>
            Contraseña
        </label>

        <br>

        <input
            type="password"
            name="contrasena"
            required
        >

        <br><br>


        <label>
            Rol
        </label>

        <br>

        <select name="rol_id" required>

            <?php foreach ($roles as $rol): ?>

                <option
                    value="<?= $rol["id_rol"] ?>"
                >

                    <?= htmlspecialchars(
                        $rol["nombre"]
                    ) ?>

                </option>

            <?php endforeach; ?>

        </select>


        <br><br>


        <button type="submit">
            Crear usuario
        </button>

    </form>


    <br>

    <a href="dashboard.php">
        Volver
    </a>

</body>

</html>