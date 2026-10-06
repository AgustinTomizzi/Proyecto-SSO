<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "PUT", "DELETE"]);

// Configuración institucional. GET: cualquier sesión (las reglas no son
// secretas y los frontends las muestran). PUT/DELETE: config.gestionar.

function config_respuesta()
{
    $valores = config_institucion();
    $esquema = [];
    foreach (config_esquema() as $clave => $definicion) {
        $esquema[] = array_merge(["clave" => $clave], $definicion);
    }
    return [
        "ok" => true,
        "valores" => $valores,
        "esquema" => $esquema,
        "franjasReserva" => config_franjas_reserva($valores),
        "puedeEditar" => api_tiene_permiso("config.gestionar"),
    ];
}

if ($method === "GET") {
    api_json(config_respuesta());
}

api_requerir_permiso("config.gestionar");
$d = api_body();
$esquema = config_esquema();

if ($method === "DELETE") {
    // Vuelve a los valores por defecto las claves indicadas.
    $claves = $d["claves"] ?? null;
    if (!is_array($claves) || !$claves || array_diff($claves, array_keys($esquema))) {
        api_json(["ok" => false, "error" => "claves debe ser una lista de claves de configuración válidas"], 400);
    }
    $antes = config_institucion();
    $despues = $antes;
    foreach ($claves as $clave) {
        $despues[$clave] = $esquema[$clave]["defecto"];
    }
    $errores = config_errores_coherencia($despues);
    if ($errores) {
        api_json(["ok" => false, "error" => implode("; ", $errores), "errores" => $errores], 400);
    }
    $marcas = implode(",", array_fill(0, count($claves), "?"));
    $pdo->prepare("DELETE FROM config_institucion WHERE clave IN ($marcas)")->execute(array_values($claves));
    registrarAuditoria("config.actualizar", "config_institucion", null, ["restablecidas" => array_values($claves)]);
    api_json(config_respuesta());
}

// PUT {"valores": {"reservas.duracion_maxima_min": 180, ...}}: cambio parcial.
$recibidos = $d["valores"] ?? null;
if (!is_array($recibidos) || !$recibidos || array_is_list($recibidos)) {
    api_json(["ok" => false, "error" => "valores debe ser un objeto con las claves a cambiar"], 400);
}
$normalizados = [];
$errores = [];
foreach ($recibidos as $clave => $valor) {
    if (!isset($esquema[$clave])) {
        $errores[] = "$clave no es una clave de configuración";
        continue;
    }
    [$valido, $resultado] = config_validar($esquema[$clave], $valor);
    if ($valido) {
        $normalizados[$clave] = $resultado;
    } else {
        $errores[] = "$clave $resultado";
    }
}
if ($errores) {
    api_json(["ok" => false, "error" => implode("; ", $errores), "errores" => $errores], 400);
}

$pdo->beginTransaction();
try {
    // Bloquea la tabla lógica para que dos administradores no dejen turnos incoherentes.
    $pdo->query("SELECT clave FROM config_institucion FOR UPDATE")->fetchAll();
    $antes = config_institucion();
    $despues = $antes;
    foreach ($normalizados as $clave => $valor) {
        $despues[$clave] = config_tipar($esquema[$clave], $valor);
    }
    $errores = config_errores_coherencia($despues);
    if ($errores) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => implode("; ", $errores), "errores" => $errores], 400);
    }
    $guardar = $pdo->prepare("INSERT INTO config_institucion (clave, valor, actualizado_por) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)");
    $cambios = [];
    foreach ($normalizados as $clave => $valor) {
        $guardar->execute([$clave, $valor, usuarioActual()]);
        if ($antes[$clave] !== $despues[$clave]) {
            $cambios[$clave] = ["antes" => $antes[$clave], "despues" => $despues[$clave]];
        }
    }
    if ($cambios) {
        registrarAuditoria("config.actualizar", "config_institucion", null, ["cambios" => $cambios]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(config_respuesta());
