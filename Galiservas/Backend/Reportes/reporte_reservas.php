<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/conexion.php';

try {

    // ==========================================
    // LISTADO COMPLETO DE RESERVAS
    // ==========================================

    $consulta = $pdo->query("
        SELECT
            r.id_reservas,
            r.fecha,
            r.horario,

            u.id_usuario,
            u.nombre,
            u.apellido,
            u.email,

            re.id_recurso,
            re.nombre_lab,
            re.tipo_recurso

        FROM reservas r

        LEFT JOIN usuarios u
            ON r.usuario_id = u.id_usuario

        LEFT JOIN recursos re
            ON r.recurso_id = re.id_recurso

        ORDER BY
            r.fecha DESC,
            r.horario DESC
    ");

    $reservas = $consulta->fetchAll();


    // ==========================================
    // RESPUESTA
    // ==========================================

    echo json_encode([
        'estado' => 'ok',
        'cantidad' => count($reservas),
        'reservas' => $reservas
    ]);

} catch (PDOException $e) {

    error_log($e->getMessage());

    echo json_encode([
        'estado' => 'error',
        'mensaje' => 'No se pudieron obtener las reservas.'
    ]);
}