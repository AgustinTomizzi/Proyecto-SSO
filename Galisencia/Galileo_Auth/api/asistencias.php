<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    api_requerir_permiso("asistencia.ver");
    $where = [];
    $params = [];

    if (!empty($_GET["alumnoId"])) {
        $alumnoId = (int) $_GET["alumnoId"];
        api_requerir_alumno_en_alcance($pdo, $alumnoId);
        $where[] = "s.alumno_id = ?";
        $params[] = $alumnoId;
    } else {
        [$scopeSql, $scopeParams] = api_alumnos_scope_sql($pdo, "a");
        if ($scopeSql !== null) {
            $where[] = $scopeSql;
            array_push($params, ...$scopeParams);
        }
    }
    if (!empty($_GET["fecha"])) {
        $where[] = "s.fecha = ?";
        $params[] = $_GET["fecha"];
    }
    if (!empty($_GET["materia"])) {
        $where[] = "s.materia = ?";
        $params[] = $_GET["materia"];
    }

    $sql = "
        SELECT s.id_asistencia AS id, s.alumno_id AS alumnoId, s.materia, s.fecha, s.estado
        FROM asistencias s
        INNER JOIN alumnos a ON a.id_alumno = s.alumno_id
    ";
    if ($where) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $sql .= " ORDER BY s.fecha";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "registros" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("asistencia.registrar");
    $data = api_body();
    $alumnoId = (int) ($data["alumnoId"] ?? 0);
    $materia = trim((string) ($data["materia"] ?? ""));
    $fecha = trim((string) ($data["fecha"] ?? ""));
    $estado = trim((string) ($data["estado"] ?? "presente"));
    if ($alumnoId <= 0 || $materia === "" || $fecha === "") {
        api_json(["ok" => false, "error" => "faltan datos"], 400);
    }
    if (!in_array($estado, ["presente", "tarde", "ausente"], true)) {
        api_json(["ok" => false, "error" => "estado invalido"], 400);
    }

    api_requerir_alumno_en_alcance($pdo, $alumnoId);

    $stmt = $pdo->prepare("SELECT id_asistencia, estado FROM asistencias WHERE alumno_id = ? AND materia = ? AND fecha = ? LIMIT 1");
    $stmt->execute([$alumnoId, $materia, $fecha]);
    $existente = $stmt->fetch();
    if ($existente) {
        $pdo->prepare("UPDATE asistencias SET estado = ? WHERE id_asistencia = ?")
            ->execute([$estado, $existente["id_asistencia"]]);
        $id = $existente["id_asistencia"];
    } else {
        $pdo->prepare("INSERT INTO asistencias (fecha, estado, alumno_id, materia) VALUES (?, ?, ?, ?)")
            ->execute([$fecha, $estado, $alumnoId, $materia]);
        $id = $pdo->lastInsertId();
    }

    registrarAuditoria("asistencias.registrar", "asistencia", $id, [
        "alumno_id" => $alumnoId,
        "materia" => $materia,
        "fecha" => $fecha,
        "estado_anterior" => $existente["estado"] ?? null,
        "estado_nuevo" => $estado,
    ]);

    api_json(["ok" => true, "registro" => [
        "id" => (string) $id,
        "alumnoId" => (string) $alumnoId,
        "materia" => $materia,
        "fecha" => $fecha,
        "estado" => $estado,
    ]]);
}

api_json(["ok" => false, "error" => "metodo no permitido"], 405);
