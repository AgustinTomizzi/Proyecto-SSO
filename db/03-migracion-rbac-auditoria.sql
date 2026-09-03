-- 03-migracion-rbac-auditoria.sql
-- Migración incremental: NO borra tablas ni datos existentes.
-- Se puede correr sobre una base ya inicializada con 01-schema.sql + 02-seed.sql.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1) Relación real curso -> preceptor (antes era solo texto libre)
--    Se mantiene la columna "preceptor" (texto) por compatibilidad con
--    datos existentes / demos viejas, pero pasa a ser secundaria.
-- ---------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ProyectoEstela' AND TABLE_NAME = 'cursos' AND COLUMN_NAME = 'preceptor_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE cursos ADD COLUMN preceptor_id INT UNSIGNED DEFAULT NULL AFTER preceptor',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = 'ProyectoEstela' AND TABLE_NAME = 'cursos' AND CONSTRAINT_NAME = 'fk_curso_preceptor'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE cursos ADD CONSTRAINT fk_curso_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill best-effort: intenta linkear el texto libre "preceptor" con un
-- usuario real por nombre+apellido, para no perder la asignación existente.
UPDATE cursos c
JOIN usuarios u ON CONCAT(u.nombre, ' ', u.apellido) = c.preceptor
SET c.preceptor_id = u.id_usuario
WHERE c.preceptor_id IS NULL;

-- ---------------------------------------------------------------------
-- 2) Nuevos permisos necesarios para admin (gestión de usuarios/cursos/auditoría)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('cursos.asignar', 'Asignar/reasignar preceptor a un curso'),
  ('usuarios.ver', 'Ver listado de usuarios'),
  ('usuarios.editar_rol', 'Cambiar el rol de un usuario'),
  ('auditoria.ver', 'Ver el registro de auditoría del sistema');

-- ---------------------------------------------------------------------
-- 3) FIX DE SEGURIDAD: el rol "Administrador" (id 6) no tenía NINGÚN
--    permiso cargado en rol_permiso. Se le otorgan todos los permisos.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador';

-- ---------------------------------------------------------------------
-- 4) El Preceptor necesita alta/baja de alumnos en SUS cursos
--    (el backend restringe el alcance a sus cursos asignados; ver api/alumnos.php)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Preceptor' AND p.nombre IN ('alumnos.crear', 'alumnos.dar_baja');

-- ---------------------------------------------------------------------
-- 5) Tabla de auditoría
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED DEFAULT NULL,
  usuario_nombre VARCHAR(255) DEFAULT NULL,
  rol VARCHAR(100) DEFAULT NULL,
  accion VARCHAR(100) NOT NULL,
  entidad VARCHAR(100) NOT NULL,
  entidad_id VARCHAR(100) DEFAULT NULL,
  detalle JSON DEFAULT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_auditoria),
  KEY idx_auditoria_fecha (fecha),
  KEY idx_auditoria_usuario (usuario_id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
