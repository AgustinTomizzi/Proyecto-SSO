<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST"]);
api_requerir_permiso("ciclos.promover");

// Promoción de ciclo lectivo. GET: vista previa con los alumnos activos por
// curso y una sugerencia por curso. POST: aplica en lote promover (al año
// siguiente), repetir (mismo año), egresar (solo 7º) o dar de baja, y puede
// cerrar el ciclo cuando ya no quedan alumnos sin procesar.

const PROMOCION_ULTIMO_ANIO = 7;
const PROMOCION_MAX_LOTE = 1000;
const PROMOCION_TIPOS_CIERRE = "('promocion', 'repitencia', 'egreso')";

function promocion_ciclo($anio, $bloquear = false)
{
    global $pdo;
    $stmt = $pdo->prepare("SELECT id_ciclo, anio, estado, cerrado_en FROM ciclos_lectivos WHERE anio = ?" . ($bloquear ? " FOR UPDATE" : ""));
    $stmt->execute([$anio]);
    return $stmt->fetch() ?: null;
}

/** Curso sugerido del año siguiente: misma división; de letras a números (A→1) al pasar a 4º. */
function promocion_sugerencia(array $curso, array $porAnioDivision)
{
    $anio = (int) $curso["anio"];
    if ($anio >= PROMOCION_ULTIMO_ANIO) {
        return ["accion" => "egresar", "cursoDestinoId" => null];
    }
    $division = (string) $curso["division"];
    $siguiente = $anio + 1;
    $candidatas = [$division];
    if (ctype_alpha($division)) {
        $candidatas[] = (string) (ord(strtoupper($division)) - ord("A") + 1);
    }
    foreach ($candidatas as $candidata) {
        if (isset($porAnioDivision[$siguiente][$candidata])) {
            return ["accion" => "promover", "cursoDestinoId" => (string) $porAnioDivision[$siguiente][$candidata]];
        }
    }
    return ["accion" => "promover", "cursoDestinoId" => null];
}

$anio = filter_var($_GET["ciclo"] ?? date("Y"), FILTER_VALIDATE_INT, ["options" => ["min_range" => 2000, "max_range" => 2100]]);
if ($anio === false) {
    api_json(["ok" => false, "error" => "ciclo debe ser un año de cuatro dígitos"], 400);
}

