<?php

require_once __DIR__ . "/Galileo_Auth/config/database.php";


/**
 * Comprueba si un usuario tiene determinado permiso.
 */
function tienePermiso($usuarioId, $permiso)
{
    global $pdo;

    $sql = "
        SELECT COUNT(*)

        FROM usuarios u

        INNER JOIN rol_permiso rp
            ON u.rol_id = rp.rol_id

        INNER JOIN permisos p
            ON rp.permiso_id = p.id_permiso

        WHERE u.id_usuario = ?
        AND p.nombre = ?
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        $usuarioId,
        $permiso
    ]);

    return $stmt->fetchColumn() > 0;
}


/**
 * Obliga a tener un permiso.
 */
function requerirPermiso($permiso)
{
    require_once __DIR__ . "/Galileo_Auth/auth.php";

    requerirLogin();

    $usuarioId = usuarioActual();

    if (!tienePermiso($usuarioId, $permiso)) {

        http_response_code(403);

        die("
            <h1>403 - Acceso denegado</h1>
            <p>No tenés permiso para acceder a esta sección.</p>
            <a href='/galileo-auth/dashboard.php'>
                Volver al inicio
            </a>
        ");
    }
}