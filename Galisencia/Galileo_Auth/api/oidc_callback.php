<?php

require_once __DIR__ . "/_common.php";
require_once __DIR__ . "/../includes/oidc.php";
api_metodo(["GET"]);

// Vuelta del proveedor: valida state antes de canjear el código, deja que la
// librería verifique firma (JWKS), iss, aud, exp y nonce, exige nonce y email
// verificado, y abre la sesión solo si la cuenta ya existe. Los errores van al
// login con un código genérico; el detalle queda en el log y la auditoría.

function oidc_fallar($codigo, $proveedor, $motivo)
{
    registrarAuditoria("auth.oidc_rechazado", "sesion", null, ["proveedor" => $proveedor, "motivo" => $motivo]);
    unset($_SESSION["oidc_proveedor"], $_SESSION["oidc_destino"]);
    header("Location: /login?error=oidc_$codigo");
    exit;
}

$id = (string) ($_SESSION["oidc_proveedor"] ?? "");
$proveedores = oidc_proveedores();
if (!isset($proveedores[$id])) {
    oidc_fallar("sesion", $id, "sin proveedor en la sesión");
}
if (isset($_GET["error"])) {
    oidc_fallar("cancelado", $id, "el proveedor devolvió error");
}
$estadoEsperado = (string) ($_SESSION["openid_connect_state"] ?? "");
if (!isset($_GET["code"], $_GET["state"]) || $estadoEsperado === "" || !hash_equals($estadoEsperado, (string) $_GET["state"])) {
    oidc_fallar("estado", $id, "state inválido");
}

try {
    $cliente = oidc_cliente($proveedores[$id]);
    $cliente->authenticate();
    $claims = $cliente->getVerifiedClaims();
} catch (Throwable $e) {
    error_log("oidc_callback ($id): " . $e->getMessage());
    oidc_fallar("verificacion", $id, "no se pudo verificar el token");
}
// La librería solo compara el nonce si viene: acá se exige.
if (empty($claims->nonce) || empty($claims->sub)) {
    oidc_fallar("verificacion", $id, "token sin nonce o sin sub");
}
$sub = (string) $claims->sub;
if ($id === "microsoft") {
    // Tenant institucional: la escuela administra las cuentas y sus emails.
    $email = (string) ($claims->email ?? $claims->preferred_username ?? "");
    $verificado = $email !== "";
} else {
    $email = (string) ($claims->email ?? "");
    $verificado = ($claims->email_verified ?? false) === true || ($claims->email_verified ?? "") === "true";
}

[$usuario, $vinculada] = oidc_resolver_usuario($pdo, $id, $sub, $email, $verificado);
if (!$usuario) {
    $dominio = str_contains($email, "@") ? substr(strrchr($email, "@"), 1) : "";
    oidc_fallar("sin_cuenta", $id, $verificado ? "no hay una cuenta con ese email (dominio $dominio)" : "email no verificado");
}

$destino = (string) ($_SESSION["oidc_destino"] ?? "/");
auth_iniciar_sesion($usuario);
$_SESSION["auth_metodo"] = "oidc";
$_SESSION["auth_proveedor"] = $id;
registrarAuditoria("auth.oidc", "sesion", $usuario["id_usuario"], ["proveedor" => $id, "identidad_vinculada" => $vinculada]);
header("Location: " . oidc_destino_seguro($destino));
exit;
