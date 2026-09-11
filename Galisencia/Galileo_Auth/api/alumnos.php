<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "PUT", "DELETE"]);
$usuarioId = $_SESSION["id_usuario"] ?? null;
$rolSesion = $_SESSION["rol"] ?? "";

function esPreceptor($rolSesion)
{
    return strcasecmp($rolSesion, "Preceptor") === 0;
}

function cursosDelPreceptor($pdo, $usuarioId)
{
    return api_cursos_del_preceptor($usuarioId);
}

function resolverCursoId($pdo, $cursoTexto, $cursoId = null)
{
    if ($cursoId !== null && $cursoId !== "") {
        $cursoId = api_id_positivo($cursoId);
        if ($cursoId === null) {
            return null;
        }
        $cs = $pdo->prepare("SELECT id_cursos FROM cursos WHERE id_cursos = ?");
        $cs->execute([$cursoId]);
        return $cs->fetchColumn() ? $cursoId : null;
    }
    if ($cursoTexto === "") {
        return null;
    }
    $parts = preg_split('/\s+/', trim($cursoTexto));
    $cs = $pdo->prepare("SELECT id_cursos FROM cursos WHERE anio = ? AND division = ? LIMIT 1");
    $cs->execute([$parts[0] ?? "", $parts[1] ?? ""]);
    $c = $cs->fetch();
    return $c ? (int) $c["id_cursos"] : null;
}

if ($method === "GET") {
    api_requerir_permiso("alumnos.ver");

    $sql = "
        SELECT a.id_alumno AS id,
               a.nombre, a.apellido,
               CONCAT(a.nombre, ' ', a.apellido) AS nombreCompleto,
               CONCAT(c.anio, ' ', c.division) AS curso,
               a.curso_id AS cursoId,
               c.anio, c.division,
               a.email, a.dni, a.direccion, a.estado
        FROM alumnos a
        LEFT JOIN cursos c ON a.curso_id = c.id_cursos
    ";
    $params = [];
    $where = ["a.estado = 1"];
    if (!empty($_GET["incluirInactivos"]) && api_es_administrador()) {
        $where = [];
    }
    if (esPreceptor($rolSesion)) {
        $misCursos = cursosDelPreceptor($pdo, $usuarioId);
        if (empty($misCursos)) {
            api_json(["ok" => true, "alumnos" => []]);
        }
        $placeholders = implode(",", array_fill(0, count($misCursos), "?"));
        $where[] = "a.curso_id IN ($placeholders)";
        $params = $misCursos;
    }
    if ($where) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $sql .= " ORDER BY a.apellido, a.nombre";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "alumnos" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("alumnos.crear");
    $d = api_body();
    $nombre = trim((string) ($d["nombre"] ?? ""));
    $apellido = trim((string) ($d["apellido"] ?? ""));
    $curso = trim((string) ($d["curso"] ?? ""));
    $email = trim((string) ($d["email"] ?? ""));
    $dni = trim((string) ($d["dni"] ?? ""));
    $direccion = trim((string) ($d["direccion"] ?? ""));
    if ($nombre === "" || $apellido === "") {
        api_json(["ok" => false, "error" => "nombre y apellido requeridos"], 400);
    }
    if ($email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        api_json(["ok" => false, "error" => "email invalido"], 400);
    }

    $curso_id = resolverCursoId($pdo, $curso, $d["cursoId"] ?? null);
    if ($curso_id === null) {
        api_json(["ok" => false, "error" => "curso invalido"], 400);
    }

    if (esPreceptor($rolSesion)) {
        $misCursos = cursosDelPreceptor($pdo, $usuarioId);
        if ($curso_id === null || !in_array($curso_id, $misCursos, true)) {
            api_json(["ok" => false, "error" => "no podes agregar alumnos a un curso que no tenes asignado"], 403);
        }
    }

    $stmt = $pdo->prepare("INSERT INTO alumnos (nombre, apellido, email, dni, direccion, curso_id, estado) VALUES (?, ?, ?, ?, ?, ?, 1)");
    $stmt->execute([$nombre, $apellido, $email !== "" ? $email : null, $dni !== "" ? $dni : null, $direccion !== "" ? $direccion : null, $curso_id]);
    $id = $pdo->lastInsertId();

    registrarAuditoria("alumnos.crear", "alumno", $id, ["nombre" => $nombre, "apellido" => $apellido, "curso" => $curso, "curso_id" => $curso_id, "email" => $email, "dni" => $dni]);

    api_json(["ok" => true, "alumno" => ["id" => (string) $id, "nombre" => $nombre, "apellido" => $apellido, "curso" => $curso, "email" => $email]]);
}

