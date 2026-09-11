<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_requerir_sistema("Galiservas");
$method = api_metodo(["GET", "POST", "PUT", "DELETE"]);
$administra = api_tiene_permiso("reservas.administrar");

function datosReserva($d, $actual = [])
{
    return [
        "resourceId" => (int) ($d["resourceId"] ?? $d["recursoId"] ?? $d["recurso_id"] ?? $actual["resource_id"] ?? 0),
        "date" => trim((string) ($d["date"] ?? $d["fecha"] ?? $actual["reservation_date"] ?? "")),
        "startTime" => trim((string) ($d["startTime"] ?? $d["horaInicio"] ?? $d["hora_inicio"] ?? $actual["start_time"] ?? "")),
        "endTime" => trim((string) ($d["endTime"] ?? $d["horaFin"] ?? $d["hora_fin"] ?? $actual["end_time"] ?? "")),
        "quantity" => (int) ($d["quantity"] ?? $d["cantidad"] ?? $actual["quantity"] ?? 0),
        "reason" => trim((string) ($d["reason"] ?? $d["motivo"] ?? $actual["reason"] ?? "")),
    ];
}

function horaReservaValida($hora)
{
    return api_hora_valida($hora);
}

function validarDisponibilidad($pdo, $datos, $excluirId = 0)
{
    if ($datos["resourceId"] <= 0 || !api_fecha_valida($datos["date"]) || !horaReservaValida($datos["startTime"]) || !horaReservaValida($datos["endTime"]) || $datos["startTime"] >= $datos["endTime"] || $datos["quantity"] <= 0 || $datos["reason"] === "" || strlen($datos["reason"]) > 500) {
        api_json(["ok" => false, "error" => "recurso, fecha, horario valido, quantity positiva y reason son requeridos"], 400);
    }
    if ($datos["date"] < date("Y-m-d")) {
        api_json(["ok" => false, "error" => "la fecha de reserva no puede ser anterior a hoy"], 400);
    }
    $stmt = $pdo->prepare("SELECT capacity, active, available FROM resources WHERE id_resource = ? FOR UPDATE");
    $stmt->execute([$datos["resourceId"]]);
    $recurso = $stmt->fetch();
    if (!$recurso || !$recurso["active"] || !$recurso["available"]) {
        api_json(["ok" => false, "error" => "recurso inexistente o no disponible"], 409);
    }
    if ($datos["quantity"] > (int) $recurso["capacity"]) {
        api_json(["ok" => false, "error" => "quantity supera la capacidad del recurso"], 409);
    }
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(quantity), 0) FROM reservations WHERE resource_id = ? AND reservation_date = ? AND status IN ('pendiente','confirmada') AND start_time < ? AND end_time > ? AND id_reservation <> ?");
    $stmt->execute([$datos["resourceId"], $datos["date"], $datos["endTime"], $datos["startTime"], $excluirId]);
    if ((int) $stmt->fetchColumn() + $datos["quantity"] > (int) $recurso["capacity"]) {
        api_json(["ok" => false, "error" => "no hay capacidad suficiente en ese horario"], 409);
    }
}

