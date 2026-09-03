<?php

require_once __DIR__ . "/../config/database.php";

/**
 * Registra una acción en la auditoría del sistema.
 *
 * @param string $accion    p.ej. "cursos.asignar", "alumnos.crear"
 * @param string $entidad   p.ej. "curso", "alumno", "usuario"
 * @param mixed  $entidadId id del registro afectado (puede ser null)
 * @param array|null $detalle datos relevantes del cambio (se guarda como JSON)
 */
function registrarAuditoria($accion, $entidad, $entidadId = null, $detalle = null)
{
    global $pdo;

    $usuarioId = $_SESSION["id_usuario"] ?? null;
    $usuarioNombre = trim(($_SESSION["nombre"] ?? "") . " " . ($_SESSION["apellido"] ?? ""));
    $rol = $_SESSION["rol"] ?? null;

    try {
        $stmt = $pdo->prepare("
            INSERT INTO auditoria (usuario_id, usuario_nombre, rol, accion, entidad, entidad_id, detalle)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $usuarioId,
            $usuarioNombre !== "" ? $usuarioNombre : null,
            $rol,
            $accion,
            $entidad,
            $entidadId !== null ? (string) $entidadId : null,
            $detalle !== null ? json_encode($detalle, JSON_UNESCAPED_UNICODE) : null,
        ]);
    } catch (\Throwable $e) {
        // La auditoría nunca debe romper la operación principal del usuario.
        // Si la tabla todavía no existe (falta correr la migración), no tumbamos el request.
        error_log("No se pudo registrar auditoria: " . $e->getMessage());
    }
}
