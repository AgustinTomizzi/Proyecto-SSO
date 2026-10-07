<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_metodo(["GET"]);
$usuarioId = (int) usuarioActual();

// Derecho de acceso (Ley 25.326, art. 14): exporta en JSON todo lo que el
// sistema tiene de una persona.
//   ?alumnoId=12  datos de un alumno: datos.exportar (Administración Académica,
//                 Administrador), el propio alumno o un tutor vinculado.
//   sin alumnoId  los datos de la propia cuenta (cualquier sesión).
// Se descarga como archivo y se audita sin el contenido.

function datos_filas($sql, array $params)
{
    global $pdo;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function datos_descargar($nombre, array $datos)
{
    header("Content-Type: application/json; charset=utf-8");
    header("Content-Disposition: attachment; filename=\"$nombre\"");
    header("Cache-Control: private, no-store");
    echo json_encode(array_merge(["ok" => true, "generadoEn" => date("Y-m-d H:i:s")], $datos), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (isset($_GET["alumnoId"])) {
    $alumnoId = api_id_positivo($_GET["alumnoId"]);
    if ($alumnoId === null) {
        api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
    }
    $alumno = datos_filas("SELECT a.id_alumno AS id, a.nombre, a.apellido, a.dni, a.direccion, a.email, a.estado, a.usuario_id AS usuarioId, CONCAT(c.anio, ' ', c.division) AS curso FROM alumnos a LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE a.id_alumno = ?", [$alumnoId])[0] ?? null;
    $propio = $alumno && api_rol_es("Alumno") && (int) $alumno["usuarioId"] === $usuarioId;
    $tutor = $alumno && api_rol_es("Tutor") && in_array($alumnoId, api_alumnos_del_tutor($usuarioId), true);
    if (!api_tiene_permiso("datos.exportar") && !$propio && !$tutor) {
        api_json(["ok" => false, "error" => "no podés exportar los datos de este alumno"], 403);
    }
    if (!$alumno) {
        api_json(["ok" => false, "error" => "alumno no encontrado"], 404);
    }
    $datos = [
        "alumno" => $alumno,
        "cuenta" => $alumno["usuarioId"] ? (datos_filas("SELECT u.email, r.nombre AS rol FROM usuarios u LEFT JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?", [$alumno["usuarioId"]])[0] ?? null) : null,
        "tutores" => datos_filas("SELECT u.nombre, u.apellido, u.email, ta.parentesco FROM tutor_alumno ta JOIN usuarios u ON u.id_usuario = ta.tutor_id WHERE ta.alumno_id = ?", [$alumnoId]),
        "asistencias" => datos_filas("SELECT asi.fecha, m.nombre AS materia, asi.estado FROM asistencias asi JOIN materias m ON m.id_materia = asi.materia_id WHERE asi.alumno_id = ? ORDER BY asi.fecha, m.nombre", [$alumnoId]),
        "notas" => datos_filas("SELECT n.fecha, m.nombre AS materia, n.nota FROM notas n JOIN materias m ON m.id_materia = n.materia_id WHERE n.alumno_id = ? ORDER BY n.fecha", [$alumnoId]),
        // Sin el archivo adjunto (se descarga aparte desde justificaciones.php).
        "justificaciones" => datos_filas("SELECT desde, hasta, motivo, adjunto IS NOT NULL AS tieneAdjunto, adjunto_nombre AS adjuntoNombre, creado_en AS creadoEn FROM justificaciones WHERE alumno_id = ? ORDER BY desde", [$alumnoId]),
        "movimientos" => datos_filas("SELECT m.tipo, m.ciclo_lectivo AS ciclo, m.fecha, CONCAT(co.anio, ' ', co.division) AS cursoOrigen, CONCAT(cd.anio, ' ', cd.division) AS cursoDestino FROM alumno_movimientos m LEFT JOIN cursos co ON co.id_cursos = m.curso_origen_id LEFT JOIN cursos cd ON cd.id_cursos = m.curso_destino_id WHERE m.alumno_id = ? ORDER BY m.fecha", [$alumnoId]),
    ];
    unset($datos["alumno"]["usuarioId"]);
    registrarAuditoria("privacidad.exportar", "alumno", $alumnoId, ["solicitante" => $propio ? "alumno" : ($tutor ? "tutor" : "administracion")]);
    datos_descargar("datos-alumno-$alumnoId.json", $datos);
}

// Datos de la propia cuenta.
$datos = [
    "cuenta" => datos_filas("SELECT u.nombre, u.apellido, u.email, r.nombre AS rol FROM usuarios u LEFT JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?", [$usuarioId])[0] ?? null,
    "consentimientos" => datos_filas("SELECT version, aceptado_en AS aceptadoEn FROM consentimientos WHERE usuario_id = ? ORDER BY aceptado_en", [$usuarioId]),
    "identidadesInstitucionales" => datos_filas("SELECT proveedor, email, vinculada_en AS vinculadaEn, ultimo_ingreso AS ultimoIngreso FROM usuario_identidades WHERE usuario_id = ?", [$usuarioId]),
    "preferenciasDeAvisos" => datos_filas("SELECT tipo, habilitada FROM notificacion_preferencias WHERE usuario_id = ?", [$usuarioId]),
    "avisos" => datos_filas("SELECT tipo, asunto, estado, creada_en AS creadaEn, enviada_en AS enviadaEn FROM notificaciones WHERE usuario_id = ? ORDER BY id_notificacion", [$usuarioId]),
    "reservas" => datos_filas("SELECT r.name AS recurso, rv.reservation_date AS fecha, rv.start_time AS inicio, rv.end_time AS fin, rv.quantity AS cantidad, rv.reason AS motivo, rv.status AS estado FROM reservations rv JOIN resources r ON r.id_resource = rv.resource_id WHERE rv.user_id = ? ORDER BY rv.reservation_date", [$usuarioId]),
    "alumnosVinculados" => api_rol_es("Tutor") ? api_alumnos_vinculados($usuarioId) : [],
];
registrarAuditoria("privacidad.exportar", "usuario", $usuarioId, ["solicitante" => "propio"]);
datos_descargar("mis-datos.json", $datos);
