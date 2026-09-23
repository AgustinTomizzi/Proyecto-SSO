<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_requerir_sistema("Galiservas");
api_metodo(["GET"]);
api_requerir_permiso("reservas.administrar");

$desde = trim((string) ($_GET["desde"] ?? ""));
$hasta = trim((string) ($_GET["hasta"] ?? ""));
if (($desde !== "" && !api_fecha_valida($desde)) || ($hasta !== "" && !api_fecha_valida($hasta)) || ($desde !== "" && $hasta !== "" && $desde > $hasta)) {
    api_json(["ok" => false, "error" => "rango de fechas inválido"], 400);
}

$mes = trim((string) ($_GET["mes"] ?? date('Y-m')));
if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $mes)) api_json(["ok" => false, "error" => "Mes inválido."], 400);
$inicioMes = $mes . '-01';
$finMes = date('Y-m-d', strtotime($inicioMes . ' +1 month'));
$where = ["rv.status IN ('confirmada','completada')"];
$params = [];
if ($desde === "" && $hasta === "") { $where[] = "rv.reservation_date >= ? AND rv.reservation_date < ?"; $params[] = $inicioMes; $params[] = $finMes; }
if ($desde !== "") {
    $where[] = "rv.reservation_date >= ?";
    $params[] = $desde;
}
if ($hasta !== "") {
    $where[] = "rv.reservation_date <= ?";
    $params[] = $hasta;
}

$base = " FROM reservations rv JOIN resources r ON r.id_resource = rv.resource_id WHERE " . implode(" AND ", $where);

$stmt = $pdo->prepare("SELECT r.id_resource AS resourceId, r.name AS resourceName, r.category, COUNT(*) AS reservations, SUM(rv.quantity) AS units" . $base . " GROUP BY r.id_resource, r.name, r.category ORDER BY units DESC, r.name");
$stmt->execute($params);
$porRecurso = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT r.category, COUNT(*) AS reservations, SUM(rv.quantity) AS units" . $base . " GROUP BY r.category ORDER BY units DESC");
$stmt->execute($params);
$porCategoria = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT HOUR(rv.start_time) AS hour, COUNT(*) AS reservations, SUM(rv.quantity) AS units" . $base . " GROUP BY HOUR(rv.start_time) ORDER BY reservations DESC, hour");
$stmt->execute($params);
$porHorario = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT r.id_resource AS resourceId, r.name AS resourceName, r.category, r.capacity,
 COUNT(rv.id_reservation) AS reservations, COALESCE(SUM(rv.quantity),0) AS requested,
 COALESCE(SUM(CASE WHEN d.reservation_id IS NOT NULL THEN d.requested_quantity ELSE 0 END),0) AS processed,
 COALESCE(SUM(d.delivered_quantity),0) AS delivered,
 COALESCE(SUM(CASE WHEN d.reservation_id IS NOT NULL THEN d.requested_quantity - d.delivered_quantity ELSE 0 END),0) AS shortage
 FROM resources r LEFT JOIN reservations rv ON rv.resource_id=r.id_resource AND rv.reservation_date >= ? AND rv.reservation_date < ? AND rv.status IN ('confirmada','completada')
 LEFT JOIN reservation_deliveries d ON d.reservation_id=rv.id_reservation
 GROUP BY r.id_resource, r.name, r.category, r.capacity ORDER BY r.name");
$stmt->execute([$inicioMes, $finMes]);
$monthly = $stmt->fetchAll();
$stmt = $pdo->prepare("SELECT rv.id_reservation AS reservationId, rv.reservation_date AS date, r.name AS resourceName, d.requested_quantity AS requested, d.delivered_quantity AS delivered, d.shortage_reason AS reason FROM reservation_deliveries d JOIN reservations rv ON rv.id_reservation=d.reservation_id JOIN resources r ON r.id_resource=rv.resource_id WHERE rv.reservation_date >= ? AND rv.reservation_date < ? AND d.delivered_quantity < d.requested_quantity ORDER BY rv.reservation_date DESC");
$stmt->execute([$inicioMes, $finMes]);
$shortages = $stmt->fetchAll();
api_json([
    "ok" => true,
    "report" => [
        "byResource" => $porRecurso,
        "byCategory" => $porCategoria,
        "byHour" => $porHorario,
        "month" => $mes,
        "monthly" => $monthly,
        "shortages" => $shortages,
    ],
]);
