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

$where = ["rv.status IN ('confirmada','completada')"];
$params = [];
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

api_json([
    "ok" => true,
    "report" => [
        "byResource" => $porRecurso,
        "byCategory" => $porCategoria,
        "byHour" => $porHorario,
    ],
]);
