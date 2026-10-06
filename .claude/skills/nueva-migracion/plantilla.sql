-- NN-nombre.sql
-- Migracion incremental e idempotente: <que agrega y por que>.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Tabla nueva.
CREATE TABLE IF NOT EXISTS ejemplo (
  id_ejemplo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id INT UNSIGNED NOT NULL,
  creado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_ejemplo),
  CONSTRAINT fk_ejemplo_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_ejemplo_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Columna nueva en una tabla existente (MySQL 8 no tiene ADD COLUMN IF NOT EXISTS).
DROP PROCEDURE IF EXISTS migrar_ejemplo;
DELIMITER $$
CREATE PROCEDURE migrar_ejemplo()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tabla' AND COLUMN_NAME = 'columna') THEN
    ALTER TABLE tabla
      ADD COLUMN columna INT UNSIGNED NULL,
      ADD CONSTRAINT fk_tabla_columna FOREIGN KEY (columna) REFERENCES ejemplo (id_ejemplo) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL migrar_ejemplo();
DROP PROCEDURE migrar_ejemplo;

-- Permiso nuevo y roles que lo reciben.
INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('ejemplo.gestionar', 'Gestionar ejemplos');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'ejemplo.gestionar'
WHERE r.nombre IN ('Administrador Academico', 'Administrador');
