<?php

session_start();

require_once __DIR__ . "/../config/database.php";


if (!isset($_SESSION["id_usuario"])) {

    header("Location: ../login.php");
    exit;

}


if ($_SESSION["rol"] !== "Administrador") {

    http_response_code(403);

    die("No tenés permisos para acceder.");

}


$rolId = isset($_GET["rol"])
    ? intval($_GET["rol"])
    : 0;


if ($rolId <= 0) {

    die("Rol inválido.");

}


/*
|--------------------------------------------------------------------------
| Obtener rol
|--------------------------------------------------------------------------
*/

$stmt = $pdo->prepare("
    SELECT
        id_rol,
        nombre

    FROM roles

    WHERE id_rol = ?
");

$stmt->execute([$rolId]);

$rol = $stmt->fetch(PDO::FETCH_ASSOC);


if (!$rol) {

    die("El rol no existe.");

}


/*
|--------------------------------------------------------------------------
| Guardar permisos
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {


    $permisosSeleccionados =
        isset($_POST["permisos"])
        ? $_POST["permisos"]
        : [];


    /*
     * Primero eliminamos
     * los permisos anteriores
     */

    $stmt = $pdo->prepare("
        DELETE FROM rol_permiso

        WHERE rol_id = ?
    ");

    $stmt->execute([$rolId]);


    /*
     * Agregamos los nuevos permisos
     */

    $stmt = $pdo->prepare("
        INSERT INTO rol_permiso
        (
            rol_id,
            permiso_id
        )

        VALUES (?, ?)
    ");


    foreach ($permisosSeleccionados as $permisoId) {

        $stmt->execute([
            $rolId,
            intval($permisoId)
        ]);

    }


    header(
        "Location: permisos.php?rol="
        . $rolId
        . "&guardado=1"
    );

    exit;

}


/*
|--------------------------------------------------------------------------
| Obtener todos los permisos
|--------------------------------------------------------------------------
*/

$stmt = $pdo->query("
    SELECT
        id_permiso,
        nombre,
        descripcion

    FROM permisos

    ORDER BY nombre ASC
");

$permisos = $stmt->fetchAll(
    PDO::FETCH_ASSOC
);


/*
|--------------------------------------------------------------------------
| Obtener permisos actuales del rol
|--------------------------------------------------------------------------
*/

$stmt = $pdo->prepare("
    SELECT permiso_id

    FROM rol_permiso

    WHERE rol_id = ?
");

$stmt->execute([$rolId]);

$permisosActuales = $stmt->fetchAll(
    PDO::FETCH_COLUMN
);

?>

<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>
        Permisos - <?= htmlspecialchars($rol["nombre"]) ?>
    </title>

</head>

<body>


<h1>

    Permisos del rol:

    <?= htmlspecialchars($rol["nombre"]) ?>

</h1>


<?php if (isset($_GET["guardado"])): ?>

    <p style="color: green;">

        Permisos guardados correctamente.

    </p>

<?php endif; ?>


<form method="POST">


    <?php foreach ($permisos as $permiso): ?>


        <div>

            <label>


                <input

                    type="checkbox"

                    name="permisos[]"

                    value="<?= $permiso["id_permiso"] ?>"

                    <?= in_array(
                        $permiso["id_permiso"],
                        $permisosActuales
                    )
                        ? "checked"
                        : "" ?>

                >


                <strong>

                    <?= htmlspecialchars(
                        $permiso["nombre"]
                    ) ?>

                </strong>


            </label>


            <br>


            <small>

                <?= htmlspecialchars(
                    $permiso["descripcion"]
                ) ?>

            </small>


        </div>


        <br>


    <?php endforeach; ?>


    <button type="submit">

        Guardar permisos

    </button>


</form>


<br>


<a href="roles.php">

    Volver a roles

</a>


</body>

</html>