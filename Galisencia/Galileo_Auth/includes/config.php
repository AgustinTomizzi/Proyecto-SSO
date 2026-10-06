<?php

require_once __DIR__ . "/../config/database.php";

/*
 * Configuración institucional. Las claves válidas, su tipo, sus límites y su
 * valor por defecto se definen acá; la tabla config_institucion guarda solo los
 * valores que la administración cambió (db/16-config-institucion.sql).
 */

const CONFIG_TURNOS = ["manana" => "Mañana", "tarde" => "Tarde", "vespertino" => "Vespertino"];

function config_esquema()
{
    return [
        "reservas.manana_habilitado" => ["tipo" => "bool", "defecto" => true, "etiqueta" => "Turno mañana habilitado"],
        "reservas.manana_desde" => ["tipo" => "hora", "defecto" => "07:00", "etiqueta" => "Apertura del turno mañana"],
        "reservas.manana_hasta" => ["tipo" => "hora", "defecto" => "13:00", "etiqueta" => "Cierre del turno mañana"],
        "reservas.tarde_habilitado" => ["tipo" => "bool", "defecto" => true, "etiqueta" => "Turno tarde habilitado"],
        "reservas.tarde_desde" => ["tipo" => "hora", "defecto" => "13:00", "etiqueta" => "Apertura del turno tarde"],
        "reservas.tarde_hasta" => ["tipo" => "hora", "defecto" => "17:30", "etiqueta" => "Cierre del turno tarde"],
        "reservas.vespertino_habilitado" => ["tipo" => "bool", "defecto" => true, "etiqueta" => "Turno vespertino habilitado"],
        "reservas.vespertino_desde" => ["tipo" => "hora", "defecto" => "17:30", "etiqueta" => "Apertura del turno vespertino"],
        "reservas.vespertino_hasta" => ["tipo" => "hora", "defecto" => "22:00", "etiqueta" => "Cierre del turno vespertino"],
        "reservas.duracion_maxima_min" => ["tipo" => "int", "min" => 15, "max" => 900, "defecto" => 240, "etiqueta" => "Duración máxima de una reserva (minutos)"],
        "reservas.anticipacion_minima_horas" => ["tipo" => "int", "min" => 0, "max" => 168, "defecto" => 0, "etiqueta" => "Anticipación mínima (horas; 0 = sin mínimo)"],
        "reservas.anticipacion_maxima_dias" => ["tipo" => "int", "min" => 0, "max" => 365, "defecto" => 90, "etiqueta" => "Anticipación máxima (días; 0 = sin límite)"],
        "notificaciones.recordatorio_horas" => ["tipo" => "int", "min" => 0, "max" => 168, "defecto" => 24, "etiqueta" => "Recordatorio antes de una reserva (horas; 0 = sin recordatorio)"],
        "notificaciones.hora_resumen_inasistencias" => ["tipo" => "hora", "defecto" => "18:00", "etiqueta" => "Hora del aviso diario de inasistencias a las familias"],
        "asistencia.valor_tarde_pct" => ["tipo" => "int", "min" => 0, "max" => 100, "defecto" => 50, "etiqueta" => "Valor de una llegada tarde (% de un presente)"],
        "asistencia.valor_justificado_pct" => ["tipo" => "int", "min" => 0, "max" => 100, "defecto" => 0, "etiqueta" => "Valor de una inasistencia justificada (% de un presente)"],
        "asistencia.umbral_regularidad_pct" => ["tipo" => "int", "min" => 1, "max" => 100, "defecto" => 75, "etiqueta" => "Asistencia mínima para la regularidad (%)"],
    ];
}

/**
 * Reglas de cálculo de asistencia: valor de cada estado (0 a 1) y umbral de
 * regularidad (%). Para usar en SQL: config_sql_puntos_asistencia().
 */
function config_reglas_asistencia(?array $valores = null)
{
    $valores ??= config_institucion();
    return [
        "valorTarde" => $valores["asistencia.valor_tarde_pct"] / 100,
        "valorJustificado" => $valores["asistencia.valor_justificado_pct"] / 100,
        "umbral" => $valores["asistencia.umbral_regularidad_pct"],
    ];
}

/**
 * Expresión SQL con los puntos de un registro de asistencia (presente 1, tarde
 * y justificado según la configuración, ausente 0) y sus parámetros, en orden.
 */
