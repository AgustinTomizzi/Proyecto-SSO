<?php

require_once __DIR__ . "/_common.php";
require_once __DIR__ . "/../includes/oidc.php";
api_metodo(["GET"]);

// Inicio del ingreso institucional: GET /api/oidc_login.php?proveedor=google&next=/preceptor
// Guarda proveedor y destino en la sesión y redirige al proveedor (state, nonce
// y PKCE los genera la librería y quedan en la sesión).
$id = (string) ($_GET["proveedor"] ?? "");
$proveedores = oidc_proveedores();
if (!isset($proveedores[$id])) {
    header("Location: /login?error=oidc_proveedor");
    exit;
}
$_SESSION["oidc_proveedor"] = $id;
$_SESSION["oidc_destino"] = oidc_destino_seguro($_GET["next"] ?? "/");
try {
    oidc_cliente($proveedores[$id])->authenticate();
} catch (Throwable $e) {
    error_log("oidc_login ($id): " . $e->getMessage());
    header("Location: /login?error=oidc_proveedor_no_disponible");
}
exit;
