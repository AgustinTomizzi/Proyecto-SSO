<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST"]);
$usuarioId = (int) ($_SESSION["id_usuario"] ?? 0);

if ($method === "GET") {
    api_requerir_permiso("asistencia.ver");
    $where = ["a.estado = 1"];
    $params = [];

    if (isset($_GET["alumnoId"]) && $_GET["alumnoId"] !== "") {
        $alumnoId = api_id_positivo($_GET["alumnoId"]);
        if ($alumnoId === null) {
            api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
        }
        $where[] = "asi.alumno_id = ?";
        $params[] = $alumnoId;
    }
    if (isset($_GET["fecha"]) && $_GET["fecha"] !== "") {
        $fecha = trim((string) $_GET["fecha"]);
        if (!api_fecha_valida($fecha)) {
            api_json(["ok" => false, "error" => "fecha invalida; use el formato YYYY-MM-DD"], 400);
        }
        $where[] = "asi.fecha = ?";
        $params[] = $fecha;
    }
    if (api_pide_materia($_GET)) {
        $materiaFiltro = api_resolver_materia($_GET["materiaId"] ?? null, $_GET["materia"] ?? null);
        if ($materiaFiltro === null) {
            api_json(["ok" => false, "error" => "materia inexistente"], 400);
        }
        $where[] = "asi.materia_id = ?";
        $params[] = $materiaFiltro["id"];
    }
    if (isset($_GET["cursoId"]) && $_GET["cursoId"] !== "") {
        $cursoId = api_id_positivo($_GET["cursoId"]);
        if ($cursoId === null) {
            api_json(["ok" => false, "error" => "cursoId debe ser un entero positivo"], 400);
        }
        $where[] = "a.curso_id = ?";
        $params[] = $cursoId;
    }
    if (isset($_GET["ciclo"]) && trim((string) $_GET["ciclo"]) !== "") {
        $ciclo = trim((string) $_GET["ciclo"]);
        if (!preg_match('/^\d{4}$/', $ciclo)) {
            api_json(["ok" => false, "error" => "ciclo debe ser un año de cuatro dígitos"], 400);
        }
        $where[] = "YEAR(asi.fecha) = ?";
        $params[] = (int) $ciclo;
    }

    if (api_rol_es("Alumno")) {
        $where[] = "a.usuario_id = ?";
        $params[] = $usuarioId;
    } elseif (api_rol_es("Tutor")) {
        [$condicion, $extra] = api_sql_alumno_del_tutor($usuarioId, "a.id_alumno");
        $where[] = $condicion;
        array_push($params, ...$extra);
    } elseif (api_rol_es("Preceptor")) {
        [$condicion, $extra] = api_sql_curso_del_preceptor($usuarioId, "a.curso_id");
        $where[] = $condicion;
        array_push($params, ...$extra);
    } elseif (api_rol_es("Docente")) {
        [$condicion, $extra] = api_sql_docente_dicta($usuarioId, "a.curso_id", "asi.materia_id");
        $where[] = $condicion;
        array_push($params, ...$extra);
    }

    // Paginación: limit 1..500 (500 por defecto) y page desde 1.
    $limite = filter_var($_GET["limit"] ?? 500, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 500]]);
    $pagina = filter_var($_GET["page"] ?? 1, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    if ($limite === false || $pagina === false) {
        api_json(["ok" => false, "error" => "limit debe estar entre 1 y 500 y page ser un entero positivo"], 400);
    }

    $desde = " FROM asistencias asi INNER JOIN alumnos a ON a.id_alumno = asi.alumno_id INNER JOIN materias m ON m.id_materia = asi.materia_id LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE " . implode(" AND ", $where);
    $stmt = $pdo->prepare("SELECT COUNT(*)" . $desde);
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    // limit y offset son enteros validados: se interpolan para evitar que el
    // driver los envíe como texto.
    $stmt = $pdo->prepare("SELECT asi.id_asistencia AS id, asi.alumno_id AS alumnoId, asi.materia_id AS materiaId, m.nombre AS materia, asi.fecha, asi.estado, asi.justificacion_id AS justificacionId" . $desde . " ORDER BY asi.fecha, asi.id_asistencia LIMIT " . (int) $limite . " OFFSET " . (int) (($pagina - 1) * $limite));
    $stmt->execute($params);
    api_json(["ok" => true, "registros" => $stmt->fetchAll(), "total" => $total, "page" => $pagina, "limit" => $limite]);
}

