<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    api_json(["ok" => false, "error" => "método no permitido"], 405);
}
api_requerir_permiso("reportes.ver");

$alumnosSql = "
    SELECT a.id_alumno AS id, CONCAT(a.nombre, ' ', a.apellido) AS nombre,
           CONCAT(c.anio, ' ', c.division) AS curso, a.email
    FROM alumnos a
    LEFT JOIN cursos c ON a.curso_id = c.id_cursos
";
[$scopeSql, $scopeParams] = api_alumnos_scope_sql($pdo, "a");
if ($scopeSql !== null) {
    $alumnosSql .= " WHERE $scopeSql";
}
$alumnosStmt = $pdo->prepare($alumnosSql);
$alumnosStmt->execute($scopeParams);
$alumnos = $alumnosStmt->fetchAll();

$alumnoIds = array_map("intval", array_column($alumnos, "id"));
$asigs = [];
if ($alumnoIds) {
    $placeholders = implode(",", array_fill(0, count($alumnoIds), "?"));
    $asigsStmt = $pdo->prepare("SELECT alumno_id, estado FROM asistencias WHERE alumno_id IN ($placeholders)");
    $asigsStmt->execute($alumnoIds);
    $asigs = $asigsStmt->fetchAll();
}

$por = [];
foreach ($asigs as $r) {
    $por[$r["alumno_id"]] ??= ["total" => 0, "puntos" => 0];
    $por[$r["alumno_id"]]["total"]++;
    $por[$r["alumno_id"]]["puntos"] += $r["estado"] === "presente" ? 1 : ($r["estado"] === "tarde" ? 0.5 : 0);
}

$UMBRAL = 75;
$totalAl = count($alumnos);
$promSum = 0;
$enRiesgo = 0;
$porCurso = [];
$riesgo = [];

foreach ($alumnos as $a) {
    $g = $por[$a["id"]] ?? null;
    $pct = ($g && $g["total"]) ? round(($g["puntos"] / $g["total"]) * 100) : null;
    $promSum += $pct ?? 100;
    if ($pct !== null && $pct < $UMBRAL) {
        $enRiesgo++;
        $riesgo[] = ["alumno" => $a, "general" => $pct];
    }
    $curso = $a["curso"];
    $porCurso[$curso] ??= ["curso" => $curso, "promedio" => 0, "enRiesgo" => 0, "_n" => 0, "_s" => 0];
    $porCurso[$curso]["_n"]++;
    $porCurso[$curso]["_s"] += $pct ?? 100;
    if ($pct !== null && $pct < $UMBRAL) {
        $porCurso[$curso]["enRiesgo"]++;
    }
}

$promedio = $totalAl ? round($promSum / $totalAl) : 0;
$pc = array_map(function ($c) {
    return [
        "curso" => $c["curso"],
        "promedio" => $c["_n"] ? round($c["_s"] / $c["_n"]) : 0,
        "enRiesgo" => $c["enRiesgo"],
    ];
}, array_values($porCurso));

usort($riesgo, function ($x, $y) {
    return $x["general"] <=> $y["general"];
});

api_json(["ok" => true, "resumen" => [
    "promedio" => $promedio,
    "totalAlumnos" => $totalAl,
    "enRiesgo" => $enRiesgo,
    "porCurso" => $pc,
    "alumnosEnRiesgo" => $riesgo,
]]);
