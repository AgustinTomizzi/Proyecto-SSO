<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
api_requerir_permiso("reservas.ver");

$method = $_SERVER["REQUEST_METHOD"];

const FRANJAS = [
    "08:00 - 10:00",
    "10:00 - 12:00",
    "13:00 - 15:00",
    "15:00 - 17:00",
    "17:00 - 19:00",
    "19:00 - 21:00",
];

function recurso_existe($pdo, $recursoId)
{
    $stmt = $pdo->prepare("SELECT id_recurso, nombre, tipo, stock_total FROM recursos WHERE id_recurso = ? AND activo = 1 LIMIT 1");
    $stmt->execute([$recursoId]);
    return $stmt->fetch();
}

function cantidad_reservada($pdo, $recursoId, $fecha, $horario)
{
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(cantidad), 0)
        FROM reservas
        WHERE recurso_id = ? AND fecha = ? AND horario = ?
    ");
    $stmt->execute([$recursoId, $fecha, $horario]);
    return (int) $stmt->fetchColumn();
}

if ($method === "GET") {
    $recursoId = (int) ($_GET["recursoId"] ?? 0);
    $fecha = trim((string) ($_GET["fecha"] ?? ""));

    if ($recursoId > 0 && $fecha !== "") {

        // Disponibilidad: franja por franja para un recurso y fecha dados.
        $recurso = recurso_existe($pdo, $recursoId);
        if (!$recurso) {
            api_json(["ok" => false, "error" => "recurso no encontrado"], 404);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            api_json(["ok" => false, "error" => "fecha inválida"], 400);
        }

        $disponibilidad = [];
        foreach (FRANJAS as $franja) {
            $reservado = cantidad_reservada($pdo, $recursoId, $fecha, $franja);
            $disponibilidad[] = [
                "horario" => $franja,
                "reservado" => $reservado,
                "disponible" => max(0, (int) $recurso["stock_total"] - $reservado),
            ];
        }

        api_json(["ok" => true, "recurso" => $recurso, "disponibilidad" => $disponibilidad]);
    }

    // Sin filtro: listado completo de reservas (los roles sin acceso ni llegan acá).
    $stmt = $pdo->prepare("
        SELECT res.id_reserva AS id,
               res.recurso_id AS recursoId,
               r.nombre AS recurso,
               res.fecha,
               res.horario,
               res.cantidad,
               u.email AS usuario
        FROM reservas res
        INNER JOIN recursos r ON r.id_recurso = res.recurso_id
        LEFT JOIN usuarios u ON u.id_usuario = res.usuario_id
        ORDER BY res.fecha, res.horario
    ");
    $stmt->execute();

    api_json(["ok" => true, "reservas" => $stmt->fetchAll()]);
}

if ($method === "POST") {
    api_requerir_permiso("reservas.crear");

    $data = api_body();
    $recursoId = (int) ($data["recursoId"] ?? 0);
    $fecha = trim((string) ($data["fecha"] ?? ""));
    $horario = trim((string) ($data["horario"] ?? ""));
    $cantidad = (int) ($data["cantidad"] ?? 0);

    if ($recursoId <= 0) {
        api_json(["ok" => false, "error" => "recurso requerido"], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        api_json(["ok" => false, "error" => "fecha inválida"], 400);
    }
    if (!in_array($horario, FRANJAS, true)) {
        api_json(["ok" => false, "error" => "franja horaria inválida"], 400);
    }
    if ($cantidad <= 0) {
        api_json(["ok" => false, "error" => "la cantidad debe ser mayor a cero"], 400);
    }

    $recurso = recurso_existe($pdo, $recursoId);
    if (!$recurso) {
        api_json(["ok" => false, "error" => "recurso no encontrado"], 404);
    }

    $reservado = cantidad_reservada($pdo, $recursoId, $fecha, $horario);
    $disponible = (int) $recurso["stock_total"] - $reservado;

    if ($cantidad > $disponible) {
        api_json([
            "ok" => false,
            "error" => "sin stock disponible",
            "disponible" => $disponible,
            "reservado" => $reservado,
        ], 409);
    }

    $usuarioId = $_SESSION["id_usuario"] ?? null;
    $stmt = $pdo->prepare("INSERT INTO reservas (usuario_id, recurso_id, fecha, horario, cantidad) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$usuarioId, $recursoId, $fecha, $horario, $cantidad]);
    $id = $pdo->lastInsertId();

    registrarAuditoria("reservas.crear", "recurso", $recursoId, [
        "recurso" => $recurso["nombre"],
        "fecha" => $fecha,
        "horario" => $horario,
        "cantidad" => $cantidad,
        "reserva_id" => (int) $id,
    ]);

    api_json([
        "ok" => true,
        "reserva" => [
            "id" => (string) $id,
            "recursoId" => (string) $recursoId,
            "recurso" => $recurso["nombre"],
            "fecha" => $fecha,
            "horario" => $horario,
            "cantidad" => $cantidad,
        ],
        "disponible" => $disponible - $cantidad,
    ]);
}

api_json(["ok" => false, "error" => "método no permitido"], 405);