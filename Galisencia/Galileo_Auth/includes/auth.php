<?php

/**
 * Entorno de ejecucion: "dev" habilita CORS para localhost y cookies sin
 * Secure (HTTP). Cualquier otro valor se trata como produccion.
 */
function app_es_dev()
{
    return strtolower(trim((string) (getenv("APP_ENV") ?: "dev"))) === "dev";
}

require_once __DIR__ . "/sesiones.php";

if (session_status() === PHP_SESSION_NONE) {
    // SESSION_STORE=db guarda las sesiones en MySQL (varias réplicas del
    // backend comparten sesión); sin la variable, archivos locales.
    if (strtolower((string) getenv("SESSION_STORE")) === "db" && isset($GLOBALS["pdo"])) {
        session_set_save_handler(new SesionesMysql($GLOBALS["pdo"]), true);
    }
    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => !app_es_dev(),
        "httponly" => true,
        "samesite" => "Lax",
    ]);
    ini_set("session.use_strict_mode", "1");
    ini_set("session.use_only_cookies", "1");
    session_start();
}

// Cierre por inactividad (SESSION_TIMEOUT_MINUTES, 30 por defecto).
if (isset($_SESSION["id_usuario"])) {
    $inactividadMaxima = max(1, (int) (getenv("SESSION_TIMEOUT_MINUTES") ?: 30)) * 60;
    if (time() - (int) ($_SESSION["ultima_actividad"] ?? time()) > $inactividadMaxima) {
        $_SESSION = [];
        session_regenerate_id(true);
    } else {
        $_SESSION["ultima_actividad"] = time();
    }
}


/**
 * Comprueba si el usuario inició sesión.
 */
function estaLogueado()
{
    return isset($_SESSION["id_usuario"]);
}




/**
 * Obtiene el ID del usuario actual.
 */
function usuarioActual()
{
    if (!estaLogueado()) {
        return null;
    }

    return $_SESSION["id_usuario"];
}