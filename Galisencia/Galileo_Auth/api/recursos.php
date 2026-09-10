<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    api_json(["ok" => false, "error" => "método no permitido"], 405);
}
api_requerir_permiso("reservas.ver");

$sql = "
    SELECT r.id_recurso AS id,
           r.nombre,
           r.tipo,
           r.stock_total,
           c.nombre AS categoria
    FROM recursos r
    LEFT JOIN categorias_recursos c ON r.categoria_id = c.id_categoria
    WHERE r.activo = 1
    ORDER BY r.tipo DESC, r.nombre
";

$stmt = $pdo->prepare($sql);
$stmt->execute();

$filas = array_map(function ($f) {
    return [
        "id" => (int) $f["id"],
        "nombre" => $f["nombre"],
        "tipo" => $f["tipo"],
        "categoria" => $f["categoria"],
        "stock" => (int) $f["stock_total"],
    ];
}, $stmt->fetchAll());

$categorias = $pdo->query("SELECT id_categoria AS id, nombre FROM categorias_recursos ORDER BY nombre")->fetchAll();

api_json(["ok" => true, "recursos" => $filas, "categorias" => $categorias]);