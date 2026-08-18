<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    api_requerir_permiso("notas.ver");
    $params = [];
    $where = [];
    if (!empty($_GET["alumnoId"])) {
        $where[] = "alumno_id = ?";
        $params[] = (int) $_GET["alumnoId"];
    }
    $sql = "SELECT id_nota AS id, alumno_id AS alumnoId, materia, fecha, nota FROM notas";
    if ($where) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
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
    if ($alumnoId <= 0 || $materia === "") {
        api_json(["ok" => false, "error" => "faltan datos"], 400);
    }
    $pdo->prepare("INSERT INTO notas (nota, fecha, alumno_id, materia) VALUES (?, CURDATE(), ?, ?)")
        ->execute([$nota !== "" ? $nota : null, $alumnoId, $materia]);
    api_json(["ok" => true]);
}
