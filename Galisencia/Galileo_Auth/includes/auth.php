<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}


/**
 * Comprueba si el usuario inició sesión.
 */
function estaLogueado()
{
    return isset($_SESSION["id_usuario"]);
}


/**
 * Obliga a iniciar sesión.
 */
function requerirLogin()
{
    if (!estaLogueado()) {

        header("Location: /");
        exit;
    }
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
