<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();

api_metodo(["GET"]);

api_requerir_permiso("auditoria.ver");

$where = [];
$params = [];

if (!empty($_GET["usuarioId"])) {
    $where[] = "usuario_id = ?";
    $params[] = (int) $_GET["usuarioId"];
}
if (!empty($_GET["entidad"])) {
    $where[] = "entidad = ?";
    $params[] = $_GET["entidad"];
}
if (!empty($_GET["accion"])) {
    $where[] = "accion = ?";
    $params[] = $_GET["accion"];
}
if (!empty($_GET["desde"])) {
    $where[] = "fecha >= ?";
    $params[] = $_GET["desde"];
}
if (!empty($_GET["hasta"])) {
    $where[] = "fecha <= ?";
    $params[] = $_GET["hasta"];
}

$limit = min(max((int) ($_GET["limit"] ?? 100), 1), 500);

$sql = "
    SELECT id_auditoria AS id, usuario_id AS usuarioId, usuario_nombre AS usuarioNombre,
           rol, accion, entidad, entidad_id AS entidadId, detalle, fecha
    FROM auditoria
";
if ($where) {
    $sql .= " WHERE " . implode(" AND ", $where);
}
$sql .= " ORDER BY fecha DESC, id_auditoria DESC LIMIT $limit";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $registros = $stmt->fetchAll();
    foreach ($registros as &$r) {
        if ($r["detalle"] !== null) {
            $r["detalle"] = json_decode($r["detalle"], true);
        }
    }
    api_json(["ok" => true, "registros" => $registros]);
} catch (\Throwable $e) {
    api_json(["ok" => false, "error" => "la tabla de auditoria no existe todavia. Corre la migracion db/03-migracion-rbac-auditoria.sql"], 500);
}
