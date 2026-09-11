<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "PUT"]);

if ($method === "GET") {
    api_requerir_permiso("usuarios.ver");
    $stmt = $pdo->query("
        SELECT u.id_usuario AS id, u.nombre, u.apellido, u.email,
               r.id_rol AS rolId, r.nombre AS rol,
               GROUP_CONCAT(c.id_cursos ORDER BY c.anio, c.division) AS cursosAsignados
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id_rol
        LEFT JOIN cursos c ON c.preceptor_id = u.id_usuario
        GROUP BY u.id_usuario, u.nombre, u.apellido, u.email, r.id_rol, r.nombre
        ORDER BY u.apellido, u.nombre
    ");
    $usuarios = $stmt->fetchAll();

    $rolesStmt = $pdo->query("SELECT id_rol AS id, nombre FROM roles ORDER BY nombre");
    $roles = $rolesStmt->fetchAll();

    api_json(["ok" => true, "usuarios" => $usuarios, "roles" => $roles]);
}

if ($method === "POST") {
    api_requerir_permiso("usuarios.crear");
    $d = api_body();
    $nombre = trim((string) ($d["nombre"] ?? ""));
    $apellido = trim((string) ($d["apellido"] ?? ""));
    $email = strtolower(trim((string) ($d["email"] ?? "")));
    $password = (string) ($d["password"] ?? $d["contrasena"] ?? "");
    $rolId = (int) ($d["rolId"] ?? 0);
    if ($nombre === "" || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || $rolId <= 0) {
        api_json(["ok" => false, "error" => "nombre, email valido, password de al menos 8 caracteres y rolId son requeridos"], 400);
    }
    $stmt = $pdo->prepare("SELECT nombre FROM roles WHERE id_rol = ?");
    $stmt->execute([$rolId]);
    $rol = $stmt->fetchColumn();
    if (!$rol) {
        api_json(["ok" => false, "error" => "rol invalido"], 400);
    }
    try {
        $pdo->prepare("INSERT INTO usuarios (nombre, apellido, email, contrasena, rol_id) VALUES (?, ?, ?, ?, ?)")
            ->execute([$nombre, $apellido, $email, password_hash($password, PASSWORD_DEFAULT), $rolId]);
    } catch (PDOException $e) {
        if ((string) $e->getCode() === "23000") {
            api_json(["ok" => false, "error" => "el email ya esta registrado"], 409);
        }
        throw $e;
    }
    $id = (int) $pdo->lastInsertId();
    registrarAuditoria("usuarios.crear", "usuario", $id, ["nombre" => $nombre, "apellido" => $apellido, "email" => $email, "rol_id" => $rolId, "rol" => $rol]);
    api_json(["ok" => true, "usuario" => ["id" => $id, "nombre" => $nombre, "apellido" => $apellido, "email" => $email, "rolId" => $rolId, "rol" => $rol]], 201);
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

    $us = $pdo->prepare("SELECT u.rol_id, r.nombre AS rol FROM usuarios u LEFT JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?");
    $us->execute([$id]);
    $usuario = $us->fetch();
    if (!$usuario) {
        api_json(["ok" => false, "error" => "usuario no encontrado"], 404);
    }
    $rolAnteriorId = $usuario["rol_id"];

    if ($usuario["rol"] === "Administrador" && $rolNombre !== "Administrador") {
        $admins = $pdo->query("SELECT COUNT(*) FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE r.nombre = 'Administrador'")->fetchColumn();
        if ((int) $admins <= 1) {
            api_json(["ok" => false, "error" => "no se puede quitar el ultimo Administrador"], 409);
        }
    }

    $pdo->prepare("UPDATE usuarios SET rol_id = ? WHERE id_usuario = ?")->execute([$rolId, $id]);

    registrarAuditoria("usuarios.editar_rol", "usuario", $id, [
        "rol_anterior_id" => $rolAnteriorId,
        "rol_nuevo_id" => $rolId,
        "rol_nuevo" => $rolNombre,
    ]);

    api_json(["ok" => true]);
}

api_json(["ok" => false, "error" => "metodo no permitido"], 405);
