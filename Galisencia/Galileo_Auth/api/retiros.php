<?php
require_once __DIR__ . '/_common.php';
api_login_requerido();
api_requerir_sistema('Galiservas');
api_metodo(['POST']);
api_requerir_permiso('reservas.administrar');
$d = api_body();
$id = api_id_positivo($d['reservationId'] ?? null);
$quantity = filter_var($d['deliveredQuantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
$reason = trim((string) ($d['shortageReason'] ?? ''));
$observation = trim((string) ($d['observation'] ?? ''));
if (!$id || $quantity === false || strlen($reason) > 500 || strlen($observation) > 1000) {
    api_json(['ok' => false, 'error' => 'Revisá la cantidad y los textos del retiro.'], 400);
}
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT * FROM reservations WHERE id_reservation = ? FOR UPDATE');
    $stmt->execute([$id]);
    $reservation = $stmt->fetch();
    if (!$reservation) { $pdo->rollBack(); api_json(['ok' => false, 'error' => 'Reserva inexistente.'], 404); }
    if (!in_array($reservation['status'], ['pendiente', 'confirmada'], true)) {
        $pdo->rollBack(); api_json(['ok' => false, 'error' => 'Esta reserva ya no admite retiros.'], 409);
    }
    if ($quantity > (int) $reservation['quantity'] || ($quantity < (int) $reservation['quantity'] && $reason === '')) {
        $pdo->rollBack(); api_json(['ok' => false, 'error' => 'Si entregaste menos de lo solicitado, indicá por qué.'], 400);
    }
    $stmt = $pdo->prepare('INSERT INTO reservation_deliveries (reservation_id, requested_quantity, delivered_quantity, shortage_reason, observation, recorded_by) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$id, $reservation['quantity'], $quantity, $quantity < $reservation['quantity'] ? $reason : null, $observation ?: null, usuarioActual()]);
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e->getCode() === '23000') api_json(['ok' => false, 'error' => 'Ya se registró el retiro de esta reserva.'], 409);
    throw $e;
}
registrarAuditoria('reservas.retiro', 'reserva', $id, ['solicitada' => (int) $reservation['quantity'], 'entregada' => $quantity, 'motivo' => $reason, 'observacion' => $observation]);
api_json(['ok' => true], 201);
