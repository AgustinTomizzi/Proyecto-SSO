<?php

session_start();

require_once "Galileo_Auth/config/database.php";


if (!isset($_SESSION["usuario_id"])) {

    header("Location: Galileo_Auth/login.php");
    exit;

}


if ($_SESSION["rol"] !== "Administrador") {

    http_response_code(403);

    die("No tenés permisos para acceder.");

}


// Obtener roles

$sql = "
    SELECT
        id_rol,
        nombre

    FROM roles

    ORDER BY nombre ASC
";

$stmt = $pdo->query($sql);

$roles = $stmt->fetchAll(PDO::FETCH_ASSOC);

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Roles</title>

</head>

<body>

    <h1>Gestión de roles</h1>


    <a href="../dashboard.php">
        Volver al dashboard
    </a>

    <br><br>


    <table border="1" cellpadding="10">

        <tr>

            <th>ID</th>

            <th>Nombre</th>

            <th>Acciones</th>

        </tr>


        <?php foreach ($roles as $rol): ?>

            <tr>

                <td>
                    <?= $rol["id_rol"] ?>
                </td>

                <td>
                    <?= htmlspecialchars($rol["nombre"]) ?>
                </td>

                <td>

                    <a
                        href="permisos.php?rol=<?= $rol["id_rol"] ?>"
                    >
                        Administrar permisos
                    </a>

                </td>

            </tr>

        <?php endforeach; ?>

    </table>

</body>

</html>