<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_requerir_sistema("Galiservas");
$method = api_metodo(["GET", "POST", "PUT", "DELETE"]);

function validarRecurso($d)
{
    $r = [
        "name" => trim((string) ($d["name"] ?? $d["nombre"] ?? "")),
        "type" => trim((string) ($d["type"] ?? $d["tipo"] ?? "")),
        "category" => trim((string) ($d["category"] ?? $d["categoria"] ?? "")),
        "location" => trim((string) ($d["location"] ?? $d["ubicacion"] ?? "")),
        "description" => trim((string) ($d["description"] ?? $d["descripcion"] ?? "")),
        "capacity" => (int) ($d["capacity"] ?? $d["capacidad"] ?? 0),
        "active" => isset($d["active"]) ? (int) (bool) $d["active"] : 1,
        "available" => isset($d["available"]) ? (int) (bool) $d["available"] : 1,
    ];
    if ($r["name"] === "" || strlen($r["name"]) > 150 || $r["type"] === "" || strlen($r["type"]) > 50 || !in_array($r["category"], ["hardware_pc", "audiovisual"], true) || $r["location"] === "" || strlen($r["location"]) > 150 || strlen($r["description"]) > 500 || $r["capacity"] <= 0 || $r["capacity"] > 10000) {
        api_json(["ok" => false, "error" => "name, type, category, location y capacity positiva son requeridos"], 400);
    }
    return $r;
}

if ($method === "GET") {
    api_requerir_permiso("recursos.ver");
    $incluirInactivos = api_es_administrador() && !empty($_GET["incluirInactivos"]);
    $where = $incluirInactivos ? [] : ["r.active = 1", "r.available = 1"];
    $params = [];
    if (!empty($_GET["ubicacion"])) {
        $where[] = "r.location = ?";
        $params[] = trim((string) $_GET["ubicacion"]);
    }
    if (!empty($_GET["categoria"])) {
        $where[] = "r.category = ?";
        $params[] = trim((string) $_GET["categoria"]);
    }

    $fecha = trim((string) ($_GET["fecha"] ?? ""));
    $inicio = trim((string) ($_GET["hora_inicio"] ?? ""));
    $fin = trim((string) ($_GET["hora_fin"] ?? ""));
    $conFranja = $fecha !== "" || $inicio !== "" || $fin !== "";
    if ($conFranja && (!api_fecha_valida($fecha) || !api_hora_valida($inicio) || !api_hora_valida($fin) || $inicio >= $fin)) {
        api_json(["ok" => false, "error" => "fecha, hora_inicio y hora_fin forman una franja inválida"], 400);
    }

    if ($conFranja) {
        $sql = "SELECT r.id_resource AS id, r.name, r.type, r.category, r.location, r.description, r.capacity, r.active,
                COALESCE(SUM(rv.quantity), 0) AS reserved,
                IF(r.available = 1, GREATEST(r.capacity - COALESCE(SUM(rv.quantity), 0), 0), 0) AS available,
                r.available AS availableState, r.created_at AS createdAt, r.updated_at AS updatedAt
                FROM resources r LEFT JOIN reservations rv ON rv.resource_id = r.id_resource
                  AND rv.reservation_date = ? AND rv.status IN ('pendiente','confirmada')
                  AND rv.start_time < ? AND rv.end_time > ?";
        $params = [$fecha, $fin, $inicio, ...$params];
        if ($where) $sql .= " WHERE " . implode(" AND ", $where);
        $sql .= " GROUP BY r.id_resource, r.name, r.type, r.category, r.location, r.description, r.capacity, r.active, r.available, r.created_at, r.updated_at ORDER BY r.location, r.name";
    } else {
        $sql = "SELECT r.id_resource AS id, r.name, r.type, r.category, r.location, r.description, r.capacity, r.active, 0 AS reserved, IF(r.available = 1, r.capacity, 0) AS available, r.available AS availableState, r.created_at AS createdAt, r.updated_at AS updatedAt FROM resources r";
        if ($where) $sql .= " WHERE " . implode(" AND ", $where);
        $sql .= " ORDER BY r.location, r.name";
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    api_json(["ok" => true, "recursos" => $rows, "resources" => $rows]);
}

if (!api_es_administrador()) {
    api_json(["ok" => false, "error" => "solo el Administrador puede modificar recursos"], 403);
}

if ($method === "POST") {
    api_requerir_permiso("recursos.crear");
    $r = validarRecurso(api_body());
    $pdo->prepare("INSERT INTO resources (name, type, category, location, description, capacity, active, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$r["name"], $r["type"], $r["category"], $r["location"], $r["description"] ?: null, $r["capacity"], $r["active"], $r["available"]]);
    $id = (int) $pdo->lastInsertId();
    registrarAuditoria("recursos.crear", "recurso", $id, $r);
    api_json(["ok" => true, "recurso" => array_merge(["id" => $id], $r)], 201);
}

$d = api_body();
$id = (int) ($d["id"] ?? $_GET["id"] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM resources WHERE id_resource = ?");
$stmt->execute([$id]);
$antes = $stmt->fetch();
if ($id <= 0 || !$antes) {
    api_json(["ok" => false, "error" => "recurso no encontrado"], 404);
}

if ($method === "PUT") {
    api_requerir_permiso("recursos.editar");
    $r = validarRecurso($d);
    $pdo->prepare("UPDATE resources SET name = ?, type = ?, category = ?, location = ?, description = ?, capacity = ?, active = ?, available = ? WHERE id_resource = ?")
        ->execute([$r["name"], $r["type"], $r["category"], $r["location"], $r["description"] ?: null, $r["capacity"], $r["active"], $r["available"], $id]);
    registrarAuditoria("recursos.editar", "recurso", $id, ["antes" => $antes, "despues" => $r]);
    api_json(["ok" => true]);
}

api_requerir_permiso("recursos.desactivar");
$pdo->prepare("UPDATE resources SET active = 0, available = 0 WHERE id_resource = ?")->execute([$id]);
registrarAuditoria("recursos.desactivar", "recurso", $id, ["antes" => $antes, "despues" => ["active" => 0, "available" => 0]]);
api_json(["ok" => true]);
