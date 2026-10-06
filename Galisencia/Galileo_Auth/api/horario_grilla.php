<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "PUT", "DELETE"]);

// Grilla de horarios: cada celda (horario_clases) es curso + día + franja con
// materia, docente y aula opcionales y una vigencia [desde, hasta].

const GRILLA_SIN_FIN = "9999-12-31";

function grilla_clase_publica($c)
{
    return [
        "id" => (string) $c["id_clase"],
        "cursoId" => (string) $c["curso_id"],
        "curso" => $c["curso"],
        "dia" => (int) $c["dia_semana"],
        "franjaId" => (string) $c["franja_id"],
        "horaInicio" => substr((string) $c["hora_inicio"], 0, 5),
        "horaFin" => substr((string) $c["hora_fin"], 0, 5),
        "materiaId" => (string) $c["materia_id"],
        "materia" => $c["materia"],
        "docenteId" => $c["docente_id"] !== null ? (string) $c["docente_id"] : null,
        "docente" => $c["docente"],
        "aulaId" => $c["aula_resource_id"] !== null ? (string) $c["aula_resource_id"] : null,
        "aula" => $c["aula"],
        "vigenteDesde" => $c["vigente_desde"],
        "vigenteHasta" => $c["vigente_hasta"],
    ];
}

const GRILLA_SELECT = "
    SELECT hc.id_clase, hc.curso_id, CONCAT(cu.anio, ' ', cu.division) AS curso, hc.dia_semana, hc.franja_id,
           f.hora_inicio, f.hora_fin, hc.materia_id, m.nombre AS materia, hc.docente_id,
           NULLIF(TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))), '') AS docente,
           hc.aula_resource_id, r.name AS aula, hc.vigente_desde, hc.vigente_hasta
    FROM horario_clases hc
    JOIN cursos cu ON cu.id_cursos = hc.curso_id
    JOIN franjas_horarias f ON f.id_franja = hc.franja_id
    JOIN materias m ON m.id_materia = hc.materia_id
    LEFT JOIN usuarios u ON u.id_usuario = hc.docente_id
    LEFT JOIN resources r ON r.id_resource = hc.aula_resource_id
";

function grilla_clase($id)
{
    global $pdo;
    $stmt = $pdo->prepare(GRILLA_SELECT . " WHERE hc.id_clase = ?");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

/** Curso del alumno en sesión (por email hasta que exista alumnos.usuario_id). */
function grilla_curso_del_alumno()
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT a.curso_id FROM alumnos a WHERE a.email = ? AND a.estado = 1 LIMIT 1");
    $stmt->execute([api_email_usuario(usuarioActual())]);
    $cursoId = $stmt->fetchColumn();
    return $cursoId === false || $cursoId === null ? null : (int) $cursoId;
}

if ($method === "GET") {
    api_requerir_permiso("horarios.ver");

    $fecha = trim((string) ($_GET["fecha"] ?? ""));
    if ($fecha === "") {
        $fecha = date("Y-m-d");
    } elseif (!api_fecha_valida($fecha)) {
        api_json(["ok" => false, "error" => "fecha invalida; use el formato YYYY-MM-DD"], 400);
    }

    $filtros = [];
    foreach (["cursoId" => "hc.curso_id", "docenteId" => "hc.docente_id", "aulaId" => "hc.aula_resource_id"] as $param => $columna) {
        if (isset($_GET[$param]) && $_GET[$param] !== "") {
            $valor = api_id_positivo($_GET[$param]);
            if ($valor === null) {
                api_json(["ok" => false, "error" => "$param debe ser un entero positivo"], 400);
            }
            $filtros[$columna] = $valor;
        }
    }

    if (api_rol_es("Alumno")) {
        $propio = grilla_curso_del_alumno();
        if (isset($filtros["hc.curso_id"]) && $filtros["hc.curso_id"] !== $propio) {
            api_json(["ok" => false, "error" => "solo podés ver el horario de tu curso"], 403);
        }
        $filtros = ["hc.curso_id" => $propio ?? 0];
    }
    if (!$filtros) {
        api_json(["ok" => false, "error" => "indicá cursoId, docenteId o aulaId"], 400);
    }

    $where = ["hc.vigente_desde <= ?", "COALESCE(hc.vigente_hasta, '" . GRILLA_SIN_FIN . "') >= ?"];
    $params = [$fecha, $fecha];
    foreach ($filtros as $columna => $valor) {
        $where[] = "$columna = ?";
        $params[] = $valor;
    }
    $stmt = $pdo->prepare(GRILLA_SELECT . " WHERE " . implode(" AND ", $where) . " ORDER BY hc.dia_semana, f.hora_inicio, curso");
    $stmt->execute($params);
    $clases = array_map("grilla_clase_publica", $stmt->fetchAll());

    // Franjas: las del turno del curso pedido; si se filtra por docente o aula,
    // las de todos los turnos.
    if (isset($filtros["hc.curso_id"])) {
        $stmt = $pdo->prepare("SELECT f.* FROM franjas_horarias f JOIN cursos c ON c.turno = f.turno WHERE c.id_cursos = ? ORDER BY f.orden");
        $stmt->execute([$filtros["hc.curso_id"]]);
    } else {
        $stmt = $pdo->query("SELECT * FROM franjas_horarias ORDER BY hora_inicio, orden");
    }
    $franjas = array_map(fn ($f) => [
        "id" => (string) $f["id_franja"],
        "turno" => $f["turno"],
        "orden" => (int) $f["orden"],
        "horaInicio" => substr((string) $f["hora_inicio"], 0, 5),
        "horaFin" => substr((string) $f["hora_fin"], 0, 5),
        "esRecreo" => (bool) $f["es_recreo"],
    ], $stmt->fetchAll());

    api_json(["ok" => true, "fecha" => $fecha, "franjas" => $franjas, "clases" => $clases]);
}

