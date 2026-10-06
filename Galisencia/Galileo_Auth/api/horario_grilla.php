<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "PUT", "DELETE"]);

// Grilla de horarios con el formato del colegio: cada fila de horario_clases
// es curso + día + módulo + grupo (0 = curso completo, 1 y 2 = mitades), con
// materia, docente y aula opcionales y una vigencia [desde, hasta]. Una clase
// de varios módulos son varias filas consecutivas; la API permite crear,
// editar y borrar el bloque entero en una sola operación.

const GRILLA_SIN_FIN = "9999-12-31";

const GRILLA_SELECT = "
    SELECT hc.id_clase, hc.curso_id, CONCAT(cu.anio, ' ', cu.division) AS curso, hc.dia_semana, hc.franja_id,
           f.orden, f.turno, f.hora_inicio, f.hora_fin, hc.grupo, hc.materia_id, m.nombre AS materia, hc.docente_id,
           NULLIF(TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))), '') AS docente,
           hc.aula_id, au.codigo AS aula, hc.vigente_desde, hc.vigente_hasta
    FROM horario_clases hc
    JOIN cursos cu ON cu.id_cursos = hc.curso_id
    JOIN franjas_horarias f ON f.id_franja = hc.franja_id
    JOIN materias m ON m.id_materia = hc.materia_id
    LEFT JOIN usuarios u ON u.id_usuario = hc.docente_id
    LEFT JOIN aulas au ON au.id_aula = hc.aula_id
";

function grilla_clase_publica($c)
{
    return [
        "id" => (string) $c["id_clase"],
        "cursoId" => (string) $c["curso_id"],
        "curso" => $c["curso"],
        "dia" => (int) $c["dia_semana"],
        "franjaId" => (string) $c["franja_id"],
        "orden" => (int) $c["orden"],
        "turno" => $c["turno"],
        "horaInicio" => substr((string) $c["hora_inicio"], 0, 5),
        "horaFin" => substr((string) $c["hora_fin"], 0, 5),
        "grupo" => (int) $c["grupo"],
        "materiaId" => (string) $c["materia_id"],
        "materia" => $c["materia"],
        "docenteId" => $c["docente_id"] !== null ? (string) $c["docente_id"] : null,
        "docente" => $c["docente"],
        "aulaId" => $c["aula_id"] !== null ? (string) $c["aula_id"] : null,
        "aula" => $c["aula"],
        "vigenteDesde" => $c["vigente_desde"],
        "vigenteHasta" => $c["vigente_hasta"],
    ];
}

