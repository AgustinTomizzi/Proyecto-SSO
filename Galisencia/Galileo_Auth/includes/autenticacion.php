<?php

/**
 * Autenticación intercambiable (ver docs/AUTENTICACION.md).
 *
 * Verificar credenciales y abrir la sesión son dos pasos separados:
 *   1. Un ProveedorAutenticacion dice quién es la persona (hoy: email y
 *      contraseña contra la tabla usuarios).
 *   2. auth_iniciar_sesion() abre la sesión compartida para ese usuario.
 * Un proveedor externo (OIDC: Keycloak, Google, Microsoft) solo reemplaza el
 * paso 1 y vuelve a usar el 2; rol y permisos siguen saliendo de la base.
 */
interface ProveedorAutenticacion
{
    /**
     * Devuelve el usuario (fila de usuarios con su rol) si las credenciales son
     * válidas, o null. Debe tardar lo mismo exista o no la cuenta.
     */
    public function autenticar(string $email, string $password): ?array;
}

final class AutenticacionLocal implements ProveedorAutenticacion
{
    // Hash bcrypt de un valor aleatorio descartado. Se verifica contra él
    // cuando el email no existe, para que "usuario inexistente" tarde lo
    // mismo que "contraseña incorrecta".
    private const HASH_FALSO = '$2y$10$cpLNOwmtnvyND6.I3GGHiel5jclVML6PcIBKHL7dOu8XYgZ.U1sN6';

    public function __construct(private PDO $pdo)
    {
    }

    public function autenticar(string $email, string $password): ?array
    {
        $usuario = auth_buscar_usuario_por_email($this->pdo, $email);
        $valida = password_verify($password, $usuario ? $usuario["contrasena"] : self::HASH_FALSO);
        if (!$usuario || !$valida) {
            return null;
        }
        unset($usuario["contrasena"]);
        return $usuario;
    }
}

/** Usuario activo por email con su rol (incluye el hash: no exponerlo). */
function auth_buscar_usuario_por_email(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare("
        SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.contrasena, u.rol_id, u.debe_cambiar_password, r.nombre AS rol
        FROM usuarios u
        INNER JOIN roles r ON u.rol_id = r.id_rol
        WHERE u.email = ?
        LIMIT 1
    ");
    $stmt->execute([$email]);
    return $stmt->fetch() ?: null;
}

/** Proveedor configurado con AUTH_PROVIDER (por defecto "local"). */
function auth_proveedor(): ProveedorAutenticacion
{
    $tipo = strtolower(trim((string) (getenv("AUTH_PROVIDER") ?: "local")));
    return match ($tipo) {
        "local" => new AutenticacionLocal($GLOBALS["pdo"]),
        default => throw new RuntimeException("AUTH_PROVIDER no soportado: $tipo"),
    };
}

/** Abre la sesión compartida para un usuario ya autenticado. */
function auth_iniciar_sesion(array $usuario): void
{
    // Nuevo ID de sesión: evita la fijación de sesión.
    session_regenerate_id(true);
    $_SESSION["id_usuario"] = $usuario["id_usuario"];
    $_SESSION["nombre"] = $usuario["nombre"];
    $_SESSION["apellido"] = $usuario["apellido"];
    $_SESSION["email"] = $usuario["email"];
    $_SESSION["rol"] = $usuario["rol"];
    $_SESSION["rol_id"] = $usuario["rol_id"];
    $_SESSION["debe_cambiar_password"] = (int) $usuario["debe_cambiar_password"];
    $_SESSION["ultima_actividad"] = time();
}

/** Cierra la sesión compartida y vence la cookie. */
function auth_cerrar_sesion(): void
{
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), "", time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
    }
    session_destroy();
}
