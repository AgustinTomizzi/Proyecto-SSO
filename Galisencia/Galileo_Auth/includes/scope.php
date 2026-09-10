<?php

function api_rol_es($rol)
{
    return strcasecmp((string) ($_SESSION["rol"] ?? ""), $rol) === 0;
}

function api_es_preceptor()
{
    return api_rol_es("Preceptor");
}

function api_es_alumno()
{
    return api_rol_es("Alumno");
}

function api_cursos_del_preceptor($pdo, $usuarioId = null)
{
    $usuarioId ??= $_SESSION["id_usuario"] ?? null;
    if (!$usuarioId) {
        return [];
    }

    $stmt = $pdo->prepare("SELECT id_cursos FROM cursos WHERE preceptor_id = ?");
    $stmt->execute([$usuarioId]);
    return array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function api_alumno_id_sesion($pdo)
{
    $email = trim((string) ($_SESSION["email"] ?? ""));
    if ($email === "") {
        return null;
    }

    $stmt = $pdo->prepare("SELECT id_alumno FROM alumnos WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $id = $stmt->fetchColumn();
    return $id === false ? null : (int) $id;
}

function api_alumnos_scope_sql($pdo, $alias = "a")
{
    if (api_es_preceptor()) {
        return [
            "$alias.curso_id IN (SELECT id_cursos FROM cursos WHERE preceptor_id = ?)",
            [(int) ($_SESSION["id_usuario"] ?? 0)],
        ];
    }

    if (api_es_alumno()) {
        $alumnoId = api_alumno_id_sesion($pdo);
        return $alumnoId === null
            ? ["1 = 0", []]
            : ["$alias.id_alumno = ?", [$alumnoId]];
    }

    return [null, []];
}

function api_requerir_alumno_en_alcance($pdo, $alumnoId)
{
    $stmt = $pdo->prepare("SELECT id_alumno, curso_id FROM alumnos WHERE id_alumno = ? LIMIT 1");
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();

    if (!$alumno) {
        api_json(["ok" => false, "error" => "alumno no encontrado"], 404);
    }

    if (api_es_preceptor()) {
        $cursos = api_cursos_del_preceptor($pdo);
        if (!in_array((int) $alumno["curso_id"], $cursos, true)) {
            api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos"], 403);
        }
    }

    if (api_es_alumno() && api_alumno_id_sesion($pdo) !== (int) $alumno["id_alumno"]) {
        api_json(["ok" => false, "error" => "no podes consultar datos de otro alumno"], 403);
    }

    return $alumno;
}

/**
 * Operacion sensible: pide que el usuario reingrese su contrasena.
 * Se usa para que el preceptor confirme acciones delicadas (editar / dar de baja).
 */
function api_requerir_contrasena($pdo, $contrasena)
{
    $usuarioActual = $_SESSION["id_usuario"] ?? null;
    if (!$usuarioActual) {
        api_json(["ok" => false, "error" => "no autenticado"], 401);
    }

    $stmt = $pdo->prepare("SELECT contrasena FROM usuarios WHERE id_usuario = ? LIMIT 1");
    $stmt->execute([$usuarioActual]);
    $hash = $stmt->fetchColumn();

    if (!is_string($hash) || $hash === "" || empty($contrasena) || !password_verify($contrasena, $hash)) {
        api_json(["ok" => false, "error" => "contraseña incorrecta: volvé a ingresar tu contraseña para confirmar"], 403);
    }
}
