<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    api_requerir_permiso("notas.ver");
    $params = [];
    $where = [];

    if (!empty($_GET["alumnoId"])) {
        $alumnoId = (int) $_GET["alumnoId"];
        api_requerir_alumno_en_alcance($pdo, $alumnoId);
        $where[] = "n.alumno_id = ?";
        $params[] = $alumnoId;
    } else {
        [$scopeSql, $scopeParams] = api_alumnos_scope_sql($pdo, "a");
        if ($scopeSql !== null) {
            $where[] = $scopeSql;
            array_push($params, ...$scopeParams);
        }
    }

    $sql = "
        SELECT n.id_nota AS id, n.alumno_id AS alumnoId, n.materia, n.fecha, n.nota
        FROM notas n
        INNER JOIN alumnos a ON a.id_alumno = n.alumno_id
    ";
    if ($where) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "notas" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("notas.crear");
    $data = api_body();
    $alumnoId = (int) ($data["alumnoId"] ?? 0);
    $materia = trim((string) ($data["materia"] ?? ""));
    $nota = trim((string) ($data["nota"] ?? ""));
    if ($alumnoId <= 0 || $materia === "") {
        api_json(["ok" => false, "error" => "faltan datos"], 400);
    }

    api_requerir_alumno_en_alcance($pdo, $alumnoId);
    $pdo->prepare("INSERT INTO notas (nota, fecha, alumno_id, materia) VALUES (?, CURDATE(), ?, ?)")
        ->execute([$nota !== "" ? $nota : null, $alumnoId, $materia]);
    $id = $pdo->lastInsertId();

    registrarAuditoria("notas.crear", "nota", $id, [
        "alumno_id" => $alumnoId,
        "materia" => $materia,
        "nota" => $nota !== "" ? $nota : null,
    ]);

    api_json(["ok" => true, "nota" => ["id" => (string) $id]]);
}

api_json(["ok" => false, "error" => "metodo no permitido"], 405);
