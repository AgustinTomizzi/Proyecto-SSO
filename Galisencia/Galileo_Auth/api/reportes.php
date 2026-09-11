<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_metodo(["GET"]);

$esAlumno = api_rol_es("Alumno");
$esPreceptor = api_rol_es("Preceptor");
if (!api_tiene_permiso("reportes.ver") && !$esAlumno && !$esPreceptor) {
    api_json(["ok" => false, "error" => "sin permiso"], 403);
}

$usuarioId = (int) ($_SESSION["id_usuario"] ?? 0);
$cursoId = null;
if (isset($_GET["cursoId"]) && $_GET["cursoId"] !== "") {
    $cursoId = api_id_positivo($_GET["cursoId"]);
    if ($cursoId === null) {
        api_json(["ok" => false, "error" => "cursoId debe ser un entero positivo"], 400);
    }
}
$ciclo = isset($_GET["ciclo"]) ? trim((string) $_GET["ciclo"]) : "";
if ($ciclo !== "" && !preg_match('/^\d{4}$/', $ciclo)) {
    api_json(["ok" => false, "error" => "ciclo debe ser un año de cuatro dígitos"], 400);
}
$materia = isset($_GET["materia"]) ? trim((string) $_GET["materia"]) : "";
if (strlen($materia) > 255) {
    api_json(["ok" => false, "error" => "materia no puede superar 255 caracteres"], 400);
}

if ($esPreceptor && $cursoId !== null && !in_array($cursoId, api_cursos_del_preceptor($usuarioId), true)) {
    api_json(["ok" => false, "error" => "el curso no esta entre tus cursos asignados"], 403);
}

$where = ["a.estado = 1"];
$params = [];
if ($cursoId !== null) {
    $where[] = "a.curso_id = ?";
    $params[] = $cursoId;
}
if ($esAlumno) {
    $where[] = "a.email = (SELECT u.email FROM usuarios u WHERE u.id_usuario = ?)";
    $params[] = $usuarioId;
} elseif ($esPreceptor) {
    $where[] = "c.preceptor_id = ?";
    $params[] = $usuarioId;
}

$sql = "SELECT a.id_alumno AS id, a.nombre, a.apellido, CONCAT(c.anio, ' ', c.division) AS curso, a.curso_id AS cursoId, c.anio, c.division, a.email FROM alumnos a LEFT JOIN cursos c ON c.id_cursos = a.curso_id WHERE " . implode(" AND ", $where) . " ORDER BY a.apellido, a.nombre";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$alumnos = $stmt->fetchAll();

$ids = array_map("intval", array_column($alumnos, "id"));
$asistencias = [];
if ($ids) {
    $asistenciaWhere = ["alumno_id IN (" . implode(",", array_fill(0, count($ids), "?")) . ")"];
    $asistenciaParams = $ids;
    if ($materia !== "") {
        $asistenciaWhere[] = "materia = ?";
        $asistenciaParams[] = $materia;
    }
    if ($ciclo !== "") {
        $asistenciaWhere[] = "YEAR(fecha) = ?";
        $asistenciaParams[] = (int) $ciclo;
    }
    $stmt = $pdo->prepare("SELECT alumno_id, materia, estado FROM asistencias WHERE " . implode(" AND ", $asistenciaWhere));
    $stmt->execute($asistenciaParams);
    $asistencias = $stmt->fetchAll();
}

