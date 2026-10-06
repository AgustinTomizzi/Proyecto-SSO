<?php

require_once __DIR__ . "/_common.php";
api_metodo(["POST"]);

auth_cerrar_sesion();
api_json(["ok" => true]);