api_requerir_permiso("horarios.gestionar");
$d = api_body();

if ($method === "DELETE") {
    $id = api_id_positivo($d["id"] ?? ($_GET["id"] ?? null));
    if ($id === null) {
        api_json(["ok" => false, "error" => "id invalido"], 400);
    }
    $pdo->beginTransaction();
    try {
        $antes = grilla_clase($id);
        if (!$antes) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "clase no encontrada"], 404);
        }
        $pdo->prepare("DELETE FROM horario_clases WHERE id_clase = ?")->execute([$id]);
        registrarAuditoria("horarios.gestionar", "horario_clase", $id, ["accion" => "eliminar", "antes" => grilla_clase_publica($antes)]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    api_json(["ok" => true]);
}

// POST (alta) y PUT (edición): mismos datos y validaciones.
$id = null;
$actual = null;
if ($method === "PUT") {
    $id = api_id_positivo($d["id"] ?? null);
    if ($id === null) {
        api_json(["ok" => false, "error" => "id invalido"], 400);
    }
    $actual = grilla_clase($id);
    if (!$actual) {
        api_json(["ok" => false, "error" => "clase no encontrada"], 404);
    }
}

$cursoId = api_id_positivo($d["cursoId"] ?? ($actual["curso_id"] ?? null));
$dia = filter_var($d["dia"] ?? ($actual["dia_semana"] ?? null), FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 5]]);
$franjaId = api_id_positivo($d["franjaId"] ?? ($actual["franja_id"] ?? null));
$materia = api_pide_materia($d)
    ? api_resolver_materia($d["materiaId"] ?? null, $d["materia"] ?? null)
    : ($actual ? ["id" => (int) $actual["materia_id"], "nombre" => $actual["materia"]] : null);
$docenteId = array_key_exists("docenteId", $d) ? ($d["docenteId"] === null || $d["docenteId"] === "" ? null : api_id_positivo($d["docenteId"])) : ($actual["docente_id"] ?? null);
$aulaId = array_key_exists("aulaId", $d) ? ($d["aulaId"] === null || $d["aulaId"] === "" ? null : api_id_positivo($d["aulaId"])) : ($actual["aula_resource_id"] ?? null);
$desde = trim((string) ($d["vigenteDesde"] ?? ($actual["vigente_desde"] ?? date("Y-m-d"))));
$hasta = array_key_exists("vigenteHasta", $d) ? ($d["vigenteHasta"] === null || $d["vigenteHasta"] === "" ? null : trim((string) $d["vigenteHasta"])) : ($actual["vigente_hasta"] ?? null);

if ($cursoId === null || $dia === false || $franjaId === null) {
    api_json(["ok" => false, "error" => "cursoId, dia (1 a 5) y franjaId son requeridos"], 400);
}
if ($materia === null) {
    api_json(["ok" => false, "error" => api_pide_materia($d) ? "materia inexistente" : "materiaId es requerido"], 400);
}
if ((array_key_exists("docenteId", $d) && $d["docenteId"] !== null && $d["docenteId"] !== "" && $docenteId === null)
    || (array_key_exists("aulaId", $d) && $d["aulaId"] !== null && $d["aulaId"] !== "" && $aulaId === null)) {
    api_json(["ok" => false, "error" => "docenteId y aulaId deben ser enteros positivos"], 400);
}
if (!api_fecha_valida($desde) || ($hasta !== null && (!api_fecha_valida($hasta) || $hasta < $desde))) {
    api_json(["ok" => false, "error" => "vigencia invalida: use YYYY-MM-DD y hasta >= desde"], 400);
}

