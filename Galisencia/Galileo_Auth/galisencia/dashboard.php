<?php

require_once "../includes/auth.php";
require_once "../includes/permisos.php";

requerirLogin();

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Galisencia</title>

</head>

<body>

    <h1>Galisencia</h1>

    <p>
        Bienvenido
        <?= htmlspecialchars($_SESSION["nombre"]) ?>
    </p>

    <p>
        Rol:
        <?= htmlspecialchars($_SESSION["rol"]) ?>
    </p>


    <hr>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "asistencia.ver"
        )
    ):
    ?>

        <a href="asistencia.php">
            Asistencia
        </a>

        <br><br>

    <?php endif; ?>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "alumnos.ver"
        )
    ):
    ?>

        <a href="alumnos.php">
            Alumnos
        </a>

    <?php endif; ?>


    <br><br>

    <a href="../dashboard.php">
        Volver
    </a>

</body>

</html>