<?php

require_once __DIR__ . "/_common.php";
api_login_requerido();
$method = api_metodo(["GET", "POST", "DELETE"]);

// Suplencias: un preceptor cubre un curso ajeno durante un período. Quien
// tiene cursos.asignar (Administración Académica, Administrador) gestiona las
// de cualquier preceptor; un Preceptor solo registra las propias, con un
// máximo de 30 días y sin fechas pasadas. El alcance del preceptor incluye el
// curso solo mientras la suplencia está vigente (api_cursos_del_preceptor).

const SUPLENCIA_MAX_DIAS_PRECEPTOR = 30;

api_requerir_permiso("suplencias.crear");
$esGestor = api_tiene_permiso("cursos.asignar");
$usuarioId = (int) usuarioActual();

function suplencia_publica($s)
{
    return [
        "id" => (string) $s["id_suplencia"],
        "cursoId" => (string) $s["curso_id"],
        "curso" => $s["curso"],
        "preceptorId" => (string) $s["preceptor_id"],
        "preceptor" => $s["preceptor"],
        "desde" => $s["desde"],
        "hasta" => $s["hasta"],
        "motivo" => $s["motivo"],
        "vigente" => (bool) $s["vigente"],
    ];
}

const SUPLENCIA_SELECT = "
    SELECT s.id_suplencia, s.curso_id, CONCAT(c.anio, ' ', c.division) AS curso, s.preceptor_id,
           TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS preceptor, s.desde, s.hasta, s.motivo,
           (s.desde <= CURDATE() AND s.hasta >= CURDATE()) AS vigente
    FROM cursos_suplencias s
    JOIN cursos c ON c.id_cursos = s.curso_id
    JOIN usuarios u ON u.id_usuario = s.preceptor_id
";

if ($method === "GET") {
    if (isset($_GET["catalogo"])) {
        // Opciones del formulario: todos los cursos y, para quien gestiona, los preceptores.
        $cursos = $pdo->query("SELECT c.id_cursos AS id, c.anio, c.division, c.preceptor_id AS preceptorId FROM cursos c ORDER BY CAST(c.anio AS UNSIGNED), c.division")->fetchAll();
        $preceptores = $esGestor
            ? $pdo->query("SELECT u.id_usuario AS id, TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE r.nombre = 'Preceptor' ORDER BY u.apellido, u.nombre")->fetchAll()
            : [];
        api_json(["ok" => true, "cursos" => $cursos, "preceptores" => $preceptores, "maxDiasPreceptor" => SUPLENCIA_MAX_DIAS_PRECEPTOR]);
    }
    $where = ["s.hasta >= CURDATE() - INTERVAL 30 DAY"];
    $params = [];
    if (!$esGestor) {
        $where[] = "s.preceptor_id = ?";
        $params[] = $usuarioId;
    }
    $stmt = $pdo->prepare(SUPLENCIA_SELECT . " WHERE " . implode(" AND ", $where) . " ORDER BY s.desde DESC, s.id_suplencia DESC");
    $stmt->execute($params);
    api_json(["ok" => true, "suplencias" => array_map("suplencia_publica", $stmt->fetchAll())]);
}

$d = api_body();

if ($method === "DELETE") {
    $id = api_id_positivo($d["id"] ?? ($_GET["id"] ?? null));
    if ($id === null) {
        api_json(["ok" => false, "error" => "id invalido"], 400);
    }
    $stmt = $pdo->prepare(SUPLENCIA_SELECT . " WHERE s.id_suplencia = ?");
    $stmt->execute([$id]);
    $suplencia = $stmt->fetch();
    if (!$suplencia) {
        api_json(["ok" => false, "error" => "suplencia no encontrada"], 404);
    }
    if (!$esGestor && (int) $suplencia["preceptor_id"] !== $usuarioId) {
        api_json(["ok" => false, "error" => "solo podés quitar tus propias suplencias"], 403);
    }
    $pdo->prepare("DELETE FROM cursos_suplencias WHERE id_suplencia = ?")->execute([$id]);
    registrarAuditoria("suplencias.eliminar", "suplencia", $id, ["antes" => suplencia_publica($suplencia)]);
    api_json(["ok" => true]);
}

// POST: alta.
$cursoId = api_id_positivo($d["cursoId"] ?? null);
$preceptorId = $esGestor ? api_id_positivo($d["preceptorId"] ?? null) : $usuarioId;
$desde = trim((string) ($d["desde"] ?? ""));
$hasta = trim((string) ($d["hasta"] ?? ""));
$motivo = trim((string) ($d["motivo"] ?? ""));

if ($cursoId === null || $preceptorId === null) {
    api_json(["ok" => false, "error" => $esGestor ? "cursoId y preceptorId son requeridos" : "cursoId es requerido"], 400);
}
if (!api_fecha_valida($desde) || !api_fecha_valida($hasta) || $hasta < $desde) {
    api_json(["ok" => false, "error" => "fechas invalidas: use YYYY-MM-DD y hasta >= desde"], 400);
}
if (strlen($motivo) > 255) {
    api_json(["ok" => false, "error" => "el motivo no puede superar 255 caracteres"], 400);
}
if (!$esGestor) {
    if ($desde < date("Y-m-d")) {
        api_json(["ok" => false, "error" => "la suplencia no puede empezar en el pasado"], 400);
    }
    $dias = (new DateTime($desde))->diff(new DateTime($hasta))->days + 1;
    if ($dias > SUPLENCIA_MAX_DIAS_PRECEPTOR) {
        api_json(["ok" => false, "error" => "una suplencia propia puede durar hasta " . SUPLENCIA_MAX_DIAS_PRECEPTOR . " días; para más, pedila a la administración"], 400);
    }
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("SELECT id_cursos, preceptor_id FROM cursos WHERE id_cursos = ? FOR UPDATE");
    $stmt->execute([$cursoId]);
    $curso = $stmt->fetch();
    if (!$curso) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "curso no encontrado"], 404);
    }
    $stmt = $pdo->prepare("SELECT r.nombre FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id WHERE u.id_usuario = ?");
    $stmt->execute([$preceptorId]);
    $rol = $stmt->fetchColumn();
    if ($rol === false) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "preceptor no encontrado"], 404);
    }
    if (strcasecmp((string) $rol, "Preceptor") !== 0) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "la suplencia es para un usuario con rol Preceptor"], 400);
    }
    if ((int) $curso["preceptor_id"] === (int) $preceptorId) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "ese curso ya está asignado a ese preceptor"], 400);
    }
    $stmt = $pdo->prepare("SELECT 1 FROM cursos_suplencias WHERE curso_id = ? AND preceptor_id = ? AND desde <= ? AND hasta >= ? LIMIT 1 FOR UPDATE");
    $stmt->execute([$cursoId, $preceptorId, $hasta, $desde]);
    if ($stmt->fetchColumn()) {
        $pdo->rollBack();
        api_json(["ok" => false, "error" => "ya hay una suplencia de ese preceptor en ese curso para esas fechas"], 409);
    }
    $pdo->prepare("INSERT INTO cursos_suplencias (curso_id, preceptor_id, desde, hasta, motivo, creado_por) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$cursoId, $preceptorId, $desde, $hasta, $motivo !== "" ? $motivo : null, $usuarioId]);
    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare(SUPLENCIA_SELECT . " WHERE s.id_suplencia = ?");
    $stmt->execute([$id]);
    $nueva = suplencia_publica($stmt->fetch());
    registrarAuditoria("suplencias.crear", "suplencia", $id, ["despues" => $nueva]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

api_json(["ok" => true, "suplencia" => $nueva], 201);
