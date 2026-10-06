<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_metodo(["GET"]);
api_requerir_permiso("asistencia.ver");

$id = api_id_positivo($_GET["id"] ?? null);
if ($id === null) api_json(["ok" => false, "error" => "id de alumno inválido"], 400);

$stmt = $pdo->prepare("SELECT a.id_alumno AS id, a.nombre, a.apellido, a.email, a.estado, a.curso_id AS cursoId, a.usuario_id, c.preceptor_id FROM alumnos a LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE a.id_alumno=?");
$stmt->execute([$id]);
$alumno = $stmt->fetch();
if (!$alumno) api_json(["ok" => false, "error" => "alumno no encontrado"], 404);

if (api_rol_es("Alumno") && (int) $alumno["usuario_id"] !== (int) usuarioActual()) {
    api_json(["ok" => false, "error" => "solo podés ver tu propio historial"], 403);
}
if (api_rol_es("Preceptor") && (int) $alumno["preceptor_id"] !== (int) usuarioActual()) {
    api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos actuales"], 403);
}
$esDocente = api_rol_es("Docente");
if ($esDocente && !in_array((int) $alumno["cursoId"], api_cursos_del_docente(usuarioActual()), true)) {
    api_json(["ok" => false, "error" => "el alumno no pertenece a uno de los cursos que dictás"], 403);
}
// El Docente solo ve la asistencia de las materias que dicta en el curso del alumno.
$filtroDocente = "";
$paramsAsistencia = [$id];
if ($esDocente) {
    $materiasDocente = api_materias_del_docente(usuarioActual(), (int) $alumno["cursoId"]);
    $filtroDocente = " AND asi.materia_id IN (" . implode(",", array_fill(0, count($materiasDocente), "?")) . ")";
    array_push($paramsAsistencia, ...$materiasDocente);
}

$stmt = $pdo->prepare("SELECT YEAR(asi.fecha) AS ciclo, m.nombre AS materia, COUNT(*) AS clases, SUM(asi.estado='presente') AS presentes, SUM(asi.estado='tarde') AS tardes, SUM(asi.estado='ausente') AS ausentes, ROUND(SUM(CASE asi.estado WHEN 'presente' THEN 1 WHEN 'tarde' THEN .5 ELSE 0 END) / COUNT(*) * 100) AS porcentaje FROM asistencias asi JOIN materias m ON m.id_materia = asi.materia_id WHERE asi.alumno_id=?" . $filtroDocente . " GROUP BY YEAR(asi.fecha), m.id_materia, m.nombre ORDER BY ciclo DESC, m.nombre");
$stmt->execute($paramsAsistencia);
$asistencia = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT m.id_movimiento AS id, m.tipo, m.ciclo_lectivo AS ciclo, m.fecha, CONCAT(co.anio, ' ', co.division) AS cursoOrigen, CONCAT(cd.anio, ' ', cd.division) AS cursoDestino, CONCAT(u.nombre, ' ', u.apellido) AS realizadoPor FROM alumno_movimientos m LEFT JOIN cursos co ON co.id_cursos=m.curso_origen_id LEFT JOIN cursos cd ON cd.id_cursos=m.curso_destino_id JOIN usuarios u ON u.id_usuario=m.realizado_por WHERE m.alumno_id=? ORDER BY m.fecha DESC");
$stmt->execute([$id]);

unset($alumno["usuario_id"], $alumno["preceptor_id"]);
api_json(["ok" => true, "alumno" => $alumno, "asistencia" => $asistencia, "movimientos" => $stmt->fetchAll()]);
