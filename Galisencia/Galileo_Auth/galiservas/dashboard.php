<?php

require_once "../includes/auth.php";
require_once "../includes/permisos.php";

requerirPermiso("galiservas.acceder");

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Galiservas</title>

</head>

<body>

    <h1>Galiservas</h1>

    <h2>
        Bienvenido
        <?= htmlspecialchars($_SESSION["nombre"]) ?>
    </h2>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "reservas.crear"
        )
    ):
    ?>

        <a href="#">
            Crear reserva
        </a>

        <br><br>

    <?php endif; ?>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "reservas.editar"
        )
    ):
    ?>

        <a href="#">
            Editar reservas
        </a>

        <br><br>

    <?php endif; ?>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "recursos.ver"
        )
    ):
    ?>

        <a href="#">
            Recursos
        </a>

    <?php endif; ?>


    <br><br>

    <a href="../dashboard.php">
        Volver
    </a>

</body>

</html>
