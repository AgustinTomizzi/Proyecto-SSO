<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_metodo(["GET"]);

// Catalogo de materias: cualquier usuario autenticado lo necesita para elegir
// materia en asistencias, notas, reportes y horarios.
$stmt = $pdo->query("SELECT id_materia AS id, nombre FROM materias ORDER BY nombre");
api_json(["ok" => true, "materias" => $stmt->fetchAll()]);
