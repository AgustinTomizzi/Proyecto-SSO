<?php

require_once "../includes/auth.php";
require_once "../includes/permisos.php";

requerirPermiso("asistencia.ver");

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Asistencia - Galisencia</title>

</head>

<body>

    <h1>Asistencia</h1>

    <p>
        Esta página solamente puede ser utilizada
        por usuarios que tengan el permiso:
    </p>

    <strong>
        asistencia.ver
    </strong>


    <hr>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "asistencia.registrar"
        )
    ):
    ?>

        <h2>
            Registrar asistencia
        </h2>

        <!-- Acá después ponemos el formulario -->

        <button>
            Registrar asistencia
        </button>

    <?php endif; ?>


    <?php

    if (
        tienePermiso(
            usuarioActual(),
            "asistencia.editar"
        )
    ):
    ?>

        <h2>
            Editar asistencia
        </h2>

        <button>
            Editar asistencia
        </button>

    <?php endif; ?>


    <br><br>

    <a href="dashboard.php">
        Volver a Galisencia
    </a>

</body>

</html>