$pdo->beginTransaction();
try {
    // Bloquea el curso para serializar ediciones concurrentes de su grilla.
    $stmt = $pdo->prepare("SELECT id_cursos, turno FROM cursos WHERE id_cursos = ? FOR UPDATE");
    $stmt->execute([$cursoId]);
    $curso = $stmt->fetch();
    if (!$curso) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "curso no encontrado"], 404);
    }

    $stmt = $pdo->prepare("SELECT turno, hora_inicio, hora_fin, es_recreo FROM franjas_horarias WHERE id_franja = ?");
    $stmt->execute([$franjaId]);
    $franja = $stmt->fetch();
    if (!$franja) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "franja no encontrada"], 404);
    }
    if ($franja["turno"] !== $curso["turno"]) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "la franja no corresponde al turno del curso"], 400);
    }
    if ((int) $franja["es_recreo"] === 1) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "no se pueden asignar clases en un recreo"], 400);
    }

    if ($docenteId !== null) {
        $stmt = $pdo->prepare("SELECT r.nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?");
        $stmt->execute([$docenteId]);
        $rolDocente = $stmt->fetchColumn();
        if ($rolDocente === false) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "docente no encontrado"], 404);
        }
        if (strcasecmp((string) $rolDocente, "Docente") !== 0) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el usuario indicado no tiene rol Docente"], 400);
        }
    }
    if ($aulaId !== null) {
        $stmt = $pdo->prepare("SELECT type, active FROM resources WHERE id_resource = ?");
        $stmt->execute([$aulaId]);
        $aula = $stmt->fetch();
        if (!$aula) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "aula no encontrada"], 404);
        }
        if ($aula["type"] !== "desktop_pc" || !(int) $aula["active"]) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el recurso indicado no es un aula activa"], 400);
        }
    }

    // Choques: vigencias superpuestas y mismo día; para docente y aula se
    // comparan horarios reales (turnos distintos tienen franjas distintas).
    $vigencia = "hc.vigente_desde <= ? AND COALESCE(hc.vigente_hasta, '" . GRILLA_SIN_FIN . "') >= ?";
    $vigenciaParams = [$hasta ?? GRILLA_SIN_FIN, $desde];
    $excluir = $id ?? 0;

    $stmt = $pdo->prepare("SELECT hc.id_clase FROM horario_clases hc WHERE hc.curso_id = ? AND hc.dia_semana = ? AND hc.franja_id = ? AND hc.id_clase <> ? AND $vigencia LIMIT 1 FOR UPDATE");
    $stmt->execute(array_merge([$cursoId, $dia, $franjaId, $excluir], $vigenciaParams));
    if ($stmt->fetchColumn()) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "esa celda del curso ya tiene una clase en la vigencia indicada"], 409);
    }

    $choque = "SELECT CONCAT(cu.anio, ' ', cu.division) AS curso FROM horario_clases hc
               JOIN franjas_horarias f ON f.id_franja = hc.franja_id
               JOIN cursos cu ON cu.id_cursos = hc.curso_id
               WHERE %s = ? AND hc.dia_semana = ? AND hc.id_clase <> ?
                 AND f.hora_inicio < ? AND ? < f.hora_fin AND $vigencia LIMIT 1 FOR UPDATE";
    $horario = [$franja["hora_fin"], $franja["hora_inicio"]];
    if ($docenteId !== null) {
        $stmt = $pdo->prepare(sprintf($choque, "hc.docente_id"));
        $stmt->execute(array_merge([$docenteId, $dia, $excluir], $horario, $vigenciaParams));
        $otro = $stmt->fetchColumn();
        if ($otro !== false) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el docente ya tiene clase en $otro en ese horario"], 409);
        }
    }
    if ($aulaId !== null) {
        $stmt = $pdo->prepare(sprintf($choque, "hc.aula_resource_id"));
        $stmt->execute(array_merge([$aulaId, $dia, $excluir], $horario, $vigenciaParams));
        $otro = $stmt->fetchColumn();
        if ($otro !== false) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el aula ya está ocupada por $otro en ese horario"], 409);
        }
    }

    $valores = [$cursoId, $dia, $franjaId, $materia["id"], $docenteId, $aulaId, $desde, $hasta];
    if ($method === "POST") {
        $pdo->prepare("INSERT INTO horario_clases (curso_id, dia_semana, franja_id, materia_id, docente_id, aula_resource_id, vigente_desde, vigente_hasta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute($valores);
        $id = (int) $pdo->lastInsertId();
    } else {
        $pdo->prepare("UPDATE horario_clases SET curso_id = ?, dia_semana = ?, franja_id = ?, materia_id = ?, docente_id = ?, aula_resource_id = ?, vigente_desde = ?, vigente_hasta = ? WHERE id_clase = ?")
            ->execute(array_merge($valores, [$id]));
    }
    $despues = grilla_clase($id);
    registrarAuditoria("horarios.gestionar", "horario_clase", $id, [
        "accion" => $method === "POST" ? "crear" : "editar",
        "antes" => $actual ? grilla_clase_publica($actual) : null,
        "despues" => grilla_clase_publica($despues),
    ]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(["ok" => true, "clase" => grilla_clase_publica($despues)], $method === "POST" ? 201 : 200);
