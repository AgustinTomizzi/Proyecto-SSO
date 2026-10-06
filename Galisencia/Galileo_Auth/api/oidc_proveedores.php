<?php

require_once __DIR__ . "/_common.php";
require_once __DIR__ . "/../includes/oidc.php";
api_metodo(["GET"]);

// Público: qué botones de ingreso institucional mostrar en el login. No expone
// client_id, secretos ni URLs del proveedor.
$proveedores = [];
foreach (oidc_proveedores() as $id => $p) {
    $proveedores[] = ["id" => $id, "etiqueta" => $p["etiqueta"]];
}
api_json(["ok" => true, "proveedores" => $proveedores, "loginLocal" => oidc_login_local_habilitado()]);
