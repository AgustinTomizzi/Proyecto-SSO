<?php

/*
 * Ingreso institucional por OIDC (docs/AUTENTICACION.md). La identidad la da el
 * proveedor; rol y permisos siguen en la base. Solo entra quien ya existe en
 * usuarios (sin autoregistro). Proveedores por entorno:
 *   OIDC_GOOGLE_CLIENT_ID / OIDC_GOOGLE_CLIENT_SECRET
 *   OIDC_MICROSOFT_TENANT (ID del tenant) / OIDC_MICROSOFT_CLIENT_ID / OIDC_MICROSOFT_CLIENT_SECRET
 *   OIDC_PRUEBA_ISSUER / OIDC_PRUEBA_CLIENT_ID / OIDC_PRUEBA_CLIENT_SECRET (solo
 *     pruebas; se ignora con APP_ENV=prod)
 *   APP_URL: URL pública (por ejemplo https://escuela.edu.ar) para armar el
 *     redirect_uri {APP_URL}/api/oidc_callback.php
 */

/** Proveedores configurados: id => [etiqueta, issuer, client_id, client_secret, http]. */
function oidc_proveedores()
{
    $env = fn ($clave) => trim((string) getenv($clave));
    $proveedores = [];
    if ($env("OIDC_GOOGLE_CLIENT_ID") !== "" && $env("OIDC_GOOGLE_CLIENT_SECRET") !== "") {
        $proveedores["google"] = ["etiqueta" => "Google", "issuer" => "https://accounts.google.com", "client_id" => $env("OIDC_GOOGLE_CLIENT_ID"), "client_secret" => $env("OIDC_GOOGLE_CLIENT_SECRET"), "http" => false];
    }
    $tenant = $env("OIDC_MICROSOFT_TENANT");
    if ($tenant !== "" && $env("OIDC_MICROSOFT_CLIENT_ID") !== "" && $env("OIDC_MICROSOFT_CLIENT_SECRET") !== "") {
        $proveedores["microsoft"] = ["etiqueta" => "Microsoft", "issuer" => "https://login.microsoftonline.com/" . rawurlencode($tenant) . "/v2.0", "client_id" => $env("OIDC_MICROSOFT_CLIENT_ID"), "client_secret" => $env("OIDC_MICROSOFT_CLIENT_SECRET"), "http" => false];
    }
    // Proveedor de prueba (tools/oidc-prueba): nunca en producción.
    if ($env("OIDC_PRUEBA_ISSUER") !== "" && strtolower($env("APP_ENV")) !== "prod") {
        $proveedores["prueba"] = ["etiqueta" => "Proveedor de prueba", "issuer" => $env("OIDC_PRUEBA_ISSUER"), "client_id" => $env("OIDC_PRUEBA_CLIENT_ID"), "client_secret" => $env("OIDC_PRUEBA_CLIENT_SECRET"), "http" => true];
    }
    return $proveedores;
}

/** El formulario de email y contraseña sigue habilitado salvo AUTH_PROVIDER=oidc. */
function oidc_login_local_habilitado()
{
    return strtolower(trim((string) (getenv("AUTH_PROVIDER") ?: "local"))) !== "oidc";
}

function oidc_url_publica()
{
    $url = rtrim(trim((string) getenv("APP_URL")), "/");
    return $url !== "" ? $url : "http://localhost:3000";
}

/** Solo rutas internas del sitio (evita redirecciones abiertas): /algo, sin //, sin esquema. */
function oidc_destino_seguro($destino)
{
    $destino = (string) $destino;
    if ($destino === "" || $destino[0] !== "/" || str_starts_with($destino, "//") || str_contains($destino, "\\") || preg_match('/[\x00-\x1f]/', $destino)) {
        return "/";
    }
    return $destino;
}

/** Cliente OIDC configurado para un proveedor (requiere vendor/ de Composer). */
function oidc_cliente(array $proveedor)
{
    $autoload = __DIR__ . "/../vendor/autoload.php";
    if (!is_file($autoload)) {
        throw new RuntimeException("falta la librería OIDC (composer install)");
    }
    require_once $autoload;
    $cliente = new Jumbojett\OpenIDConnectClient($proveedor["issuer"], $proveedor["client_id"], $proveedor["client_secret"]);
    $cliente->setRedirectURL(oidc_url_publica() . "/api/oidc_callback.php");
    $cliente->addScope(["openid", "email", "profile"]);
    $cliente->setCodeChallengeMethod("S256");
    $cliente->setTimeout(10);
    if (!$proveedor["http"]) {
        $cliente->setHttpUpgradeInsecureRequests(true);
    }
    return $cliente;
}

/** Busca la cuenta por identidad (proveedor, sub); si no, por email verificado y la vincula. */
function oidc_resolver_usuario(PDO $pdo, $proveedor, $sub, $email, $emailVerificado)
{
    $stmt = $pdo->prepare("SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.rol_id, u.debe_cambiar_password, r.nombre AS rol FROM usuario_identidades i JOIN usuarios u ON u.id_usuario = i.usuario_id JOIN roles r ON r.id_rol = u.rol_id WHERE i.proveedor = ? AND i.sub = ?");
    $stmt->execute([$proveedor, $sub]);
    $usuario = $stmt->fetch();
    if ($usuario) {
        $pdo->prepare("UPDATE usuario_identidades SET ultimo_ingreso = NOW(), email = ? WHERE proveedor = ? AND sub = ?")->execute([$email !== "" ? $email : null, $proveedor, $sub]);
        return [$usuario, false];
    }
    if ($email === "" || $emailVerificado !== true) {
        return [null, false];
    }
    $usuario = auth_buscar_usuario_por_email($pdo, strtolower($email));
    if (!$usuario) {
        return [null, false];
    }
    unset($usuario["contrasena"]);
    // Una cuenta tiene a lo sumo una identidad por proveedor.
    $stmt = $pdo->prepare("SELECT 1 FROM usuario_identidades WHERE usuario_id = ? AND proveedor = ?");
    $stmt->execute([$usuario["id_usuario"], $proveedor]);
    if ($stmt->fetchColumn()) {
        return [null, false];
    }
    $pdo->prepare("INSERT INTO usuario_identidades (proveedor, sub, usuario_id, email, ultimo_ingreso) VALUES (?, ?, ?, ?, NOW())")->execute([$proveedor, $sub, $usuario["id_usuario"], strtolower($email)]);
    return [$usuario, true];
}
