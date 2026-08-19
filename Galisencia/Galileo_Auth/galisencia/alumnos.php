<?php

require_once "../includes/auth.php";
require_once "../includes/permisos.php";
require_once "../config/database.php";

requerirPermiso("alumnos.ver");


$sql = "
    SELECT
        a.id_alumno,
        a.nombre,
        a.apellido,
        a.dni,
        c.nombre AS curso

    FROM alumnos a

    INNER JOIN cursos c
        ON a.curso_id = c.id_cursos

    WHERE a.estado = 1

    ORDER BY a.apellido, a.nombre
";

$stmt = $pdo->query($sql);

$alumnos = $stmt->fetchAll();

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>Alumnos</title>

</head>

<body>

    <h1>Alumnos</h1>


    <?php if (count($alumnos) === 0): ?>

        <p>
            No hay alumnos registrados.
        </p>

    <?php else: ?>


        <table border="1">

            <thead>

                <tr>

                    <th>
                        ID
                    </th>

                    <th>
                        Nombre
                    </th>

                    <th>
                        Apellido
                    </th>

                    <th>
                        DNI
                    </th>

                    <th>
                        Curso
                    </th>

                </tr>

            </thead>


            <tbody>

                <?php foreach ($alumnos as $alumno): ?>

                    <tr>

                        <td>
                            <?= $alumno["id_alumno"] ?>
                        </td>

                        <td>
                            <?= htmlspecialchars(
                                $alumno["nombre"]
                            ) ?>
                        </td>

                        <td>
                            <?= htmlspecialchars(
                                $alumno["apellido"]
                            ) ?>
                        </td>

                        <td>
                            <?= htmlspecialchars(
                                $alumno["dni"]
                            ) ?>
                        </td>

                        <td>
                            <?= htmlspecialchars(
                                $alumno["curso"]
                            ) ?>
                        </td>

                    </tr>

                <?php endforeach; ?>

            </tbody>

        </table>


    <?php endif; ?>


    <br>

    <a href="dashboard.php">
        Volver
    </a>

</body>

</html>