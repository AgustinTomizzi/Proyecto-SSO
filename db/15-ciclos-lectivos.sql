-- 15-ciclos-lectivos.sql
-- Migracion incremental e idempotente: ciclos lectivos y promocion de alumnos
-- al año siguiente (con repitencia, egreso o baja), registrada en
-- alumno_movimientos.

USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ciclos_lectivos (
  id_ciclo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio SMALLINT UNSIGNED NOT NULL,
  estado ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
  cerrado_por INT UNSIGNED DEFAULT NULL,
  cerrado_en DATETIME DEFAULT NULL,
  PRIMARY KEY (id_ciclo),
  UNIQUE KEY uq_ciclo_anio (anio),
  CONSTRAINT fk_ciclo_cerrado_por FOREIGN KEY (cerrado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ciclos_lectivos (anio, estado) VALUES (YEAR(CURDATE()), 'abierto');

-- Nuevos tipos de movimiento para el cierre de ciclo (MODIFY es idempotente).
ALTER TABLE alumno_movimientos
  MODIFY tipo ENUM('cambio_curso', 'baja', 'promocion', 'repitencia', 'egreso') NOT NULL;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('ciclos.promover', 'Promover alumnos y cerrar el ciclo lectivo');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'ciclos.promover'
WHERE r.nombre IN ('Administrador Academico', 'Administrador');
