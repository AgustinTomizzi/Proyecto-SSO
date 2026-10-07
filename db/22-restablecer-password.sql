-- 22-restablecer-password.sql
-- Migracion incremental e idempotente: el Administrador puede restablecer la
-- contrasena de una cuenta (queda una temporal que se cambia en el proximo ingreso).

USE ProyectoEstela;
SET NAMES utf8mb4;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('usuarios.restablecer_password', 'Restablecer la contrasena de un usuario');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'usuarios.restablecer_password'
WHERE r.nombre = 'Administrador';
