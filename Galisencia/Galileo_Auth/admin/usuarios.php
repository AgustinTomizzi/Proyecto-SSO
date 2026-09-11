<?php

session_start();

require_once __DIR__ . "/../config/database.php";


// Comprobar que haya iniciado sesión

if (!isset($_SESSION["id_usuario"])) {

    header("Location: ../login.php");
    exit;

}


// Comprobar que sea administrador

if ($_SESSION["rol"] !== "Administrador") {

    http_response_code(403);

    die("No tenés permisos para acceder a esta sección.");

}


// Obtener usuarios

$sql = "
    SELECT
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.email,
        u.rol_id,
        r.nombre AS rol

    FROM usuarios u

    INNER JOIN roles r
        ON u.rol_id = r.id_rol

    ORDER BY u.apellido ASC
";

$stmt = $pdo->query($sql);

$usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Gestión de usuarios</title>

</head>

<body>

    <h1>Gestión de usuarios</h1>

    <a href="../dashboard.php">
        Volver al dashboard
    </a>

    <br><br>

    <a href="../crear_usuario.php">
        + Crear usuario
    </a>

    <br><br>


    <table border="1" cellpadding="10">

        <tr>

            <th>ID</th>

            <th>Nombre</th>

            <th>Apellido</th>

            <th>Email</th>

            <th>Rol</th>

        </tr>


        <?php foreach ($usuarios as $usuario): ?>

            <tr>

                <td>
                    <?= $usuario["id_usuario"] ?>
                </td>

                <td>
                    <?= htmlspecialchars($usuario["nombre"]) ?>
                </td>

                <td>
                    <?= htmlspecialchars($usuario["apellido"]) ?>
                </td>

                <td>
                    <?= htmlspecialchars($usuario["email"]) ?>
                </td>

                <td>
                    <?= htmlspecialchars($usuario["rol"]) ?>
                </td>

            </tr>

        <?php endforeach; ?>

    </table>

</body>

</html>