if ($method === "PUT") {
    api_requerir_permiso("alumnos.editar");
    $d = api_body();
    $id = api_id_positivo($d["id"] ?? null);
    $nombre = trim((string) ($d["nombre"] ?? ""));
    $apellido = trim((string) ($d["apellido"] ?? ""));
    $curso = trim((string) ($d["curso"] ?? ""));
    $email = trim((string) ($d["email"] ?? ""));
    $dni = trim((string) ($d["dni"] ?? ""));
    $direccion = trim((string) ($d["direccion"] ?? ""));
    if ($id === null || $nombre === "" || $apellido === "" || ($email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
        api_json(["ok" => false, "error" => "datos de alumno invalidos"], 400);
    }

    $curso_id = resolverCursoId($pdo, $curso, $d["cursoId"] ?? null);
    if ($curso_id === null) {
        api_json(["ok" => false, "error" => "curso invalido"], 400);
    }

    $pdo->beginTransaction();
    try {
        $actual = $pdo->prepare("SELECT nombre, apellido, email, dni, direccion, curso_id, estado FROM alumnos WHERE id_alumno = ? FOR UPDATE");
        $actual->execute([$id]);
        $antes = $actual->fetch();
        if (!$antes) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "alumno no encontrado"], 404);
        }
        $cursoIdActual = (int) $antes["curso_id"];

        if (esPreceptor($rolSesion)) {
            $misCursos = api_cursos_del_preceptor($usuarioId, true);
            if (!in_array($cursoIdActual, $misCursos, true)) {
                $pdo->rollBack();
                api_json(["ok" => false, "error" => "no podes modificar alumnos de un curso que no tenes asignado"], 403);
            }
            if (!in_array($curso_id, $misCursos, true)) {
                $pdo->rollBack();
                api_json(["ok" => false, "error" => "no podes mover al alumno a un curso que no tenes asignado"], 403);
            }
            if ($curso_id !== $cursoIdActual) {
                $currentPassword = (string) ($d["currentPassword"] ?? "");
                if ($currentPassword === "") {
                    $pdo->rollBack();
                    api_json(["ok" => false, "error" => "currentPassword es requerido para cambiar al alumno de curso"], 400);
                }
                $passwordStmt = $pdo->prepare("SELECT contrasena FROM usuarios WHERE id_usuario = ? FOR UPDATE");
                $passwordStmt->execute([$usuarioId]);
                $hash = $passwordStmt->fetchColumn();
                if (!$hash || !password_verify($currentPassword, $hash)) {
                    $pdo->rollBack();
                    api_json(["ok" => false, "error" => "la contraseña actual es incorrecta"], 401);
                }
            }
        }

        $stmt = $pdo->prepare("UPDATE alumnos SET nombre = ?, apellido = ?, email = ?, dni = ?, direccion = ?, curso_id = ? WHERE id_alumno = ?");
        $stmt->execute([$nombre, $apellido, $email !== "" ? $email : null, $dni !== "" ? $dni : null, $direccion !== "" ? $direccion : null, $curso_id, $id]);

        if ($curso_id !== $cursoIdActual) {
            $pdo->prepare("INSERT INTO alumno_movimientos (alumno_id, tipo, curso_origen_id, curso_destino_id, ciclo_lectivo, realizado_por) VALUES (?, 'cambio_curso', ?, ?, YEAR(CURDATE()), ?)")
                ->execute([$id, $cursoIdActual ?: null, $curso_id, $usuarioId]);
        }

        registrarAuditoria("alumnos.editar", "alumno", $id, ["antes" => $antes, "despues" => ["nombre" => $nombre, "apellido" => $apellido, "email" => $email, "dni" => $dni, "direccion" => $direccion, "curso_id" => $curso_id]]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    api_json(["ok" => true]);
}

if ($method === "DELETE") {
    api_requerir_permiso("alumnos.dar_baja");
    $d = api_body();
    $id = api_id_positivo($_GET["id"] ?? null);
    if ($id === null) {
        api_json(["ok" => false, "error" => "id inválido"], 400);
    }

    if (esPreceptor($rolSesion) && (string) ($d["currentPassword"] ?? "") === "") {
        api_json(["ok" => false, "error" => "currentPassword es requerido para dar de baja al alumno"], 400);
    }

    $pdo->beginTransaction();
    try {
        $actual = $pdo->prepare("SELECT nombre, apellido, email, dni, direccion, curso_id, estado FROM alumnos WHERE id_alumno = ? FOR UPDATE");
        $actual->execute([$id]);
        $antes = $actual->fetch();
        if (!$antes) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "alumno no encontrado"], 404);
        }
        $cursoIdActual = (int) $antes["curso_id"];

        if (esPreceptor($rolSesion)) {
            $misCursos = api_cursos_del_preceptor($usuarioId, true);
            if (!in_array($cursoIdActual, $misCursos, true)) {
                $pdo->rollBack();
                api_json(["ok" => false, "error" => "no podes quitar alumnos de un curso que no tenes asignado"], 403);
            }
            $passwordStmt = $pdo->prepare("SELECT contrasena FROM usuarios WHERE id_usuario = ? FOR UPDATE");
            $passwordStmt->execute([$usuarioId]);
            $hash = $passwordStmt->fetchColumn();
            if (!$hash || !password_verify((string) $d["currentPassword"], $hash)) {
                $pdo->rollBack();
                api_json(["ok" => false, "error" => "la contraseña actual es incorrecta"], 401);
            }
        }

        $pdo->prepare("UPDATE alumnos SET estado = 0 WHERE id_alumno = ?")->execute([$id]);
        $pdo->prepare("INSERT INTO alumno_movimientos (alumno_id, tipo, curso_origen_id, curso_destino_id, ciclo_lectivo, realizado_por) VALUES (?, 'baja', ?, NULL, YEAR(CURDATE()), ?)")
            ->execute([$id, $cursoIdActual ?: null, $usuarioId]);

        registrarAuditoria("alumnos.dar_baja", "alumno", $id, ["antes" => $antes, "despues" => ["estado" => 0]]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    api_json(["ok" => true]);
}