function grilla_clase($id)
{
    global $pdo;
    $stmt = $pdo->prepare(GRILLA_SELECT . " WHERE hc.id_clase = ?");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

/** Curso del alumno en sesión (alumnos.usuario_id). */
function grilla_curso_del_alumno()
{
    global $pdo;
    $alumno = api_alumno_del_usuario(usuarioActual());
    return $alumno && $alumno["curso_id"] !== null ? (int) $alumno["curso_id"] : null;
}

/** ids de un pedido: "ids" (lista) o "id". Devuelve null si alguno es inválido. */
function grilla_ids($d)
{
    $crudos = isset($d["ids"]) && is_array($d["ids"]) ? $d["ids"] : (isset($d["id"]) ? [$d["id"]] : ($_GET["id"] ?? null ? [$_GET["id"]] : []));
    if (!$crudos || count($crudos) > 12) {
        return null;
    }
    $ids = [];
    foreach ($crudos as $crudo) {
        $id = api_id_positivo($crudo);
        if ($id === null) {
            return null;
        }
        $ids[$id] = $id;
    }
    return array_values($ids);
}

/** Lee un id opcional del cuerpo: ausente = $actual, null o "" = null. */
function grilla_id_opcional($d, $campo, $actual, &$invalido)
{
    if (!array_key_exists($campo, $d)) {
        return $actual;
    }
    if ($d[$campo] === null || $d[$campo] === "") {
        return null;
    }
    $id = api_id_positivo($d[$campo]);
    if ($id === null) {
        $invalido = true;
    }
    return $id;
}

/**
 * Valida una fila de la grilla y responde con el error correspondiente si no
 * es válida (dentro de la transacción abierta). $excluir son los ids que se
 * están editando, para no chocar consigo mismos.
 */
function grilla_validar($fila, $excluir)
{
    global $pdo;
    $vigencia = "hc.vigente_desde <= ? AND COALESCE(hc.vigente_hasta, '" . GRILLA_SIN_FIN . "') >= ?";
    $vigenciaParams = [$fila["hasta"] ?? GRILLA_SIN_FIN, $fila["desde"]];
    $excluirSql = $excluir ? " AND hc.id_clase NOT IN (" . implode(",", array_fill(0, count($excluir), "?")) . ")" : "";

    // Celda del curso: el curso completo choca con cualquier grupo; los grupos
    // 1 y 2 pueden convivir.
    $stmt = $pdo->prepare("SELECT hc.grupo FROM horario_clases hc WHERE hc.curso_id = ? AND hc.dia_semana = ? AND hc.franja_id = ? AND (hc.grupo = ? OR hc.grupo = 0 OR ? = 0) AND $vigencia$excluirSql LIMIT 1 FOR UPDATE");
    $stmt->execute(array_merge([$fila["curso"], $fila["dia"], $fila["franja"], $fila["grupo"], $fila["grupo"]], $vigenciaParams, $excluir));
    if ($stmt->fetchColumn() !== false) {
        grilla_error("ese módulo del curso ya tiene una clase en la vigencia indicada", 409);
    }

    $choque = "SELECT CONCAT(cu.anio, ' ', cu.division) AS curso FROM horario_clases hc
               JOIN cursos cu ON cu.id_cursos = hc.curso_id
               WHERE %s = ? AND hc.dia_semana = ? AND hc.franja_id = ? AND $vigencia$excluirSql LIMIT 1 FOR UPDATE";
    if ($fila["docente"] !== null) {
        $stmt = $pdo->prepare(sprintf($choque, "hc.docente_id"));
        $stmt->execute(array_merge([$fila["docente"], $fila["dia"], $fila["franja"]], $vigenciaParams, $excluir));
        $otro = $stmt->fetchColumn();
        if ($otro !== false) {
            grilla_error("el docente ya tiene clase en $otro en ese horario", 409);
        }
    }
    if ($fila["aula"] !== null) {
        $stmt = $pdo->prepare("SELECT compartida FROM aulas WHERE id_aula = ?");
        $stmt->execute([$fila["aula"]]);
        if (!(int) $stmt->fetchColumn()) {
            $stmt = $pdo->prepare(sprintf($choque, "hc.aula_id"));
            $stmt->execute(array_merge([$fila["aula"], $fila["dia"], $fila["franja"]], $vigenciaParams, $excluir));
            $otro = $stmt->fetchColumn();
            if ($otro !== false) {
                grilla_error("el aula ya está ocupada por $otro en ese horario", 409);
            }
        }
    }
}

function grilla_error($mensaje, $codigo)
{
    global $pdo;
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    api_json(["ok" => false, "error" => $mensaje], $codigo);
}

/** Valida materia, docente y aula (una sola vez por pedido). */
function grilla_validar_referencias($docenteId, $aulaId)
{
    global $pdo;
    if ($docenteId !== null) {
        $stmt = $pdo->prepare("SELECT r.nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?");
        $stmt->execute([$docenteId]);
        $rol = $stmt->fetchColumn();
        if ($rol === false) {
            grilla_error("docente no encontrado", 404);
        }
        if (strcasecmp((string) $rol, "Docente") !== 0) {
            grilla_error("el usuario indicado no tiene rol Docente", 400);
        }
    }
    if ($aulaId !== null) {
        $stmt = $pdo->prepare("SELECT activa FROM aulas WHERE id_aula = ?");
        $stmt->execute([$aulaId]);
        $activa = $stmt->fetchColumn();
        if ($activa === false) {
            grilla_error("aula no encontrada", 404);
        }
        if (!(int) $activa) {
            grilla_error("el aula indicada no está activa", 400);
        }
    }
}

function grilla_vigencia_valida($desde, $hasta)
{
    return api_fecha_valida($desde) && ($hasta === null || (api_fecha_valida($hasta) && $hasta >= $desde));
}

if ($method === "GET" && isset($_GET["catalogos"])) {
    // Opciones para editar la grilla: docentes y aulas.
    api_requerir_permiso("horarios.gestionar");
    $docentes = $pdo->query("SELECT u.id_usuario AS id, TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE r.nombre = 'Docente' ORDER BY u.apellido, u.nombre")->fetchAll();
    $aulas = $pdo->query("SELECT id_aula AS id, codigo AS nombre, compartida FROM aulas WHERE activa = 1 ORDER BY codigo")->fetchAll();
    api_json(["ok" => true, "docentes" => $docentes, "aulas" => array_map(fn ($a) => ["id" => (string) $a["id"], "nombre" => $a["nombre"], "compartida" => (bool) $a["compartida"]], $aulas)]);
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
    foreach (["cursoId" => "hc.curso_id", "docenteId" => "hc.docente_id", "aulaId" => "hc.aula_id"] as $param => $columna) {
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
    } elseif (api_rol_es("Tutor")) {
        // Solo los cursos de sus alumnos vinculados; sin filtro, el del primero.
        $cursosTutor = api_cursos_del_tutor(usuarioActual());
        $pedido = $filtros["hc.curso_id"] ?? ($cursosTutor[0] ?? 0);
        if (!in_array($pedido, $cursosTutor, true)) {
            api_json(["ok" => false, "error" => "solo podés ver el horario del curso de tus alumnos"], 403);
        }
        $filtros = ["hc.curso_id" => $pedido];
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
    $stmt = $pdo->prepare(GRILLA_SELECT . " WHERE " . implode(" AND ", $where) . " ORDER BY hc.dia_semana, f.orden, hc.grupo, curso");
    $stmt->execute($params);
    $clases = array_map("grilla_clase_publica", $stmt->fetchAll());

    $franjas = array_map(fn ($f) => [
        "id" => (string) $f["id_franja"],
        "orden" => (int) $f["orden"],
        "turno" => $f["turno"],
        "horaInicio" => substr((string) $f["hora_inicio"], 0, 5),
        "horaFin" => substr((string) $f["hora_fin"], 0, 5),
    ], $pdo->query("SELECT * FROM franjas_horarias ORDER BY orden")->fetchAll());

    $titulo = null;
    if (isset($filtros["hc.curso_id"])) {
        $stmt = $pdo->prepare("SELECT id_cursos AS id, anio, division, turno FROM cursos WHERE id_cursos = ?");
        $stmt->execute([$filtros["hc.curso_id"]]);
        $titulo = $stmt->fetch() ?: null;
    }

    api_json(["ok" => true, "fecha" => $fecha, "curso" => $titulo, "franjas" => $franjas, "clases" => $clases]);
}

api_requerir_permiso("horarios.gestionar");
$d = api_body();

if ($method === "DELETE") {
    $ids = grilla_ids($d);
    if ($ids === null) {
        api_json(["ok" => false, "error" => "id o ids invalidos (hasta 12)"], 400);
    }
    $pdo->beginTransaction();
    try {
        $antes = [];
        foreach ($ids as $id) {
            $clase = grilla_clase($id);
            if (!$clase) {
                grilla_error("clase no encontrada", 404);
            }
            $antes[] = $clase;
        }
        $pdo->prepare("DELETE FROM horario_clases WHERE id_clase IN (" . implode(",", array_fill(0, count($ids), "?")) . ")")->execute($ids);
        foreach ($antes as $clase) {
            registrarAuditoria("horarios.gestionar", "horario_clase", $clase["id_clase"], ["accion" => "eliminar", "antes" => grilla_clase_publica($clase)]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    api_json(["ok" => true]);
}

if ($method === "POST") {
    // Alta de un bloque: franjaId (primer módulo) y opcional franjaHastaId (último).
    $cursoId = api_id_positivo($d["cursoId"] ?? null);
    $dia = filter_var($d["dia"] ?? null, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 5]]);
    $franjaId = api_id_positivo($d["franjaId"] ?? null);
    $franjaHastaId = isset($d["franjaHastaId"]) && $d["franjaHastaId"] !== "" ? api_id_positivo($d["franjaHastaId"]) : $franjaId;
    $grupo = filter_var($d["grupo"] ?? 0, FILTER_VALIDATE_INT, ["options" => ["min_range" => 0, "max_range" => 2]]);
    $invalido = false;
    $docenteId = grilla_id_opcional($d, "docenteId", null, $invalido);
    $aulaId = grilla_id_opcional($d, "aulaId", null, $invalido);
    $desde = trim((string) ($d["vigenteDesde"] ?? date("Y-m-d")));
    $hasta = isset($d["vigenteHasta"]) && $d["vigenteHasta"] !== "" ? trim((string) $d["vigenteHasta"]) : null;
    $materia = api_pide_materia($d) ? api_resolver_materia($d["materiaId"] ?? null, $d["materia"] ?? null) : null;

    if ($cursoId === null || $dia === false || $franjaId === null || $franjaHastaId === null || $grupo === false || $invalido) {
        api_json(["ok" => false, "error" => "cursoId, dia (1 a 5), franjaId y grupo (0, 1 o 2) son requeridos; docenteId y aulaId deben ser enteros positivos"], 400);
    }
    if ($materia === null) {
        api_json(["ok" => false, "error" => api_pide_materia($d) ? "materia inexistente" : "materiaId es requerido"], 400);
    }
    if (!grilla_vigencia_valida($desde, $hasta)) {
        api_json(["ok" => false, "error" => "vigencia invalida: use YYYY-MM-DD y hasta >= desde"], 400);
    }

    $pdo->beginTransaction();
    try {
        // Bloquea el curso para serializar ediciones concurrentes de su grilla.
        $stmt = $pdo->prepare("SELECT id_cursos FROM cursos WHERE id_cursos = ? FOR UPDATE");
        $stmt->execute([$cursoId]);
        if (!$stmt->fetchColumn()) {
            grilla_error("curso no encontrado", 404);
        }
        $stmt = $pdo->prepare("SELECT id_franja, orden FROM franjas_horarias WHERE id_franja IN (?, ?)");
        $stmt->execute([$franjaId, $franjaHastaId]);
        $extremos = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        if (!isset($extremos[$franjaId], $extremos[$franjaHastaId])) {
            grilla_error("franja no encontrada", 404);
        }
        if ($extremos[$franjaHastaId] < $extremos[$franjaId] || $extremos[$franjaHastaId] - $extremos[$franjaId] > 3) {
            grilla_error("el bloque debe ir hacia abajo y ocupar como máximo 4 módulos", 400);
        }
        $stmt = $pdo->prepare("SELECT id_franja FROM franjas_horarias WHERE orden BETWEEN ? AND ? ORDER BY orden");
        $stmt->execute([$extremos[$franjaId], $extremos[$franjaHastaId]]);
        $franjas = array_map("intval", $stmt->fetchAll(PDO::FETCH_COLUMN));

        grilla_validar_referencias($docenteId, $aulaId);
        $creadas = [];
        foreach ($franjas as $franja) {
            $fila = ["curso" => $cursoId, "dia" => $dia, "franja" => $franja, "grupo" => $grupo, "docente" => $docenteId, "aula" => $aulaId, "desde" => $desde, "hasta" => $hasta];
            grilla_validar($fila, []);
            $pdo->prepare("INSERT INTO horario_clases (curso_id, dia_semana, franja_id, grupo, materia_id, docente_id, aula_id, vigente_desde, vigente_hasta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                ->execute([$cursoId, $dia, $franja, $grupo, $materia["id"], $docenteId, $aulaId, $desde, $hasta]);
            $clase = grilla_clase((int) $pdo->lastInsertId());
            registrarAuditoria("horarios.gestionar", "horario_clase", $clase["id_clase"], ["accion" => "crear", "despues" => grilla_clase_publica($clase)]);
            $creadas[] = grilla_clase_publica($clase);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    api_json(["ok" => true, "clases" => $creadas, "clase" => $creadas[0]], 201);
}

// PUT: edita una clase ("id") o un bloque ("ids"). Los campos omitidos se
// conservan; null borra docente, aula o fin de vigencia. La posición (curso,
// día, módulo) solo se puede cambiar editando una clase sola.
$ids = grilla_ids($d);
if ($ids === null) {
    api_json(["ok" => false, "error" => "id o ids invalidos (hasta 12)"], 400);
}
$cambiaPosicion = array_key_exists("cursoId", $d) || array_key_exists("dia", $d) || array_key_exists("franjaId", $d);
if ($cambiaPosicion && count($ids) > 1) {
    api_json(["ok" => false, "error" => "para mover una clase editala de a una"], 400);
}
$materia = api_pide_materia($d) ? api_resolver_materia($d["materiaId"] ?? null, $d["materia"] ?? null) : false;
if ($materia === null) {
    api_json(["ok" => false, "error" => "materia inexistente"], 400);
}

$pdo->beginTransaction();
try {
    $actuales = [];
    foreach ($ids as $id) {
        $actual = grilla_clase($id);
        if (!$actual) {
            grilla_error("clase no encontrada", 404);
        }
        $actuales[] = $actual;
    }
    $despues = [];
    foreach ($actuales as $actual) {
        $invalido = false;
        $fila = [
            "curso" => api_id_positivo($d["cursoId"] ?? $actual["curso_id"]),
            "dia" => filter_var($d["dia"] ?? $actual["dia_semana"], FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 5]]),
            "franja" => api_id_positivo($d["franjaId"] ?? $actual["franja_id"]),
            "grupo" => filter_var($d["grupo"] ?? $actual["grupo"], FILTER_VALIDATE_INT, ["options" => ["min_range" => 0, "max_range" => 2]]),
            "docente" => grilla_id_opcional($d, "docenteId", $actual["docente_id"] !== null ? (int) $actual["docente_id"] : null, $invalido),
            "aula" => grilla_id_opcional($d, "aulaId", $actual["aula_id"] !== null ? (int) $actual["aula_id"] : null, $invalido),
            "desde" => trim((string) ($d["vigenteDesde"] ?? $actual["vigente_desde"])),
            "hasta" => array_key_exists("vigenteHasta", $d) ? ($d["vigenteHasta"] === null || $d["vigenteHasta"] === "" ? null : trim((string) $d["vigenteHasta"])) : $actual["vigente_hasta"],
        ];
        $materiaId = $materia !== false ? $materia["id"] : (int) $actual["materia_id"];
        if ($fila["curso"] === null || $fila["dia"] === false || $fila["franja"] === null || $fila["grupo"] === false || $invalido) {
            grilla_error("cursoId, dia (1 a 5), franjaId y grupo (0, 1 o 2) deben ser válidos", 400);
        }
        if (!grilla_vigencia_valida($fila["desde"], $fila["hasta"])) {
            grilla_error("vigencia invalida: use YYYY-MM-DD y hasta >= desde", 400);
        }
        if ($cambiaPosicion) {
            $stmt = $pdo->prepare("SELECT (SELECT COUNT(*) FROM cursos WHERE id_cursos = ?) AS curso, (SELECT COUNT(*) FROM franjas_horarias WHERE id_franja = ?) AS franja");
            $stmt->execute([$fila["curso"], $fila["franja"]]);
            $existe = $stmt->fetch();
            if (!(int) $existe["curso"] || !(int) $existe["franja"]) {
                grilla_error("curso o franja no encontrados", 404);
            }
        }
        grilla_validar_referencias($fila["docente"], $fila["aula"]);
        grilla_validar($fila, $ids);
        $pdo->prepare("UPDATE horario_clases SET curso_id = ?, dia_semana = ?, franja_id = ?, grupo = ?, materia_id = ?, docente_id = ?, aula_id = ?, vigente_desde = ?, vigente_hasta = ? WHERE id_clase = ?")
            ->execute([$fila["curso"], $fila["dia"], $fila["franja"], $fila["grupo"], $materiaId, $fila["docente"], $fila["aula"], $fila["desde"], $fila["hasta"], $actual["id_clase"]]);
        $nueva = grilla_clase($actual["id_clase"]);
        registrarAuditoria("horarios.gestionar", "horario_clase", $actual["id_clase"], [
            "accion" => "editar",
            "antes" => grilla_clase_publica($actual),
            "despues" => grilla_clase_publica($nueva),
        ]);
        $despues[] = grilla_clase_publica($nueva);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(["ok" => true, "clases" => $despues, "clase" => $despues[0]]);
