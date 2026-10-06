<?php

/**
 * Sesiones PHP guardadas en MySQL (tabla sesiones) para que varias réplicas
 * del backend compartan la sesión. Se activa con SESSION_STORE=db; sin esa
 * variable PHP usa archivos (instalaciones locales sin Docker).
 *
 * Bloqueo: como el handler de archivos, cada request toma un lock por sesión
 * (GET_LOCK, propio de la conexión y ajeno a las transacciones de la app) y lo
 * libera al cerrar, así dos pedidos simultáneos no se pisan los datos.
 */
class SesionesMysql implements SessionHandlerInterface, SessionUpdateTimestampHandlerInterface
{
    private const ESPERA_LOCK_SEGUNDOS = 10;

    private ?string $bloqueada = null;

    public function __construct(private PDO $pdo)
    {
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        $this->liberar();
        return true;
    }

    public function read(string $id): string|false
    {
        $this->bloquear($id);
        $stmt = $this->pdo->prepare("SELECT datos FROM sesiones WHERE id = ? AND actualizada >= ?");
        $stmt->execute([$id, time() - $this->duracion()]);
        $datos = $stmt->fetchColumn();
        return $datos === false ? "" : (string) $datos;
    }

    public function write(string $id, string $data): bool
    {
        $this->pdo->prepare("INSERT INTO sesiones (id, datos, actualizada) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE datos = VALUES(datos), actualizada = VALUES(actualizada)")
            ->execute([$id, $data, time()]);
        return true;
    }

    public function destroy(string $id): bool
    {
        $this->pdo->prepare("DELETE FROM sesiones WHERE id = ?")->execute([$id]);
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        $stmt = $this->pdo->prepare("DELETE FROM sesiones WHERE actualizada < ?");
        $stmt->execute([time() - $max_lifetime]);
        return $stmt->rowCount();
    }

    /** Strict mode: solo se aceptan IDs que existen y no vencieron. */
    public function validateId(string $id): bool
    {
        $stmt = $this->pdo->prepare("SELECT 1 FROM sesiones WHERE id = ? AND actualizada >= ?");
        $stmt->execute([$id, time() - $this->duracion()]);
        return $stmt->fetchColumn() !== false;
    }

    public function updateTimestamp(string $id, string $data): bool
    {
        $this->pdo->prepare("UPDATE sesiones SET actualizada = ? WHERE id = ?")->execute([time(), $id]);
        return true;
    }

    private function duracion(): int
    {
        return max(60, (int) ini_get("session.gc_maxlifetime"));
    }

    private function bloquear(string $id): void
    {
        $this->liberar();
        $nombre = "sesion_" . substr(hash("sha256", $id), 0, 40);
        $stmt = $this->pdo->prepare("SELECT GET_LOCK(?, ?)");
        $stmt->execute([$nombre, self::ESPERA_LOCK_SEGUNDOS]);
        if ((int) $stmt->fetchColumn() === 1) {
            $this->bloqueada = $nombre;
        }
    }

    private function liberar(): void
    {
        if ($this->bloqueada !== null) {
            $this->pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$this->bloqueada]);
            $this->bloqueada = null;
        }
    }
}
