<?php

require_once __DIR__ . "/../config/database.php";


/**
 * Comprueba si el rol de un usuario puede usar un sistema (rol_sistema).
 * Ej: 'Galiservas' (Alumno/Directivo no tienen acceso).
 */
function tieneAccesoSistema($usuarioId, $sistema)
{
    global $pdo;

    $sql = "
        SELECT COUNT(*)
        FROM usuarios u
        INNER JOIN rol_sistema rs
            ON u.rol_id = rs.rol_id
        INNER JOIN sistemas s
            ON rs.sistema_id = s.id_sistema
        WHERE u.id_usuario = ?
        AND s.nombre = ?
        AND s.activo = 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$usuarioId, $sistema]);
    return $stmt->fetchColumn() > 0;
}


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
    require_once __DIR__ . "/auth.php";

    requerirLogin();

    $usuarioId = usuarioActual();

    if (!tienePermiso($usuarioId, $permiso)) {

        http_response_code(403);

        die("
            <h1>403 - Acceso denegado</h1>
            <p>No tenés permiso para acceder a esta sección.</p>
            <a href='/'>
                Volver al inicio
            </a>
        ");
    }
}