api_requerir_permiso("asistencia.registrar");
$d = api_body();
$alumnoId = api_id_positivo($d["alumnoId"] ?? null);
$materia = api_pide_materia($d) ? api_resolver_materia($d["materiaId"] ?? null, $d["materia"] ?? null) : null;
$fecha = trim((string) ($d["fecha"] ?? ""));
$estado = trim((string) ($d["estado"] ?? ""));

if ($alumnoId === null) {
    api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
}
if ($materia === null) {
    api_json(["ok" => false, "error" => api_pide_materia($d) ? "materia inexistente" : "materiaId es requerido"], 400);
}
if (!api_fecha_valida($fecha)) {
    api_json(["ok" => false, "error" => "fecha invalida; use el formato YYYY-MM-DD"], 400);
}
// "justificado" no se carga a mano: sale de una justificación (justificaciones.php).
if (!in_array($estado, ["presente", "tarde", "ausente"], true)) {
    api_json(["ok" => false, "error" => "estado debe ser presente, tarde o ausente"], 400);
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("SELECT a.id_alumno, a.usuario_id, a.curso_id, c.preceptor_id FROM alumnos a LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE a.id_alumno = ? AND a.estado = 1 FOR UPDATE");
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();
    if (!$alumno) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no existe o esta inactivo"], 400);
    }

    if (api_rol_es("Alumno")) {
        if ((int) $alumno["usuario_id"] !== $usuarioId) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "solo podes operar sobre tu propia asistencia"], 403);
        }
    } elseif (api_rol_es("Preceptor") && !in_array((int) $alumno["curso_id"], api_cursos_del_preceptor($usuarioId), true)) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos asignados"], 403);
    } elseif (api_rol_es("Docente") && !api_docente_dicta($usuarioId, $alumno["curso_id"], $materia["id"])) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "no dictás esa materia en el curso del alumno"], 403);
    }

    // Una ausencia en una fecha cubierta por una justificación queda justificada.
    $justificacionId = null;
    if ($estado === "ausente") {
        $stmt = $pdo->prepare("SELECT id_justificacion FROM justificaciones WHERE alumno_id = ? AND ? BETWEEN desde AND hasta ORDER BY id_justificacion DESC LIMIT 1");
        $stmt->execute([$alumnoId, $fecha]);
        $justificacionId = $stmt->fetchColumn() ?: null;
        if ($justificacionId !== null) {
            $estado = "justificado";
        }
    }

    $stmt = $pdo->prepare("SELECT id_asistencia, alumno_id, materia_id, fecha, estado FROM asistencias WHERE alumno_id = ? AND materia_id = ? AND fecha = ? LIMIT 1 FOR UPDATE");
    $stmt->execute([$alumnoId, $materia["id"], $fecha]);
    $antes = $stmt->fetch();
    if ($antes) {
        if (!api_tiene_permiso("asistencia.editar")) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "sin permiso para editar una asistencia existente"], 403);
        }
        $pdo->prepare("UPDATE asistencias SET estado = ?, justificacion_id = ? WHERE id_asistencia = ?")->execute([$estado, $justificacionId, $antes["id_asistencia"]]);
        $id = $antes["id_asistencia"];
        $accion = "asistencia.editar";
    } else {
        $pdo->prepare("INSERT INTO asistencias (fecha, estado, justificacion_id, alumno_id, materia_id) VALUES (?, ?, ?, ?, ?)")->execute([$fecha, $estado, $justificacionId, $alumnoId, $materia["id"]]);
        $id = $pdo->lastInsertId();
        $accion = "asistencia.registrar";
    }

    $despues = ["alumno_id" => $alumnoId, "materia_id" => $materia["id"], "materia" => $materia["nombre"], "fecha" => $fecha, "estado" => $estado];
    registrarAuditoria($accion, "asistencia", $id, ["antes" => $antes ?: null, "despues" => $despues]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

// Aviso diario a las familias (se recalcula con cada cambio del día).
notif_inasistencias($alumnoId, $fecha);

api_json(["ok" => true, "registro" => ["id" => (string) $id, "alumnoId" => (string) $alumnoId, "materiaId" => (string) $materia["id"], "materia" => $materia["nombre"], "fecha" => $fecha, "estado" => $estado]]);
