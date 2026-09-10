<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    api_requerir_permiso("cursos.ver");

    $sql = "
        SELECT c.id_cursos AS id, c.anio, c.division, c.turno,
               c.preceptor_id AS preceptorId,
               CASE WHEN u.id_usuario IS NULL THEN NULL
                    ELSE TRIM(CONCAT(u.nombre, ' ', u.apellido)) END AS preceptor
        FROM cursos c
        LEFT JOIN usuarios u ON u.id_usuario = c.preceptor_id
    ";
    $params = [];
    if (api_es_preceptor()) {
        $sql .= " WHERE c.preceptor_id = ?";
        $params[] = (int) $_SESSION["id_usuario"];
    }
    $sql .= " ORDER BY c.anio, c.division";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "cursos" => $stmt->fetchAll()]);
}

if ($method === "PUT") {
    api_requerir_permiso("cursos.asignar");
    $data = api_body();
    $cursoId = (int) ($data["id"] ?? 0);
    $preceptorId = $data["preceptorId"] ?? null;
    $preceptorId = $preceptorId === null || $preceptorId === "" ? null : (int) $preceptorId;

    if ($cursoId <= 0 || ($preceptorId !== null && $preceptorId <= 0)) {
        api_json(["ok" => false, "error" => "id de curso o preceptor invalido"], 400);
    }

    $cursoStmt = $pdo->prepare("
        SELECT c.preceptor_id,
               CASE WHEN u.id_usuario IS NULL THEN NULL
                    ELSE TRIM(CONCAT(u.nombre, ' ', u.apellido)) END AS preceptor
        FROM cursos c
        LEFT JOIN usuarios u ON u.id_usuario = c.preceptor_id
        WHERE c.id_cursos = ?
    ");
    $cursoStmt->execute([$cursoId]);
    $curso = $cursoStmt->fetch();
    if (!$curso) {
        api_json(["ok" => false, "error" => "curso no encontrado"], 404);
    }

    $nuevoNombre = null;
    if ($preceptorId !== null) {
        $usuarioStmt = $pdo->prepare("
            SELECT TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS nombre
            FROM usuarios u
            INNER JOIN roles r ON r.id_rol = u.rol_id
            WHERE u.id_usuario = ? AND r.nombre = 'Preceptor'
        ");
        $usuarioStmt->execute([$preceptorId]);
        $nuevoNombre = $usuarioStmt->fetchColumn();
        if ($nuevoNombre === false) {
            api_json(["ok" => false, "error" => "el usuario indicado no es Preceptor"], 400);
        }
    }

    $stmt = $pdo->prepare("UPDATE cursos SET preceptor_id = ?, preceptor = ? WHERE id_cursos = ?");
    $stmt->execute([$preceptorId, $nuevoNombre, $cursoId]);

    registrarAuditoria("cursos.asignar", "curso", $cursoId, [
        "preceptor_anterior_id" => $curso["preceptor_id"] !== null ? (int) $curso["preceptor_id"] : null,
        "preceptor_anterior" => $curso["preceptor"],
        "preceptor_nuevo_id" => $preceptorId,
        "preceptor_nuevo" => $nuevoNombre,
    ]);

    api_json(["ok" => true, "curso" => [
        "id" => (string) $cursoId,
        "preceptorId" => $preceptorId !== null ? (string) $preceptorId : null,
        "preceptor" => $nuevoNombre,
    ]]);
}

api_json(["ok" => false, "error" => "metodo no permitido"], 405);
