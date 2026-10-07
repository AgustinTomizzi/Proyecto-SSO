<?php

// Aplica la política de retención de datos (plazos en config_institucion).
//   php cli/retencion.php
// El worker de notificaciones también la corre una vez por día. Solo por línea de comandos.

if (PHP_SAPI !== "cli") {
    http_response_code(404);
    exit;
}

require_once __DIR__ . "/../includes/retencion.php";

$resultado = retencion_aplicar($pdo);
foreach ($resultado as $tabla => $cantidad) {
    fwrite(STDOUT, str_pad($tabla, 26) . " $cantidad\n");
}