function config_sql_puntos_asistencia(array $reglas, $columna = "asi.estado")
{
    return ["CASE $columna WHEN 'presente' THEN 1 WHEN 'tarde' THEN ? WHEN 'justificado' THEN ? ELSE 0 END", [$reglas["valorTarde"], $reglas["valorJustificado"]]];
}

/** Convierte el valor guardado (texto) al tipo de la clave. */
function config_tipar(array $definicion, $valor)
{
    switch ($definicion["tipo"]) {
        case "bool":
            return in_array($valor, [true, 1, "1", "true"], true);
        case "int":
            return (int) $valor;
        default:
            return (string) $valor;
    }
}

/**
 * Valida un valor recibido por la API. Devuelve [ok, valorNormalizado|mensaje].
 */
function config_validar(array $definicion, $valor)
{
    switch ($definicion["tipo"]) {
        case "bool":
            if (!is_bool($valor) && !in_array($valor, [0, 1, "0", "1"], true)) {
                return [false, "debe ser verdadero o falso"];
            }
            return [true, $valor ? "1" : "0"];
        case "int":
            $entero = filter_var($valor, FILTER_VALIDATE_INT, ["options" => ["min_range" => $definicion["min"], "max_range" => $definicion["max"]]]);
            if ($entero === false || is_bool($valor)) {
                return [false, "debe ser un entero entre {$definicion["min"]} y {$definicion["max"]}"];
            }
            return [true, (string) $entero];
        case "hora":
            if (!is_string($valor) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $valor)) {
                return [false, "debe ser una hora HH:MM"];
            }
            return [true, $valor];
    }
    return [false, "tipo desconocido"];
}

/** Valores efectivos (por defecto + guardados), tipados. Se lee de la base en cada request. */
function config_institucion()
{
    global $pdo;
    $esquema = config_esquema();
    $valores = [];
    foreach ($esquema as $clave => $definicion) {
        $valores[$clave] = $definicion["defecto"];
    }
    foreach ($pdo->query("SELECT clave, valor FROM config_institucion")->fetchAll() as $fila) {
        if (isset($esquema[$fila["clave"]])) {
            $valores[$fila["clave"]] = config_tipar($esquema[$fila["clave"]], $fila["valor"]);
        }
    }
    return $valores;
}

/** Errores de coherencia entre claves (turnos con apertura posterior al cierre, ninguno habilitado). */
function config_errores_coherencia(array $valores)
{
    $errores = [];
    $habilitados = 0;
    foreach (CONFIG_TURNOS as $turno => $nombre) {
        if (!$valores["reservas.{$turno}_habilitado"]) {
            continue;
        }
        $habilitados++;
        if ($valores["reservas.{$turno}_desde"] >= $valores["reservas.{$turno}_hasta"]) {
            $errores[] = "el turno $nombre tiene que abrir antes de cerrar";
        }
    }
    if ($habilitados === 0) {
        $errores[] = "tiene que haber al menos un turno habilitado para reservar";
    }
    return $errores;
}

/**
 * Franjas en que se puede reservar: los turnos habilitados, unidos cuando se
 * tocan o se superponen. Lista de ["desde" => "HH:MM", "hasta" => "HH:MM"].
 */
function config_franjas_reserva(array $valores)
{
    $turnos = [];
    foreach (CONFIG_TURNOS as $turno => $nombre) {
        if ($valores["reservas.{$turno}_habilitado"] && $valores["reservas.{$turno}_desde"] < $valores["reservas.{$turno}_hasta"]) {
            $turnos[] = ["desde" => $valores["reservas.{$turno}_desde"], "hasta" => $valores["reservas.{$turno}_hasta"]];
        }
    }
    usort($turnos, fn ($a, $b) => strcmp($a["desde"], $b["desde"]));
    $franjas = [];
    foreach ($turnos as $turno) {
        $ultima = count($franjas) - 1;
        if ($ultima >= 0 && $turno["desde"] <= $franjas[$ultima]["hasta"]) {
            $franjas[$ultima]["hasta"] = max($franjas[$ultima]["hasta"], $turno["hasta"]);
        } else {
            $franjas[] = $turno;
        }
    }
    return $franjas;
}
