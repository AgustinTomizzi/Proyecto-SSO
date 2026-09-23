<?php

require_once __DIR__ . "/_common.php";

api_login_requerido();
$method = api_metodo(["GET", "POST", "DELETE"]);

function horario_curso_del_alumno()
{
    global $pdo;
    $stmt = $pdo->prepare("
        SELECT a.curso_id
        FROM alumnos a
        JOIN usuarios u ON u.email = a.email
        WHERE u.id_usuario = ? AND a.estado = 1
        LIMIT 1
    ");
    $stmt->execute([usuarioActual()]);
    $cursoId = $stmt->fetchColumn();
    return $cursoId === false || $cursoId === null ? null : (int) $cursoId;
}

function horario_validar_acceso_curso($cursoId)
{
    if (api_rol_es("Alumno") && horario_curso_del_alumno() !== $cursoId) {
        api_json(["ok" => false, "error" => "sin acceso a este curso"], 403);
    }
}

if ($method === "GET") {
    api_requerir_permiso("horarios.ver");
    $cursoSolicitado = api_id_positivo($_GET["cursoId"] ?? null);

    if (isset($_GET["imagen"])) {
        if ($cursoSolicitado === null) {
            api_json(["ok" => false, "error" => "cursoId invalido"], 400);
        }
        horario_validar_acceso_curso($cursoSolicitado);
        $stmt = $pdo->prepare("SELECT nombre_archivo, mime_type, tamanio, imagen FROM horarios_curso WHERE curso_id = ? LIMIT 1");
        $stmt->execute([$cursoSolicitado]);
        $horario = $stmt->fetch();
        if (!$horario) {
            api_json(["ok" => false, "error" => "horario no encontrado"], 404);
        }
        $nombre = str_replace(["\r", "\n", '"'], "", basename($horario["nombre_archivo"]));
        header_remove("Content-Type");
        header("Content-Type: " . $horario["mime_type"]);
        header("Content-Length: " . $horario["tamanio"]);
        header("Cache-Control: private, max-age=300");
        header("Content-Disposition: " . (isset($_GET["download"]) ? "attachment" : "inline") . "; filename=\"" . $nombre . "\"");
        echo $horario["imagen"];
        exit;
    }

    $params = [];
    $where = "";
    if (api_rol_es("Alumno")) {
        $cursoId = horario_curso_del_alumno();
        if ($cursoId === null) {
            api_json(["ok" => true, "cursos" => []]);
        }
        $where = "WHERE c.id_cursos = ?";
        $params[] = $cursoId;
    } elseif ($cursoSolicitado !== null) {
        $where = "WHERE c.id_cursos = ?";
        $params[] = $cursoSolicitado;
    }
    $stmt = $pdo->prepare("
        SELECT c.id_cursos AS id, c.anio, c.division, c.turno,
               h.id_horario AS horarioId, h.nombre_archivo AS nombreArchivo,
               h.mime_type AS mimeType, h.tamanio, h.actualizado_en AS actualizadoEn
        FROM cursos c
        LEFT JOIN horarios_curso h ON h.curso_id = c.id_cursos
        $where
        ORDER BY c.anio, c.division, c.turno
    ");
    $stmt->execute($params);
    api_json(["ok" => true, "cursos" => $stmt->fetchAll()]);
}

api_requerir_permiso("horarios.gestionar");

if ($method === "POST") {
    $cursoId = api_id_positivo($_POST["cursoId"] ?? null);
    if ($cursoId === null || !isset($_FILES["imagen"])) {
        api_json(["ok" => false, "error" => "curso e imagen son requeridos"], 400);
    }
    $curso = $pdo->prepare("SELECT 1 FROM cursos WHERE id_cursos = ?");
    $curso->execute([$cursoId]);
    if (!$curso->fetchColumn()) {
        api_json(["ok" => false, "error" => "curso no encontrado"], 404);
    }
    $archivo = $_FILES["imagen"];
    if (($archivo["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        api_json(["ok" => false, "error" => "no se pudo recibir la imagen"], 400);
    }
    $tamanio = (int) ($archivo["size"] ?? 0);
    if ($tamanio <= 0 || $tamanio > 5 * 1024 * 1024) {
        api_json(["ok" => false, "error" => "la imagen debe pesar hasta 5 MB"], 400);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($archivo["tmp_name"]);
    if (!in_array($mime, ["image/png", "image/jpeg", "image/webp"], true) || @getimagesize($archivo["tmp_name"]) === false) {
        api_json(["ok" => false, "error" => "solo se aceptan imagenes PNG, JPG o WEBP validas"], 400);
    }
    $contenido = file_get_contents($archivo["tmp_name"]);
    if ($contenido === false) {
        api_json(["ok" => false, "error" => "no se pudo leer la imagen"], 400);
    }
    $nombre = mb_substr(basename((string) $archivo["name"]), 0, 255);
    $stmt = $pdo->prepare("
        INSERT INTO horarios_curso (curso_id, nombre_archivo, mime_type, tamanio, imagen, actualizado_por)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE nombre_archivo = VALUES(nombre_archivo), mime_type = VALUES(mime_type),
          tamanio = VALUES(tamanio), imagen = VALUES(imagen), actualizado_por = VALUES(actualizado_por), actualizado_en = CURRENT_TIMESTAMP
    ");
    $stmt->execute([$cursoId, $nombre, $mime, $tamanio, $contenido, usuarioActual()]);
    registrarAuditoria("horarios.gestionar", "horario_curso", $cursoId, ["accion" => "cargar", "nombre" => $nombre, "mime" => $mime, "tamanio" => $tamanio]);
    api_json(["ok" => true, "mensaje" => "horario guardado"], 201);
}

$data = api_body();
$cursoId = api_id_positivo($data["cursoId"] ?? null);
if ($cursoId === null) {
    api_json(["ok" => false, "error" => "cursoId invalido"], 400);
}
$stmt = $pdo->prepare("DELETE FROM horarios_curso WHERE curso_id = ?");
$stmt->execute([$cursoId]);
if ($stmt->rowCount() === 0) {
    api_json(["ok" => false, "error" => "horario no encontrado"], 404);
}
registrarAuditoria("horarios.gestionar", "horario_curso", $cursoId, ["accion" => "eliminar"]);
api_json(["ok" => true, "mensaje" => "horario eliminado"]);