if ($method === "GET") {
    $ciclo = promocion_ciclo($anio);
    $cursos = $pdo->query("SELECT id_cursos AS id, anio, division FROM cursos ORDER BY CAST(anio AS UNSIGNED), division")->fetchAll();
    $porAnioDivision = [];
    foreach ($cursos as $curso) {
        $porAnioDivision[(int) $curso["anio"]][(string) $curso["division"]] = (int) $curso["id"];
    }
    $stmt = $pdo->prepare("
        SELECT a.id_alumno AS id, a.nombre, a.apellido, a.curso_id AS cursoId,
               (SELECT m.tipo FROM alumno_movimientos m WHERE m.alumno_id = a.id_alumno AND m.ciclo_lectivo = ? AND m.tipo IN " . PROMOCION_TIPOS_CIERRE . " ORDER BY m.id_movimiento DESC LIMIT 1) AS procesado
        FROM alumnos a
        WHERE a.estado = 1 AND a.curso_id IS NOT NULL
        ORDER BY a.apellido, a.nombre
    ");
    $stmt->execute([$anio]);
    $alumnosPorCurso = [];
    $pendientes = 0;
    foreach ($stmt->fetchAll() as $alumno) {
        $alumnosPorCurso[(int) $alumno["cursoId"]][] = [
            "id" => (string) $alumno["id"],
            "nombre" => $alumno["nombre"],
            "apellido" => $alumno["apellido"],
            "procesado" => $alumno["procesado"],
        ];
        if ($alumno["procesado"] === null) {
            $pendientes++;
        }
    }
    $respuesta = [];
    foreach ($cursos as $curso) {
        $respuesta[] = [
            "id" => (string) $curso["id"],
            "anio" => (string) $curso["anio"],
            "division" => (string) $curso["division"],
            "alumnos" => $alumnosPorCurso[(int) $curso["id"]] ?? [],
            "sugerencia" => promocion_sugerencia($curso, $porAnioDivision),
        ];
    }
    api_json([
        "ok" => true,
        "ciclo" => $ciclo ? ["anio" => (int) $ciclo["anio"], "estado" => $ciclo["estado"], "cerradoEn" => $ciclo["cerrado_en"]] : ["anio" => $anio, "estado" => "abierto", "cerradoEn" => null],
        "pendientes" => $pendientes,
        "cursos" => $respuesta,
    ]);
}

// POST
$d = api_body();
$movimientos = $d["movimientos"] ?? [];
$cerrar = !empty($d["cerrarCiclo"]);
if (!is_array($movimientos) || count($movimientos) > PROMOCION_MAX_LOTE || (!$movimientos && !$cerrar)) {
    api_json(["ok" => false, "error" => "movimientos debe ser una lista de hasta " . PROMOCION_MAX_LOTE . " alumnos (o pedir cerrarCiclo)"], 400);
}

$acciones = ["promover" => "promocion", "repetir" => "repitencia", "egresar" => "egreso", "baja" => "baja"];
$pedidos = [];
foreach ($movimientos as $i => $m) {
    $alumnoId = api_id_positivo($m["alumnoId"] ?? null);
    $accion = (string) ($m["accion"] ?? "");
    $destino = isset($m["cursoDestinoId"]) && $m["cursoDestinoId"] !== null && $m["cursoDestinoId"] !== "" ? api_id_positivo($m["cursoDestinoId"]) : null;
    if ($alumnoId === null || !isset($acciones[$accion]) || (isset($m["cursoDestinoId"]) && $m["cursoDestinoId"] !== null && $m["cursoDestinoId"] !== "" && $destino === null)) {
        api_json(["ok" => false, "error" => "movimiento " . ($i + 1) . ": alumnoId, accion (promover, repetir, egresar o baja) y cursoDestinoId válidos"], 400);
    }
    if (isset($pedidos[$alumnoId])) {
        api_json(["ok" => false, "error" => "el alumno $alumnoId aparece dos veces en el lote"], 400);
    }
    $pedidos[$alumnoId] = ["accion" => $accion, "destino" => $destino];
}

$pdo->beginTransaction();
try {
    $ciclo = promocion_ciclo($anio, true);
    if (!$ciclo) {
        $pdo->prepare("INSERT INTO ciclos_lectivos (anio, estado) VALUES (?, 'abierto')")->execute([$anio]);
        $ciclo = promocion_ciclo($anio, true);
    }
    if ($ciclo["estado"] === "cerrado") {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "el ciclo $anio ya está cerrado"], 409);
    }

    $resumen = ["promover" => 0, "repetir" => 0, "egresar" => 0, "baja" => 0];
    $cursos = [];
    foreach ($pdo->query("SELECT id_cursos, anio FROM cursos")->fetchAll() as $c) {
        $cursos[(int) $c["id_cursos"]] = (int) $c["anio"];
    }
    $yaProcesado = $pdo->prepare("SELECT tipo FROM alumno_movimientos WHERE alumno_id = ? AND ciclo_lectivo = ? AND tipo IN " . PROMOCION_TIPOS_CIERRE . " LIMIT 1");
    $leerAlumno = $pdo->prepare("SELECT id_alumno, curso_id, estado FROM alumnos WHERE id_alumno = ? FOR UPDATE");
    $registrar = $pdo->prepare("INSERT INTO alumno_movimientos (alumno_id, tipo, curso_origen_id, curso_destino_id, ciclo_lectivo, realizado_por) VALUES (?, ?, ?, ?, ?, ?)");

    foreach ($pedidos as $alumnoId => $pedido) {
        $leerAlumno->execute([$alumnoId]);
        $alumno = $leerAlumno->fetch();
        if (!$alumno || (int) $alumno["estado"] !== 1 || $alumno["curso_id"] === null) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el alumno $alumnoId no existe, está inactivo o no tiene curso"], 400);
        }
        $yaProcesado->execute([$alumnoId, $anio]);
        if ($yaProcesado->fetchColumn() !== false) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "el alumno $alumnoId ya fue procesado en el ciclo $anio"], 409);
        }
        $origen = (int) $alumno["curso_id"];
        $anioOrigen = $cursos[$origen] ?? 0;
        $destino = $pedido["destino"];
        switch ($pedido["accion"]) {
            case "promover":
                if ($destino === null || !isset($cursos[$destino]) || $cursos[$destino] !== $anioOrigen + 1) {
                    $pdo->rollBack();
                    api_json(["ok" => false, "error" => "el alumno $alumnoId debe pasar a un curso de " . ($anioOrigen + 1) . "º año"], 400);
                }
                $pdo->prepare("UPDATE alumnos SET curso_id = ? WHERE id_alumno = ?")->execute([$destino, $alumnoId]);
                break;
            case "repetir":
                $destino ??= $origen;
                if (!isset($cursos[$destino]) || $cursos[$destino] !== $anioOrigen) {
                    $pdo->rollBack();
                    api_json(["ok" => false, "error" => "si repite, el alumno $alumnoId queda en un curso de {$anioOrigen}º año"], 400);
                }
                $pdo->prepare("UPDATE alumnos SET curso_id = ? WHERE id_alumno = ?")->execute([$destino, $alumnoId]);
                break;
            case "egresar":
                if ($anioOrigen !== PROMOCION_ULTIMO_ANIO) {
                    $pdo->rollBack();
                    api_json(["ok" => false, "error" => "solo egresan alumnos de " . PROMOCION_ULTIMO_ANIO . "º año"], 400);
                }
                $destino = null;
                $pdo->prepare("UPDATE alumnos SET estado = 0 WHERE id_alumno = ?")->execute([$alumnoId]);
                break;
            case "baja":
                $destino = null;
                $pdo->prepare("UPDATE alumnos SET estado = 0 WHERE id_alumno = ?")->execute([$alumnoId]);
                break;
        }
        $registrar->execute([$alumnoId, $acciones[$pedido["accion"]], $origen, $destino, $anio, usuarioActual()]);
        $resumen[$pedido["accion"]]++;
    }

    if ($cerrar) {
        $pendientes = (int) $pdo->query("
            SELECT COUNT(*) FROM alumnos a
            WHERE a.estado = 1 AND a.curso_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM alumno_movimientos m WHERE m.alumno_id = a.id_alumno AND m.ciclo_lectivo = " . (int) $anio . " AND m.tipo IN " . PROMOCION_TIPOS_CIERRE . ")
        ")->fetchColumn();
        if ($pendientes > 0) {
            $pdo->rollBack();
            api_json(["ok" => false, "error" => "quedan $pendientes alumnos sin procesar: no se puede cerrar el ciclo $anio", "pendientes" => $pendientes], 409);
        }
        $pdo->prepare("UPDATE ciclos_lectivos SET estado = 'cerrado', cerrado_por = ?, cerrado_en = NOW() WHERE anio = ?")->execute([usuarioActual(), $anio]);
        $pdo->prepare("INSERT IGNORE INTO ciclos_lectivos (anio, estado) VALUES (?, 'abierto')")->execute([$anio + 1]);
    }

    registrarAuditoria("ciclos.promover", "ciclo_lectivo", $anio, ["resumen" => $resumen, "cerrado" => $cerrar]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(["ok" => true, "ciclo" => $anio, "resumen" => $resumen, "cerrado" => $cerrar]);
