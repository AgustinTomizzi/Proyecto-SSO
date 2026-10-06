<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST"]);

if ($method === "GET") {
    api_requerir_permiso("notas.ver");
    $params = [];
    $where = ["a.estado = 1"];
    if (isset($_GET["alumnoId"]) && $_GET["alumnoId"] !== "") {
        $alumnoFiltro = api_id_positivo($_GET["alumnoId"]);
        if ($alumnoFiltro === null) {
            api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
        }
        $where[] = "n.alumno_id = ?";
        $params[] = $alumnoFiltro;
    }
    if (api_pide_materia($_GET)) {
        $materiaFiltro = api_resolver_materia($_GET["materiaId"] ?? null, $_GET["materia"] ?? null);
        if ($materiaFiltro === null) {
            api_json(["ok" => false, "error" => "materia inexistente"], 400);
        }
        $where[] = "n.materia_id = ?";
        $params[] = $materiaFiltro["id"];
    }
    if (api_rol_es("Alumno")) {
        $where[] = "a.email = (SELECT email FROM usuarios WHERE id_usuario = ?)";
        $params[] = usuarioActual();
    } elseif (api_rol_es("Preceptor")) {
        $where[] = "c.preceptor_id = ?";
        $params[] = usuarioActual();
    } elseif (api_rol_es("Docente")) {
        [$condicion, $extra] = api_sql_docente_dicta(usuarioActual(), "a.curso_id", "n.materia_id");
        $where[] = $condicion;
        array_push($params, ...$extra);
    }
    $sql = "SELECT n.id_nota AS id, n.alumno_id AS alumnoId, n.materia_id AS materiaId, m.nombre AS materia, n.fecha, n.nota FROM notas n JOIN alumnos a ON a.id_alumno=n.alumno_id JOIN materias m ON m.id_materia = n.materia_id LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE " . implode(" AND ", $where) . " ORDER BY n.fecha, n.id_nota";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "notas" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("notas.crear");
    $d = api_body();
    $alumnoId = (int) ($d["alumnoId"] ?? 0);
    $materia = api_pide_materia($d) ? api_resolver_materia($d["materiaId"] ?? null, $d["materia"] ?? null) : null;
    $nota = trim((string) ($d["nota"] ?? ""));
    $fecha = trim((string) ($d["fecha"] ?? date("Y-m-d")));
    if ($alumnoId <= 0 || $materia === null || !api_fecha_valida($fecha) || !is_numeric($nota) || (float) $nota < 1 || (float) $nota > 10) {
        api_json(["ok" => false, "error" => "alumno, materia existente, fecha válida y nota entre 1 y 10 son requeridos"], 400);
    }
    $stmt = $pdo->prepare("SELECT a.id_alumno, a.curso_id, c.preceptor_id FROM alumnos a LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE a.id_alumno=? AND a.estado=1");
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();
    if (!$alumno) api_json(["ok" => false, "error" => "alumno inexistente o inactivo"], 400);
    if (api_rol_es("Preceptor") && (int) $alumno["preceptor_id"] !== (int) usuarioActual()) {
        api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos"], 403);
    }
    if (api_rol_es("Docente") && !api_docente_dicta(usuarioActual(), $alumno["curso_id"], $materia["id"])) {
        api_json(["ok" => false, "error" => "no dictás esa materia en el curso del alumno"], 403);
    }
    $pdo->prepare("INSERT INTO notas (nota, fecha, alumno_id, materia_id) VALUES (?, ?, ?, ?)")
        ->execute([(float) $nota, $fecha, $alumnoId, $materia["id"]]);
    $notaId = $pdo->lastInsertId();
    registrarAuditoria("notas.crear", "nota", $notaId, ["alumnoId" => $alumnoId, "materiaId" => $materia["id"], "materia" => $materia["nombre"], "fecha" => $fecha, "nota" => (float) $nota]);
    api_json(["ok" => true, "nota" => ["id" => (string) $notaId, "alumnoId" => (string) $alumnoId, "materiaId" => (string) $materia["id"], "materia" => $materia["nombre"], "fecha" => $fecha, "nota" => (float) $nota]]);
}
