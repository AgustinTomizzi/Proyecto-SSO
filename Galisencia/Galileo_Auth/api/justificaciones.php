<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "DELETE"]);
$usuarioId = (int) usuarioActual();

// Justificación de inasistencias. Una justificación cubre un rango de fechas de
// un alumno: sus ausencias en ese rango (y las que se carguen después) pasan a
// "justificado". El motivo y el adjunto pueden ser datos de salud de un menor:
// solo los ven quien puede justificar dentro de su alcance y el propio alumno.

const JUSTIF_MAX_ADJUNTO = 5 * 1024 * 1024;
const JUSTIF_TIPOS = ["application/pdf" => "pdf", "image/jpeg" => "jpg", "image/png" => "png"];
const JUSTIF_MAX_DIAS = 60;

function justif_alumno($alumnoId)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT id_alumno, nombre, apellido, curso_id, usuario_id, estado FROM alumnos WHERE id_alumno = ?");
    $stmt->execute([$alumnoId]);
    return $stmt->fetch() ?: null;
}

/** El alumno está en el alcance de lectura de la sesión (igual que asistencias.php). */
function justif_puede_ver(array $alumno, $usuarioId)
{
    if (api_rol_es("Alumno")) {
        return (int) $alumno["usuario_id"] === $usuarioId;
    }
    if (api_rol_es("Preceptor")) {
        return in_array((int) $alumno["curso_id"], api_cursos_del_preceptor($usuarioId), true);
    }
    if (api_rol_es("Docente")) {
        return in_array((int) $alumno["curso_id"], api_cursos_del_docente($usuarioId), true);
    }
    return true;
}

/** Puede justificar a este alumno: permiso y, para el Preceptor, curso a cargo. */
function justif_puede_justificar(array $alumno, $usuarioId)
{
    if (!api_tiene_permiso("asistencia.justificar")) {
        return false;
    }
    return !api_rol_es("Preceptor") || in_array((int) $alumno["curso_id"], api_cursos_del_preceptor($usuarioId), true);
}

/** Puede ver motivo y adjunto: quien justifica en su alcance o el propio alumno. */
function justif_ve_detalle(array $alumno, $usuarioId)
{
    return justif_puede_justificar($alumno, $usuarioId) || (api_rol_es("Alumno") && (int) $alumno["usuario_id"] === $usuarioId);
}

