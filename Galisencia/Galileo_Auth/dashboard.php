<?php

require_once "includes/auth.php";
require_once "includes/permisos.php";

requerirLogin();

$usuarioId = usuarioActual();

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Dashboard</title>

</head>

<body>

    <h1>Galileo Auth</h1>

    <h2>
        Bienvenido,
        <?= htmlspecialchars($_SESSION["nombre"]) ?>
    </h2>

    <p>
        Rol:
        <strong>
            <?= htmlspecialchars($_SESSION["rol"]) ?>
        </strong>
    </p>


    <hr>


    <h2>Sistemas</h2>


    <?php

    if (
        tienePermiso(
            $usuarioId,
            "asistencia.ver"
        )
    ):
    ?>

        <a href="galisencia/dashboard.php">
            Entrar a Galisencia
        </a>

        <br><br>

    <?php endif; ?>


    <?php

    if (
        tienePermiso($usuarioId, "galiservas.acceder")
    ):
    ?>

        <a href="galiservas/dashboard.php">
            Entrar a Galiservas
        </a>

        <br><br>

    <?php endif; ?>


    <?php

    if (
        $_SESSION["rol"] === "Administrador"
    ):
    ?>

        <hr>

        <h2>Administración</h2>

        <a href="admin/usuarios.php">
            Usuarios
        </a>

        <br><br>

        <a href="admin/roles.php">
            Roles
        </a>

    <?php endif; ?>


    <hr>

    <a href="logout.php">
        Cerrar sesión
    </a>

</body>

</html>
