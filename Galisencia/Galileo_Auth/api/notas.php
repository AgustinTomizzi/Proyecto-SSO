<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST"]);

if ($method === "GET") {
    api_requerir_permiso("notas.ver");
    $params = [];
    $where = ["a.estado = 1"];
    if (!empty($_GET["alumnoId"])) {
        $where[] = "n.alumno_id = ?";
        $params[] = (int) $_GET["alumnoId"];
    }
    if (api_rol_es("Alumno")) {
        $where[] = "a.email = (SELECT email FROM usuarios WHERE id_usuario = ?)";
        $params[] = usuarioActual();
    } elseif (api_rol_es("Preceptor")) {
        $where[] = "c.preceptor_id = ?";
        $params[] = usuarioActual();
    }
    $sql = "SELECT n.id_nota AS id, n.alumno_id AS alumnoId, n.materia, n.fecha, n.nota FROM notas n JOIN alumnos a ON a.id_alumno=n.alumno_id LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE " . implode(" AND ", $where);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "notas" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("notas.crear");
    $d = api_body();
    $alumnoId = (int) ($d["alumnoId"] ?? 0);
    $materia = trim((string) ($d["materia"] ?? ""));
    $nota = trim((string) ($d["nota"] ?? ""));
    $fecha = trim((string) ($d["fecha"] ?? date("Y-m-d")));
    if ($alumnoId <= 0 || $materia === "" || strlen($materia) > 255 || !api_fecha_valida($fecha) || !is_numeric($nota) || (float) $nota < 1 || (float) $nota > 10) {
        api_json(["ok" => false, "error" => "alumno, materia, fecha válida y nota entre 1 y 10 son requeridos"], 400);
    }
    $stmt = $pdo->prepare("SELECT a.id_alumno, c.preceptor_id FROM alumnos a LEFT JOIN cursos c ON c.id_cursos=a.curso_id WHERE a.id_alumno=? AND a.estado=1");
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();
    if (!$alumno) api_json(["ok" => false, "error" => "alumno inexistente o inactivo"], 400);
    if (api_rol_es("Preceptor") && (int) $alumno["preceptor_id"] !== (int) usuarioActual()) {
        api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos"], 403);
    }
    $pdo->prepare("INSERT INTO notas (nota, fecha, alumno_id, materia) VALUES (?, ?, ?, ?)")
        ->execute([(float) $nota, $fecha, $alumnoId, $materia]);
    registrarAuditoria("notas.crear", "nota", $pdo->lastInsertId(), ["alumnoId" => $alumnoId, "materia" => $materia, "fecha" => $fecha, "nota" => (float) $nota]);
    api_json(["ok" => true]);
}