if ($method === "GET") {
    api_requerir_permiso("asistencia.ver");

    // Descarga del adjunto.
    if (isset($_GET["adjunto"])) {
        $id = api_id_positivo($_GET["id"] ?? null);
        if ($id === null) {
            api_json(["ok" => false, "error" => "id debe ser un entero positivo"], 400);
        }
        $stmt = $pdo->prepare("SELECT alumno_id, adjunto, adjunto_tipo FROM justificaciones WHERE id_justificacion = ?");
        $stmt->execute([$id]);
        $fila = $stmt->fetch();
        $alumno = $fila ? justif_alumno((int) $fila["alumno_id"]) : null;
        if (!$fila || !$alumno || !justif_puede_ver($alumno, $usuarioId)) {
            api_json(["ok" => false, "error" => "justificación no encontrada"], 404);
        }
        if (!justif_ve_detalle($alumno, $usuarioId)) {
            api_json(["ok" => false, "error" => "no podés ver el adjunto de esta justificación"], 403);
        }
        if ($fila["adjunto"] === null) {
            api_json(["ok" => false, "error" => "la justificación no tiene adjunto"], 404);
        }
        $tipo = isset(JUSTIF_TIPOS[$fila["adjunto_tipo"]]) ? $fila["adjunto_tipo"] : "application/octet-stream";
        $extension = JUSTIF_TIPOS[$fila["adjunto_tipo"]] ?? "bin";
        header("Content-Type: $tipo");
        header("Content-Disposition: attachment; filename=\"justificacion-$id.$extension\"");
        header("X-Content-Type-Options: nosniff");
        header("Cache-Control: private, no-store");
        header("Content-Length: " . strlen($fila["adjunto"]));
        echo $fila["adjunto"];
        exit;
    }

    $alumnoId = isset($_GET["alumnoId"]) && $_GET["alumnoId"] !== "" ? api_id_positivo($_GET["alumnoId"]) : null;
    $cursoId = isset($_GET["cursoId"]) && $_GET["cursoId"] !== "" ? api_id_positivo($_GET["cursoId"]) : null;
    if (($alumnoId === null) === ($cursoId === null)) {
        api_json(["ok" => false, "error" => "indicá alumnoId o cursoId (enteros positivos)"], 400);
    }
    if ($alumnoId !== null) {
        $alumno = justif_alumno($alumnoId);
        if (!$alumno || !justif_puede_ver($alumno, $usuarioId)) {
            api_json(["ok" => false, "error" => "el alumno no existe o no está en tu alcance"], 403);
        }
    }
    $stmt = $pdo->prepare("
        SELECT j.id_justificacion AS id, j.alumno_id AS alumnoId, a.nombre, a.apellido, a.curso_id, a.usuario_id,
               j.desde, j.hasta, j.motivo, j.adjunto IS NOT NULL AS tieneAdjunto, j.adjunto_nombre AS adjuntoNombre,
               CONCAT(u.nombre, ' ', u.apellido) AS creadoPor, j.creado_en AS creadoEn,
               (SELECT COUNT(*) FROM asistencias asi WHERE asi.justificacion_id = j.id_justificacion) AS ausenciasJustificadas
        FROM justificaciones j
        JOIN alumnos a ON a.id_alumno = j.alumno_id
        LEFT JOIN usuarios u ON u.id_usuario = j.creado_por
        WHERE " . ($alumnoId !== null ? "j.alumno_id = ?" : "a.curso_id = ?") . "
        ORDER BY j.desde DESC, j.id_justificacion DESC
    ");
    $stmt->execute([$alumnoId ?? $cursoId]);
    $respuesta = [];
    foreach ($stmt->fetchAll() as $fila) {
        $alumno = ["curso_id" => $fila["curso_id"], "usuario_id" => $fila["usuario_id"]];
        if (!justif_puede_ver($alumno, $usuarioId)) {
            continue;
        }
        $detalle = justif_ve_detalle($alumno, $usuarioId);
        $respuesta[] = [
            "id" => (string) $fila["id"],
            "alumnoId" => (string) $fila["alumnoId"],
            "alumno" => trim($fila["nombre"] . " " . $fila["apellido"]),
            "desde" => $fila["desde"],
            "hasta" => $fila["hasta"],
            "motivo" => $detalle ? $fila["motivo"] : null,
            "tieneAdjunto" => (bool) $fila["tieneAdjunto"],
            "adjuntoNombre" => $detalle ? $fila["adjuntoNombre"] : null,
            "creadoPor" => $fila["creadoPor"],
            "creadoEn" => $fila["creadoEn"],
            "ausenciasJustificadas" => (int) $fila["ausenciasJustificadas"],
            "puedeEliminar" => justif_puede_justificar($alumno, $usuarioId),
        ];
    }
    api_json(["ok" => true, "justificaciones" => $respuesta]);
}

api_requerir_permiso("asistencia.justificar");

if ($method === "DELETE") {
    $d = api_body();
    $id = api_id_positivo($d["id"] ?? null);
    if ($id === null) {
        api_json(["ok" => false, "error" => "id debe ser un entero positivo"], 400);
    }
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("SELECT id_justificacion, alumno_id, desde, hasta FROM justificaciones WHERE id_justificacion = ? FOR UPDATE");
        $stmt->execute([$id]);
        $fila = $stmt->fetch();
        $alumno = $fila ? justif_alumno((int) $fila["alumno_id"]) : null;
        if (!$fila || !$alumno) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "justificación no encontrada"], 404);
        }
        if (!justif_puede_justificar($alumno, $usuarioId)) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos"], 403);
        }
        $revertir = $pdo->prepare("UPDATE asistencias SET estado = 'ausente', justificacion_id = NULL WHERE justificacion_id = ?");
        $revertir->execute([$id]);
        $revertidas = $revertir->rowCount();
        $pdo->prepare("DELETE FROM justificaciones WHERE id_justificacion = ?")->execute([$id]);
        registrarAuditoria("asistencia.justificacion_eliminar", "justificacion", $id, ["alumno_id" => (int) $fila["alumno_id"], "desde" => $fila["desde"], "hasta" => $fila["hasta"], "ausencias" => $revertidas]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    api_json(["ok" => true, "ausenciasRevertidas" => $revertidas]);
}

// POST: JSON o multipart/form-data (con el campo "archivo").
if ((int) ($_SERVER["CONTENT_LENGTH"] ?? 0) > 6 * 1024 * 1024) {
    api_json(["ok" => false, "error" => "el adjunto no puede superar los 5 MB"], 413);
}
$esMultipart = str_starts_with(strtolower((string) ($_SERVER["CONTENT_TYPE"] ?? "")), "multipart/form-data");
$d = $esMultipart ? $_POST : api_body();
$alumnoId = api_id_positivo($d["alumnoId"] ?? null);
$desde = trim((string) ($d["desde"] ?? ""));
$hasta = trim((string) ($d["hasta"] ?? ""));
$motivo = trim((string) ($d["motivo"] ?? ""));
if ($alumnoId === null || !api_fecha_valida($desde) || !api_fecha_valida($hasta) || $desde > $hasta) {
    api_json(["ok" => false, "error" => "alumnoId, desde y hasta (YYYY-MM-DD, en orden) son requeridos"], 400);
}
if ((new DateTimeImmutable($desde))->diff(new DateTimeImmutable($hasta))->days >= JUSTIF_MAX_DIAS) {
    api_json(["ok" => false, "error" => "una justificación cubre hasta " . JUSTIF_MAX_DIAS . " días"], 400);
}
if ($hasta > date("Y-m-d", strtotime("+30 days"))) {
    api_json(["ok" => false, "error" => "se puede justificar por adelantado hasta 30 días"], 400);
}
if (mb_strlen($motivo) < 3 || mb_strlen($motivo) > 255) {
    api_json(["ok" => false, "error" => "el motivo debe tener entre 3 y 255 caracteres"], 400);
}

