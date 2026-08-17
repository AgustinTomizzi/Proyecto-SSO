<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    api_json(["ok" => false, "error" => "método no permitido"], 405);
}
api_requerir_permiso("cursos.ver");
$stmt = $pdo->query("SELECT id_cursos AS id, anio, division, turno, preceptor FROM cursos ORDER BY anio, division");
api_json(["ok" => true, "cursos" => $stmt->fetchAll()]);
