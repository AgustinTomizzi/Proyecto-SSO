<?php
// config/funciones.php
// Funciones chicas que se reutilizan en varias páginas.

/**
 * Limpia un string de espacios sobrantes y etiquetas HTML.
 * No reemplaza a las consultas preparadas, es una capa extra.
 */
function limpiar(string $valor): string {
    return htmlspecialchars(trim($valor), ENT_QUOTES, 'UTF-8');
}

/**
 * Corta la ejecución y manda al usuario a login.php si no hay sesión activa.
 * Se llama al principio de cualquier página que solo pueden ver usuarios logueados.
 */
function requerirSesion(): void {
    if (empty($_SESSION['usuario_id'])) {
        header('Location: login.php');
        exit;
    }
}
