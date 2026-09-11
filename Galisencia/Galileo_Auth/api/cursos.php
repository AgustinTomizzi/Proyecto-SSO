<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "PUT"]);

if ($method === "GET") {
    api_requerir_permiso("cursos.ver");
    $sql = "
        SELECT c.id_cursos AS id, c.anio, c.division, c.turno,
               c.preceptor_id AS preceptorId,
               COALESCE(NULLIF(TRIM(CONCAT(u.nombre, ' ', u.apellido)), ''), c.preceptor) AS preceptor
        FROM cursos c
        LEFT JOIN usuarios u ON u.id_usuario = c.preceptor_id
    ";
    $params = [];
    if (strcasecmp($_SESSION["rol"] ?? "", "Preceptor") === 0) {
        $sql .= " WHERE c.preceptor_id = ?";
        $params[] = usuarioActual();
    }
    $sql .= " ORDER BY c.anio, c.division, c.turno";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "cursos" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("cursos.crear");
    $d = api_body();
    $anio = trim((string) ($d["anio"] ?? ""));
    $division = trim((string) ($d["division"] ?? ""));
    $turno = trim((string) ($d["turno"] ?? ""));
    if ($anio === "" || $division === "" || $turno === "" || !in_array($turno, ["Mañana", "Tarde", "Noche"], true)) {
        api_json(["ok" => false, "error" => "anio, division y turno valido son requeridos"], 400);
    }
    $exists = $pdo->prepare("SELECT 1 FROM cursos WHERE anio = ? AND division = ? AND turno = ?");
    $exists->execute([$anio, $division, $turno]);
    if ($exists->fetchColumn()) {
        api_json(["ok" => false, "error" => "el curso ya existe"], 409);
    }
    $pdo->prepare("INSERT INTO cursos (anio, division, turno) VALUES (?, ?, ?)")->execute([$anio, $division, $turno]);
    $id = (int) $pdo->lastInsertId();
    registrarAuditoria("cursos.crear", "curso", $id, ["anio" => $anio, "division" => $division, "turno" => $turno]);
    api_json(["ok" => true, "curso" => ["id" => $id, "anio" => $anio, "division" => $division, "turno" => $turno, "preceptorId" => null, "preceptor" => null]], 201);
}

api_requerir_permiso("cursos.asignar");
$d = api_body();
$id = (int) ($d["id"] ?? 0);
$preceptorId = isset($d["preceptorId"]) && $d["preceptorId"] !== "" ? (int) $d["preceptorId"] : null;
$stmt = $pdo->prepare("SELECT preceptor_id, preceptor FROM cursos WHERE id_cursos = ?");
$stmt->execute([$id]);
$anterior = $stmt->fetch();
if ($id <= 0 || !$anterior) {
    api_json(["ok" => false, "error" => "curso no encontrado"], 404);
}
$nombre = null;
if ($preceptorId !== null) {
    if ($preceptorId <= 0) {
        api_json(["ok" => false, "error" => "preceptorId invalido"], 400);
    }
    $stmt = $pdo->prepare("SELECT CONCAT(u.nombre, ' ', u.apellido) FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ? AND r.nombre = 'Preceptor'");
    $stmt->execute([$preceptorId]);
    $nombre = $stmt->fetchColumn();
    if (!$nombre) {
        api_json(["ok" => false, "error" => "el usuario indicado no tiene rol Preceptor"], 400);
    }
}
$pdo->prepare("UPDATE cursos SET preceptor_id = ?, preceptor = ? WHERE id_cursos = ?")->execute([$preceptorId, $nombre, $id]);
registrarAuditoria("cursos.asignar", "curso", $id, ["antes" => $anterior, "despues" => ["preceptor_id" => $preceptorId, "preceptor" => $nombre]]);
api_json(["ok" => true, "curso" => ["id" => $id, "preceptorId" => $preceptorId, "preceptor" => $nombre]]);
