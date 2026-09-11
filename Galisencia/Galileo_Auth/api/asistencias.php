<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST"]);
$usuarioId = (int) ($_SESSION["id_usuario"] ?? 0);

if ($method === "GET") {
    api_requerir_permiso("asistencia.ver");
    $where = ["a.estado = 1"];
    $params = [];

    if (isset($_GET["alumnoId"]) && $_GET["alumnoId"] !== "") {
        $alumnoId = api_id_positivo($_GET["alumnoId"]);
        if ($alumnoId === null) {
            api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
        }
        $where[] = "asi.alumno_id = ?";
        $params[] = $alumnoId;
    }
    if (isset($_GET["fecha"]) && $_GET["fecha"] !== "") {
        $fecha = trim((string) $_GET["fecha"]);
        if (!api_fecha_valida($fecha)) {
            api_json(["ok" => false, "error" => "fecha invalida; use el formato YYYY-MM-DD"], 400);
        }
        $where[] = "asi.fecha = ?";
        $params[] = $fecha;
    }
    if (isset($_GET["materia"]) && trim((string) $_GET["materia"]) !== "") {
        if (strlen(trim((string) $_GET["materia"])) > 255) {
            api_json(["ok" => false, "error" => "materia no puede superar 255 caracteres"], 400);
        }
        $where[] = "asi.materia = ?";
        $params[] = trim((string) $_GET["materia"]);
    }
    if (isset($_GET["cursoId"]) && $_GET["cursoId"] !== "") {
        $cursoId = api_id_positivo($_GET["cursoId"]);
        if ($cursoId === null) {
            api_json(["ok" => false, "error" => "cursoId debe ser un entero positivo"], 400);
        }
        $where[] = "a.curso_id = ?";
        $params[] = $cursoId;
    }
    if (isset($_GET["ciclo"]) && trim((string) $_GET["ciclo"]) !== "") {
        $ciclo = trim((string) $_GET["ciclo"]);
        if (!preg_match('/^\d{4}$/', $ciclo)) {
            api_json(["ok" => false, "error" => "ciclo debe ser un año de cuatro dígitos"], 400);
        }
        $where[] = "YEAR(asi.fecha) = ?";
        $params[] = (int) $ciclo;
    }

    if (api_rol_es("Alumno")) {
        $where[] = "a.email = (SELECT u.email FROM usuarios u WHERE u.id_usuario = ?)";
        $params[] = $usuarioId;
    } elseif (api_rol_es("Preceptor")) {
        $where[] = "c.preceptor_id = ?";
        $params[] = $usuarioId;
    }

    $sql = "SELECT asi.id_asistencia AS id, asi.alumno_id AS alumnoId, asi.materia, asi.fecha, asi.estado FROM asistencias asi INNER JOIN alumnos a ON a.id_alumno = asi.alumno_id LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE " . implode(" AND ", $where) . " ORDER BY asi.fecha, asi.id_asistencia";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    api_json(["ok" => true, "registros" => $stmt->fetchAll()]);
}

api_requerir_permiso("asistencia.registrar");
$d = api_body();
$alumnoId = api_id_positivo($d["alumnoId"] ?? null);
$materia = trim((string) ($d["materia"] ?? ""));
$fecha = trim((string) ($d["fecha"] ?? ""));
$estado = trim((string) ($d["estado"] ?? ""));

if ($alumnoId === null) {
    api_json(["ok" => false, "error" => "alumnoId debe ser un entero positivo"], 400);
}
if ($materia === "" || strlen($materia) > 255) {
    api_json(["ok" => false, "error" => "materia es requerida y no puede superar 255 caracteres"], 400);
}
if (!api_fecha_valida($fecha)) {
    api_json(["ok" => false, "error" => "fecha invalida; use el formato YYYY-MM-DD"], 400);
}
if (!in_array($estado, ["presente", "tarde", "ausente"], true)) {
    api_json(["ok" => false, "error" => "estado debe ser presente, tarde o ausente"], 400);
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("SELECT a.id_alumno, a.email, a.curso_id, c.preceptor_id FROM alumnos a LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE a.id_alumno = ? AND a.estado = 1 FOR UPDATE");
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();
    if (!$alumno) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no existe o esta inactivo"], 400);
    }

    if (api_rol_es("Alumno")) {
        $emailSesion = api_email_usuario($usuarioId);
        if ($emailSesion === null || strcasecmp((string) $alumno["email"], (string) $emailSesion) !== 0) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "solo podes operar sobre tu propia asistencia"], 403);
        }
    } elseif (api_rol_es("Preceptor") && (int) $alumno["preceptor_id"] !== $usuarioId) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos asignados"], 403);
    }

    $stmt = $pdo->prepare("SELECT id_asistencia, alumno_id, materia, fecha, estado FROM asistencias WHERE alumno_id = ? AND materia = ? AND fecha = ? LIMIT 1 FOR UPDATE");
    $stmt->execute([$alumnoId, $materia, $fecha]);
    $antes = $stmt->fetch();
    if ($antes) {
        if (!api_tiene_permiso("asistencia.editar")) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "sin permiso para editar una asistencia existente"], 403);
        }
        $pdo->prepare("UPDATE asistencias SET estado = ? WHERE id_asistencia = ?")->execute([$estado, $antes["id_asistencia"]]);
        $id = $antes["id_asistencia"];
        $accion = "asistencia.editar";
    } else {
        $pdo->prepare("INSERT INTO asistencias (fecha, estado, alumno_id, materia) VALUES (?, ?, ?, ?)")->execute([$fecha, $estado, $alumnoId, $materia]);
        $id = $pdo->lastInsertId();
        $accion = "asistencia.registrar";
    }

    $despues = ["alumno_id" => $alumnoId, "materia" => $materia, "fecha" => $fecha, "estado" => $estado];
    registrarAuditoria($accion, "asistencia", $id, ["antes" => $antes ?: null, "despues" => $despues]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(["ok" => true, "registro" => ["id" => (string) $id, "alumnoId" => (string) $alumnoId, "materia" => $materia, "fecha" => $fecha, "estado" => $estado]]);
