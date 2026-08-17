<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    api_requerir_permiso("asistencia.ver");
    $where = [];
    $params = [];
    if (!empty($_GET["alumnoId"])) {
        $where[] = "alumno_id = ?";
        $params[] = (int) $_GET["alumnoId"];
    }
    if (!empty($_GET["fecha"])) {
        $where[] = "fecha = ?";
        $params[] = $_GET["fecha"];
    }
    if (!empty($_GET["materia"])) {
        $where[] = "materia = ?";
        $params[] = $_GET["materia"];
    }
    $sql = "SELECT id_asistencia AS id, alumno_id AS alumnoId, materia, fecha, estado FROM asistencias";
    if ($where) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $sql .= " ORDER BY fecha";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "registros" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("asistencia.registrar");
    $d = api_body();
    $alumnoId = (int) ($d["alumnoId"] ?? 0);
    $materia = trim((string) ($d["materia"] ?? ""));
    $fecha = trim((string) ($d["fecha"] ?? ""));
    $estado = trim((string) ($d["estado"] ?? "presente"));
    if ($alumnoId <= 0 || $materia === "" || $fecha === "") {
        api_json(["ok" => false, "error" => "faltan datos"], 400);
    }
    if (!in_array($estado, ["presente", "tarde", "ausente"], true)) {
        $estado = "presente";
    }
    $stmt = $pdo->prepare("SELECT id_asistencia FROM asistencias WHERE alumno_id = ? AND materia = ? AND fecha = ? LIMIT 1");
    $stmt->execute([$alumnoId, $materia, $fecha]);
    $ex = $stmt->fetch();
    if ($ex) {
        $pdo->prepare("UPDATE asistencias SET estado = ? WHERE id_asistencia = ?")->execute([$estado, $ex["id_asistencia"]]);
        $id = $ex["id_asistencia"];
    } else {
        $pdo->prepare("INSERT INTO asistencias (fecha, estado, alumno_id, materia) VALUES (?, ?, ?, ?)")->execute([$fecha, $estado, $alumnoId, $materia]);
        $id = $pdo->lastInsertId();
    }
    api_json(["ok" => true, "registro" => ["id" => (string) $id, "alumnoId" => (string) $alumnoId, "materia" => $materia, "fecha" => $fecha, "estado" => $estado]]);
}
