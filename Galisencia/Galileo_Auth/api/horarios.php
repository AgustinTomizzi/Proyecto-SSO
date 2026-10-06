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
        WHERE a.usuario_id = ? AND a.estado = 1
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
    if (api_rol_es("Tutor") && !in_array($cursoId, api_cursos_del_tutor(usuarioActual()), true)) {
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
    } elseif (api_rol_es("Tutor")) {
        $cursosTutor = api_cursos_del_tutor(usuarioActual());
        if (!$cursosTutor) {
            api_json(["ok" => true, "cursos" => []]);
        }
        $where = "WHERE c.id_cursos IN (" . implode(",", array_fill(0, count($cursosTutor), "?")) . ")";
        array_push($params, ...$cursosTutor);
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

// La imagen por curso quedó como histórico de solo lectura: los horarios se
// cargan en la grilla (horario_grilla.php).
api_json(["ok" => false, "error" => "la imagen de horario es de solo lectura: cargá el horario en la grilla"], 410);
