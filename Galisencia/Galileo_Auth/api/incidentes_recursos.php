<?php
require_once __DIR__ . '/_common.php';
api_login_requerido();
api_requerir_sistema('Galiservas');
$method = api_metodo(['GET', 'POST', 'PUT']);
$admin = api_tiene_permiso('reservas.administrar');
if ($method === 'GET') {
    api_requerir_permiso('reservas.ver');
    $sql = "SELECT i.id_incident AS id, i.resource_id AS resourceId, r.name AS resourceName, i.reservation_id AS reservationId, i.equipment_identifier AS equipmentIdentifier, i.description, i.status, i.resolution, i.reported_by AS reportedBy, CONCAT(u.nombre,' ',u.apellido) AS reporterName, i.reported_at AS reportedAt FROM resource_incidents i JOIN resources r ON r.id_resource=i.resource_id JOIN usuarios u ON u.id_usuario=i.reported_by";
    if (!$admin) $sql .= ' WHERE i.reported_by = ?';
    $sql .= ' ORDER BY i.reported_at DESC, i.id_incident DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($admin ? [] : [usuarioActual()]);
    api_json(['ok' => true, 'incidents' => $stmt->fetchAll()]);
}
$d = api_body();
if ($method === 'POST') {
    api_requerir_permiso('reservas.ver');
    $resourceId = api_id_positivo($d['resourceId'] ?? null);
    $reservationId = isset($d['reservationId']) && $d['reservationId'] !== '' ? api_id_positivo($d['reservationId']) : null;
    $identifier = trim((string) ($d['equipmentIdentifier'] ?? ''));
    $description = trim((string) ($d['description'] ?? ''));
    if (!$resourceId || (isset($d['reservationId']) && $d['reservationId'] !== '' && !$reservationId) || !$description || strlen($description) > 1000 || strlen($identifier) > 100) api_json(['ok' => false, 'error' => 'Indicá el recurso y describí el problema.'], 400);
    $stmt = $pdo->prepare('SELECT 1 FROM resources WHERE id_resource = ?');
    $stmt->execute([$resourceId]);
    if (!$stmt->fetchColumn()) api_json(['ok' => false, 'error' => 'Recurso inexistente.'], 404);
    if (!$admin) {
        if (!$reservationId) api_json(['ok' => false, 'error' => 'Seleccioná una de tus reservas.'], 403);
        $stmt = $pdo->prepare('SELECT 1 FROM reservations WHERE id_reservation = ? AND resource_id = ? AND user_id = ?');
        $stmt->execute([$reservationId, $resourceId, usuarioActual()]);
        if (!$stmt->fetchColumn()) api_json(['ok' => false, 'error' => 'Esa reserva no te pertenece.'], 403);
    } elseif ($reservationId) {
        $stmt = $pdo->prepare('SELECT 1 FROM reservations WHERE id_reservation = ? AND resource_id = ?');
        $stmt->execute([$reservationId, $resourceId]);
        if (!$stmt->fetchColumn()) api_json(['ok' => false, 'error' => 'La reserva no corresponde al recurso.'], 400);
    }
    $stmt = $pdo->prepare('INSERT INTO resource_incidents (resource_id, reservation_id, equipment_identifier, description, reported_by) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$resourceId, $reservationId, $identifier ?: null, $description, usuarioActual()]);
    $id = (int) $pdo->lastInsertId();
    registrarAuditoria('recursos.incidente', 'incidente', $id, ['recurso' => $resourceId, 'reserva' => $reservationId, 'descripcion' => $description]);
    api_json(['ok' => true, 'id' => $id], 201);
}
if (!$admin) api_json(['ok' => false, 'error' => 'Sin permiso para resolver incidentes.'], 403);
$id = api_id_positivo($d['id'] ?? null);
$resolution = trim((string) ($d['resolution'] ?? ''));
if (!$id || !$resolution || strlen($resolution) > 1000) api_json(['ok' => false, 'error' => 'Indicá cómo se resolvió el problema.'], 400);
$stmt = $pdo->prepare("UPDATE resource_incidents SET status='resuelto', resolution=?, resolved_by=?, resolved_at=NOW() WHERE id_incident=? AND status='abierto'");
$stmt->execute([$resolution, usuarioActual(), $id]);
if (!$stmt->rowCount()) api_json(['ok' => false, 'error' => 'Incidente inexistente o ya resuelto.'], 409);
registrarAuditoria('recursos.incidente.resolver', 'incidente', $id, ['resolucion' => $resolution]);
api_json(['ok' => true]);