$adjunto = null;
$adjuntoNombre = null;
$adjuntoTipo = null;
$archivo = $_FILES["archivo"] ?? null;
if ($archivo && ($archivo["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    if (in_array($archivo["error"], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $archivo["size"] > JUSTIF_MAX_ADJUNTO) {
        api_json(["ok" => false, "error" => "el adjunto no puede superar los 5 MB"], 413);
    }
    if ($archivo["error"] !== UPLOAD_ERR_OK || !is_uploaded_file($archivo["tmp_name"])) {
        api_json(["ok" => false, "error" => "no se pudo recibir el adjunto"], 400);
    }
    // El tipo se decide por el contenido, no por la extensión ni por lo que diga el navegador.
    $adjuntoTipo = (new finfo(FILEINFO_MIME_TYPE))->file($archivo["tmp_name"]) ?: "";
    if (!isset(JUSTIF_TIPOS[$adjuntoTipo])) {
        api_json(["ok" => false, "error" => "el adjunto tiene que ser PDF, JPG o PNG"], 400);
    }
    $adjunto = file_get_contents($archivo["tmp_name"]);
    $limpio = preg_replace('/[^\p{L}\p{N} ._()-]+/u', "_", basename((string) $archivo["name"]));
    $adjuntoNombre = mb_substr($limpio ?: "adjunto", 0, 255);
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("SELECT id_alumno, nombre, apellido, curso_id, usuario_id, estado FROM alumnos WHERE id_alumno = ? FOR UPDATE");
    $stmt->execute([$alumnoId]);
    $alumno = $stmt->fetch();
    if (!$alumno || (int) $alumno["estado"] !== 1) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no existe o está inactivo"], 400);
    }
    if (!justif_puede_justificar($alumno, $usuarioId)) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el alumno no pertenece a uno de tus cursos"], 403);
    }
    $stmt = $pdo->prepare("SELECT 1 FROM justificaciones WHERE alumno_id = ? AND desde <= ? AND hasta >= ? LIMIT 1");
    $stmt->execute([$alumnoId, $hasta, $desde]);
    if ($stmt->fetchColumn()) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "ya hay una justificación del alumno que se superpone con esas fechas"], 409);
    }
    $stmt = $pdo->prepare("INSERT INTO justificaciones (alumno_id, desde, hasta, motivo, adjunto, adjunto_nombre, adjunto_tipo, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bindValue(1, $alumnoId, PDO::PARAM_INT);
    $stmt->bindValue(2, $desde);
    $stmt->bindValue(3, $hasta);
    $stmt->bindValue(4, $motivo);
    $stmt->bindValue(5, $adjunto, $adjunto === null ? PDO::PARAM_NULL : PDO::PARAM_LOB);
    $stmt->bindValue(6, $adjuntoNombre);
    $stmt->bindValue(7, $adjuntoTipo);
    $stmt->bindValue(8, $usuarioId, PDO::PARAM_INT);
    $stmt->execute();
    $id = (int) $pdo->lastInsertId();
    $justificar = $pdo->prepare("UPDATE asistencias SET estado = 'justificado', justificacion_id = ? WHERE alumno_id = ? AND fecha BETWEEN ? AND ? AND estado = 'ausente'");
    $justificar->execute([$id, $alumnoId, $desde, $hasta]);
    $ausencias = $justificar->rowCount();
    // Sin el motivo: puede ser un dato de salud (CLAUDE.md, regla 5).
    registrarAuditoria("asistencia.justificar", "justificacion", $id, ["alumno_id" => $alumnoId, "desde" => $desde, "hasta" => $hasta, "ausencias" => $ausencias, "adjunto" => $adjunto !== null]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(["ok" => true, "justificacion" => [
    "id" => (string) $id,
    "alumnoId" => (string) $alumnoId,
    "alumno" => trim($alumno["nombre"] . " " . $alumno["apellido"]),
    "desde" => $desde,
    "hasta" => $hasta,
    "motivo" => $motivo,
    "tieneAdjunto" => $adjunto !== null,
    "adjuntoNombre" => $adjuntoNombre,
    "ausenciasJustificadas" => $ausencias,
]], 201);
