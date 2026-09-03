<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    api_requerir_permiso("usuarios.ver");
    $stmt = $pdo->query("
        SELECT u.id_usuario AS id, u.nombre, u.apellido, u.email,
               r.id_rol AS rolId, r.nombre AS rol
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id_rol
        ORDER BY u.apellido, u.nombre
    ");
    $usuarios = $stmt->fetchAll();

    $rolesStmt = $pdo->query("SELECT id_rol AS id, nombre FROM roles ORDER BY nombre");
    $roles = $rolesStmt->fetchAll();

    api_json(["ok" => true, "usuarios" => $usuarios, "roles" => $roles]);
}

if ($method === "PUT") {
    api_requerir_permiso("usuarios.editar_rol");
    $d = api_body();
    $id = (int) ($d["id"] ?? 0);
    $rolId = (int) ($d["rolId"] ?? 0);

    if ($id <= 0 || $rolId <= 0) {
        api_json(["ok" => false, "error" => "id y rolId son requeridos"], 400);
    }

    $rs = $pdo->prepare("SELECT nombre FROM roles WHERE id_rol = ?");
    $rs->execute([$rolId]);
    $rolNombre = $rs->fetchColumn();
    if (!$rolNombre) {
        api_json(["ok" => false, "error" => "rol invalido"], 400);
    }

    $us = $pdo->prepare("SELECT rol_id FROM usuarios WHERE id_usuario = ?");
    $us->execute([$id]);
    if ($us->rowCount() === 0) {
        api_json(["ok" => false, "error" => "usuario no encontrado"], 404);
    }
    $rolAnteriorId = $us->fetchColumn();

    $pdo->prepare("UPDATE usuarios SET rol_id = ? WHERE id_usuario = ?")->execute([$rolId, $id]);

    registrarAuditoria("usuarios.editar_rol", "usuario", $id, [
        "rol_anterior_id" => $rolAnteriorId,
        "rol_nuevo_id" => $rolId,
        "rol_nuevo" => $rolNombre,
    ]);

    api_json(["ok" => true]);
}

api_json(["ok" => false, "error" => "metodo no permitido"], 405);