if ($method === "GET") {
    api_requerir_permiso("reservas.ver");
    $sql = "SELECT rv.id_reservation AS id, rv.user_id AS userId, COALESCE(a.id_alumno, rv.user_id) AS usuario_id, CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre, rv.resource_id AS resourceId, rv.resource_id AS recurso_id, r.name AS recurso_nombre, r.type, r.category, r.location, rv.reservation_date AS date, rv.reservation_date AS fecha, rv.start_time AS startTime, rv.start_time AS hora_inicio, rv.end_time AS endTime, rv.end_time AS hora_fin, rv.quantity, rv.quantity AS cantidad, rv.reason, rv.reason AS motivo, CASE rv.status WHEN 'confirmada' THEN 'aprobada' WHEN 'completada' THEN 'finalizada' ELSE rv.status END AS status, rv.created_at AS createdAt, rv.updated_at AS updatedAt FROM reservations rv JOIN usuarios u ON u.id_usuario = rv.user_id LEFT JOIN alumnos a ON a.email = u.email JOIN resources r ON r.id_resource = rv.resource_id";
    $params = [];
    if (!$administra) {
        $sql .= " WHERE rv.user_id = ?";
        $params[] = usuarioActual();
    }
    $sql .= " ORDER BY rv.reservation_date DESC, rv.start_time DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "reservas" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("reservas.crear");
    $d = api_body();
    $datos = datosReserva($d);
    $userId = $administra && !empty($d["userId"]) ? (int) $d["userId"] : (int) usuarioActual();
    $stmt = $pdo->prepare("SELECT 1 FROM usuarios WHERE id_usuario = ?");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn()) {
        api_json(["ok" => false, "error" => "usuario de la reserva invalido"], 400);
    }
    $pdo->beginTransaction();
    try {
        validarDisponibilidad($pdo, $datos);
        $stmt = $pdo->prepare("INSERT INTO reservations (user_id, resource_id, reservation_date, start_time, end_time, quantity, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada')");
        $stmt->execute([$userId, $datos["resourceId"], $datos["date"], $datos["startTime"], $datos["endTime"], $datos["quantity"], $datos["reason"]]);
        $id = (int) $pdo->lastInsertId();
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    registrarAuditoria("reservas.crear", "reserva", $id, array_merge($datos, ["userId" => $userId, "status" => "confirmada"]));
    api_json(["ok" => true, "reserva" => array_merge(["id" => $id, "userId" => $userId, "status" => "confirmada"], $datos)], 201);
}

$d = api_body();
$id = (int) ($d["id"] ?? $_GET["id"] ?? 0);
$stmt = $pdo->prepare("SELECT * FROM reservations WHERE id_reservation = ?");
$stmt->execute([$id]);
$actual = $stmt->fetch();
if (!$actual) {
    api_json(["ok" => false, "error" => "reserva no encontrada"], 404);
}
$propia = (int) $actual["user_id"] === (int) usuarioActual();
if (!$administra && !$propia) {
    api_json(["ok" => false, "error" => "no podes modificar reservas ajenas"], 403);
}

if ($method === "DELETE") {
    api_requerir_permiso("reservas.cancelar");
    if (!$administra && !in_array($actual["status"], ["pendiente", "confirmada"], true)) {
        api_json(["ok" => false, "error" => "la reserva ya no se puede cancelar"], 409);
    }
    $pdo->prepare("UPDATE reservations SET status = 'cancelada' WHERE id_reservation = ?")->execute([$id]);
    registrarAuditoria("reservas.cancelar", "reserva", $id, ["antes" => $actual, "despues" => ["status" => "cancelada"]]);
    api_json(["ok" => true]);
}

api_requerir_permiso("reservas.editar");
if (!$administra && !in_array($actual["status"], ["pendiente", "confirmada"], true)) {
    api_json(["ok" => false, "error" => "solo se pueden editar reservas propias activas"], 409);
}
$datos = datosReserva($d, $actual);
$solicitado = (string) ($d["status"] ?? $d["estado"] ?? $actual["status"]);
if (!$administra && $solicitado !== $actual["status"] && $solicitado !== "cancelada") {
    api_json(["ok" => false, "error" => "no podes cambiar ese estado"], 403);
}
$status = $administra ? $solicitado : ($solicitado === "cancelada" ? "cancelada" : (string) $actual["status"]);
$status = ["aprobada" => "confirmada", "finalizada" => "completada"][$status] ?? $status;
if (!in_array($status, ["pendiente", "confirmada", "rechazada", "cancelada", "completada"], true)) {
    api_json(["ok" => false, "error" => "status invalido"], 400);
}
$pdo->beginTransaction();
try {
    if (in_array($status, ["pendiente", "confirmada"], true)) {
        validarDisponibilidad($pdo, $datos, $id);
    }
    $pdo->prepare("UPDATE reservations SET resource_id = ?, reservation_date = ?, start_time = ?, end_time = ?, quantity = ?, reason = ?, status = ? WHERE id_reservation = ?")
        ->execute([$datos["resourceId"], $datos["date"], $datos["startTime"], $datos["endTime"], $datos["quantity"], $datos["reason"], $status, $id]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
registrarAuditoria("reservas.editar", "reserva", $id, ["antes" => $actual, "despues" => array_merge($datos, ["status" => $status])]);
api_json(["ok" => true]);
