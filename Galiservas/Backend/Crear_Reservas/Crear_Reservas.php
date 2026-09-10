<?php

require_once "conexion.php";

$usuario_id = $_POST['usuario_id'];
$recurso_id = $_POST['recurso_id'];
$fecha = $_POST['fecha'];
$horario = $_POST['horario'];

// Verificar si ya existe una reserva
$sql = "SELECT id_reservas
        FROM reservas
        WHERE recurso_id = ?
        AND fecha = ?
        AND horario = ?
        LIMIT 1";

$stmt = $conexion->prepare($sql);

$stmt->bind_param(
    "iss",
    $recurso_id,
    $fecha,
    $horario
);

$stmt->execute();

$resultado = $stmt->get_result();

if ($resultado->num_rows > 0) {

    echo "❌ El recurso ya está reservado para ese horario.";

} else {

    // Crear la reserva
    $sql_insert = "INSERT INTO reservas
                   (usuario_id, recurso_id, fecha, horario)
                   VALUES (?, ?, ?, ?)";

    $stmt_insert = $conexion->prepare($sql_insert);

    $stmt_insert->bind_param(
        "iiss",
        $usuario_id,
        $recurso_id,
        $fecha,
        $horario
    );

    if ($stmt_insert->execute()) {

        echo "✅ Reserva realizada correctamente.";

    } else {

        echo "❌ Error al realizar la reserva.";
    }
}
?>