<?php

header('Content-Type: application/json; charset=utf-8');

// ==========================================
// CONEXIÓN
// ==========================================

require_once __DIR__ . '/../config/conexion.php';

try {

    // ==========================================
    // TOTAL DE RESERVAS
    // ==========================================

    $consulta = $pdo->query("
        SELECT COUNT(*) AS total
        FROM reservas
    ");

    $totalReservas = $consulta->fetch()['total'];


    // ==========================================
    // TOTAL DE USUARIOS
    // ==========================================

    $consulta = $pdo->query("
        SELECT COUNT(*) AS total
        FROM usuarios
    ");

    $totalUsuarios = $consulta->fetch()['total'];


    // ==========================================
    // TOTAL DE RECURSOS
    // ==========================================

    $consulta = $pdo->query("
        SELECT COUNT(*) AS total
        FROM recursos
    ");

    $totalRecursos = $consulta->fetch()['total'];


    // ==========================================
    // RECURSOS DISPONIBLES
    // ==========================================

    $consulta = $pdo->query("
        SELECT COUNT(*) AS total
        FROM recursos
        WHERE estado = 1
    ");

    $recursosDisponibles = $consulta->fetch()['total'];


    // ==========================================
    // RECURSOS NO DISPONIBLES
    // ==========================================

    $consulta = $pdo->query("
        SELECT COUNT(*) AS total
        FROM recursos
        WHERE estado = 0
    ");

    $recursosNoDisponibles = $consulta->fetch()['total'];


    // ==========================================
    // RESERVAS POR USUARIO
    // ==========================================

    $consulta = $pdo->query("
        SELECT
            u.id_usuario,
            u.nombre,
            u.apellido,
            COUNT(r.id_reservas) AS cantidad_reservas

        FROM usuarios u

        LEFT JOIN reservas r
            ON u.id_usuario = r.usuario_id

        GROUP BY
            u.id_usuario,
            u.nombre,
            u.apellido

        ORDER BY cantidad_reservas DESC
    ");

    $reservasPorUsuario = $consulta->fetchAll();


    // ==========================================
    // RESERVAS POR RECURSO
    // ==========================================

    $consulta = $pdo->query("
        SELECT
            re.id_recurso,
            re.nombre_lab,
            re.tipo_recurso,
            COUNT(r.id_reservas) AS cantidad_reservas

        FROM recursos re

        LEFT JOIN reservas r
            ON re.id_recurso = r.recurso_id

        GROUP BY
            re.id_recurso,
            re.nombre_lab,
            re.tipo_recurso

        ORDER BY cantidad_reservas DESC
    ");

    $reservasPorRecurso = $consulta->fetchAll();


    // ==========================================
    // RESERVAS POR FECHA
    // ==========================================

    $consulta = $pdo->query("
        SELECT
            fecha,
            COUNT(*) AS cantidad_reservas

        FROM reservas

        GROUP BY fecha

        ORDER BY fecha DESC
    ");

    $reservasPorFecha = $consulta->fetchAll();


    // ==========================================
    // RESERVAS POR HORARIO
    // ==========================================

    $consulta = $pdo->query("
        SELECT
            HOUR(horario) AS hora,
            COUNT(*) AS cantidad_reservas

        FROM reservas

        GROUP BY HOUR(horario)

        ORDER BY cantidad_reservas DESC
    ");

    $reservasPorHorario = $consulta->fetchAll();


    // ==========================================
    // RESPUESTA
    // ==========================================

    echo json_encode([
        'estado' => 'ok',

        'resumen' => [
            'total_reservas' => (int) $totalReservas,
            'total_usuarios' => (int) $totalUsuarios,
            'total_recursos' => (int) $totalRecursos,
            'recursos_disponibles' => (int) $recursosDisponibles,
            'recursos_no_disponibles' => (int) $recursosNoDisponibles
        ],

        'reservas_por_usuario' => $reservasPorUsuario,

        'reservas_por_recurso' => $reservasPorRecurso,

        'reservas_por_fecha' => $reservasPorFecha,

        'reservas_por_horario' => $reservasPorHorario
    ]);

} catch (PDOException $e) {

    error_log($e->getMessage());

    echo json_encode([
        'estado' => 'error',
        'mensaje' => 'No se pudieron obtener los reportes.'
    ]);
}