<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = $_SERVER["REQUEST_METHOD"];

function resolverCursoId($pdo, $cursoTexto)
{
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
               CONCAT(a.nombre, ' ', a.apellido) AS nombre,
               a.nombre AS nombreSolo,
               a.apellido,
               a.dni,
               CONCAT(c.anio, ' ', c.division) AS curso,
               c.anio,
               c.division,
               a.curso_id AS cursoId,
               a.email,
               a.estado
        FROM alumnos a
        LEFT JOIN cursos c ON a.curso_id = c.id_cursos
    ";
    $params = [];
    if (api_es_preceptor()) {
        $misCursos = api_cursos_del_preceptor($pdo);
        if (empty($misCursos)) {
            api_json(["ok" => true, "alumnos" => []]);
        }
        $placeholders = implode(",", array_fill(0, count($misCursos), "?"));
        $sql .= " WHERE a.curso_id IN ($placeholders)";
        $params = $misCursos;
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
    if ($nombre === "") {
        api_json(["ok" => false, "error" => "nombre requerido"], 400);
    }

    $curso_id = resolverCursoId($pdo, $curso);

    if (api_es_preceptor()) {
        $misCursos = api_cursos_del_preceptor($pdo);
        if ($curso_id === null || !in_array($curso_id, $misCursos, true)) {
            api_json(["ok" => false, "error" => "no podes agregar alumnos a un curso que no tenes asignado"], 403);
        }
    }

    $stmt = $pdo->prepare("INSERT INTO alumnos (nombre, apellido, dni, email, curso_id, estado) VALUES (?, ?, ?, ?, ?, 1)");
    $stmt->execute([$nombre, $apellido, $dni, $email, $curso_id]);
    $id = $pdo->lastInsertId();

    registrarAuditoria("alumnos.crear", "alumno", $id, ["nombre" => $nombre, "apellido" => $apellido, "dni" => $dni, "curso" => $curso, "curso_id" => $curso_id]);

    api_json(["ok" => true, "alumno" => ["id" => (string) $id, "nombre" => $nombre, "apellido" => $apellido, "dni" => $dni, "curso" => $curso, "email" => $email]]);
}

if ($method === "PUT") {
    api_requerir_permiso("alumnos.editar");
$d = api_body();
    $id = (int) ($d["id"] ?? 0);
    $nombre = trim((string) ($d["nombre"] ?? ""));
    $apellido = trim((string) ($d["apellido"] ?? ""));
    $curso = trim((string) ($d["curso"] ?? ""));
    $email = trim((string) ($d["email"] ?? ""));
    $dni = trim((string) ($d["dni"] ?? ""));
    if ($id <= 0) {
        api_json(["ok" => false, "error" => "id inválido"], 400);
    }

    $actual = $pdo->prepare("SELECT curso_id FROM alumnos WHERE id_alumno = ?");
    $actual->execute([$id]);
    if ($actual->rowCount() === 0) {
        api_json(["ok" => false, "error" => "alumno no encontrado"], 404);
    }
    $cursoIdActual = (int) $actual->fetchColumn();

    $curso_id = resolverCursoId($pdo, $curso);

    if (api_es_preceptor()) {
        $misCursos = api_cursos_del_preceptor($pdo);
        if (!in_array($cursoIdActual, $misCursos, true)) {
            api_json(["ok" => false, "error" => "no podes modificar alumnos de un curso que no tenes asignado"], 403);
        }
        if ($curso_id !== null && !in_array($curso_id, $misCursos, true)) {
            api_json(["ok" => false, "error" => "no podes mover al alumno a un curso que no tenes asignado"], 403);
        }
        api_requerir_contrasena($pdo, (string) ($d["contrasena"] ?? ""));
    }

    $stmt = $pdo->prepare("UPDATE alumnos SET nombre = ?, apellido = ?, dni = ?, email = ?, curso_id = ? WHERE id_alumno = ?");
    $stmt->execute([$nombre, $apellido, $dni, $email, $curso_id, $id]);

    registrarAuditoria("alumnos.editar", "alumno", $id, ["nombre" => $nombre, "apellido" => $apellido, "dni" => $dni, "curso" => $curso, "curso_id" => $curso_id]);

    api_json(["ok" => true]);
}

if ($method === "DELETE") {
    api_requerir_permiso("alumnos.dar_baja");
    $id = (int) ($_GET["id"] ?? 0);
    $d = api_body();
    if ($id <= 0) {
        api_json(["ok" => false, "error" => "id inválido"], 400);
    }

    $actual = $pdo->prepare("SELECT curso_id FROM alumnos WHERE id_alumno = ?");
    $actual->execute([$id]);
    if ($actual->rowCount() === 0) {
        api_json(["ok" => false, "error" => "alumno no encontrado"], 404);
    }
    $cursoIdActual = (int) $actual->fetchColumn();

    if (api_es_preceptor()) {
        $misCursos = api_cursos_del_preceptor($pdo);
        if (!in_array($cursoIdActual, $misCursos, true)) {
            api_json(["ok" => false, "error" => "no podes quitar alumnos de un curso que no tenes asignado"], 403);
        }
        api_requerir_contrasena($pdo, (string) ($d["contrasena"] ?? ""));
    }

    $pdo->prepare("DELETE FROM alumnos WHERE id_alumno = ?")->execute([$id]);

    registrarAuditoria("alumnos.dar_baja", "alumno", $id, ["curso_id" => $cursoIdActual]);

    api_json(["ok" => true]);
}