$acumulados = [];
foreach ($asistencias as $registro) {
    $alumnoId = (int) $registro["alumno_id"];
    $nombreMateria = $registro["materia"];
    if (!isset($acumulados[$alumnoId])) {
        $acumulados[$alumnoId] = ["total" => 0, "puntos" => 0, "materias" => []];
    }
    if (!isset($acumulados[$alumnoId]["materias"][$nombreMateria])) {
        $acumulados[$alumnoId]["materias"][$nombreMateria] = ["total" => 0, "puntos" => 0, "presentes" => 0, "tardes" => 0, "ausencias" => 0];
    }
    $puntos = $registro["estado"] === "presente" ? 1 : ($registro["estado"] === "tarde" ? 0.5 : 0);
    $acumulados[$alumnoId]["total"]++;
    $acumulados[$alumnoId]["puntos"] += $puntos;
    $acumulados[$alumnoId]["materias"][$nombreMateria]["total"]++;
    $acumulados[$alumnoId]["materias"][$nombreMateria]["puntos"] += $puntos;
    if ($registro["estado"] === "presente") {
        $acumulados[$alumnoId]["materias"][$nombreMateria]["presentes"]++;
    } elseif ($registro["estado"] === "tarde") {
        $acumulados[$alumnoId]["materias"][$nombreMateria]["tardes"]++;
    } else {
        $acumulados[$alumnoId]["materias"][$nombreMateria]["ausencias"]++;
    }
}

$umbral = 75;
$estadisticas = [];
$riesgo = [];
$porCurso = [];
$sumaGeneral = 0;
$conDatos = 0;

foreach ($alumnos as $alumno) {
    $id = (int) $alumno["id"];
    $datos = $acumulados[$id] ?? null;
    $general = $datos && $datos["total"] > 0 ? round(($datos["puntos"] / $datos["total"]) * 100) : null;
    $porMateria = [];
    foreach (($datos["materias"] ?? []) as $nombreMateria => $detalle) {
        $pct = round(($detalle["puntos"] / $detalle["total"]) * 100);
        $porMateria[] = [
            "materia" => $nombreMateria,
            "total" => $detalle["total"],
            "presentes" => $detalle["presentes"],
            "tardes" => $detalle["tardes"],
            "ausencias" => $detalle["ausencias"],
            "pct" => $pct,
            "enRiesgo" => $pct < $umbral,
        ];
    }
    usort($porMateria, function ($a, $b) {
        return strcasecmp($a["materia"], $b["materia"]);
    });

    $alumnoRespuesta = [
        "id" => (string) $alumno["id"],
        "nombre" => trim($alumno["nombre"] . " " . $alumno["apellido"]),
        "nombreAlumno" => $alumno["nombre"],
        "apellido" => $alumno["apellido"],
        "curso" => $alumno["curso"],
        "cursoId" => $alumno["cursoId"],
        "anio" => $alumno["anio"],
        "division" => $alumno["division"],
        "email" => $alumno["email"],
    ];
    $item = ["alumno" => $alumnoRespuesta, "general" => $general, "enRiesgo" => $general !== null && $general < $umbral, "porMateria" => $porMateria];
    $estadisticas[] = $item;

    $curso = $alumno["curso"] ?: "Sin curso";
    if (!isset($porCurso[$curso])) {
        $porCurso[$curso] = ["curso" => $curso, "promedio" => null, "enRiesgo" => 0, "_n" => 0, "_s" => 0];
    }
    if ($general !== null) {
        $sumaGeneral += $general;
        $conDatos++;
        $porCurso[$curso]["_n"]++;
        $porCurso[$curso]["_s"] += $general;
        if ($general < $umbral) {
            $porCurso[$curso]["enRiesgo"]++;
            $riesgo[] = $item;
        }
    }
}

$cursosRespuesta = array_map(function ($curso) {
    return [
        "curso" => $curso["curso"],
        "promedio" => $curso["_n"] > 0 ? round($curso["_s"] / $curso["_n"]) : null,
        "enRiesgo" => $curso["enRiesgo"],
    ];
}, array_values($porCurso));
usort($riesgo, function ($a, $b) {
    return $a["general"] <=> $b["general"];
});

api_json(["ok" => true, "resumen" => [
    "promedio" => $conDatos > 0 ? round($sumaGeneral / $conDatos) : null,
    "totalAlumnos" => count($alumnos),
    "alumnosConDatos" => $conDatos,
    "enRiesgo" => count($riesgo),
    "porCurso" => $cursosRespuesta,
    "alumnos" => $estadisticas,
    "alumnosEnRiesgo" => $riesgo,
]]);
