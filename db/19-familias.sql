-- 19-familias.sql
-- Migracion incremental e idempotente: portal de familias.
-- Rol Tutor (solo lectura de sus alumnos vinculados, en Galisencia), vinculo
-- tutor_alumno y permiso tutores.gestionar para la administracion.

USE ProyectoEstela;
SET NAMES utf8mb4;

INSERT IGNORE INTO roles (nombre) VALUES ('Tutor');

INSERT IGNORE INTO rol_sistema (rol_id, sistema_id)
SELECT r.id_rol, s.id_sistema FROM roles r JOIN sistemas s ON s.nombre = 'Galisencia'
WHERE r.nombre = 'Tutor';

CREATE TABLE IF NOT EXISTS tutor_alumno (
  tutor_id INT UNSIGNED NOT NULL,
  alumno_id INT UNSIGNED NOT NULL,
  parentesco VARCHAR(40) NULL,
  creado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tutor_id, alumno_id),
  KEY idx_tutor_alumno_alumno (alumno_id),
  CONSTRAINT fk_tutor_alumno_tutor FOREIGN KEY (tutor_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_alumno_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_alumno_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('tutores.gestionar', 'Crear cuentas de tutores y vincularlas con alumnos');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'tutores.gestionar'
WHERE r.nombre IN ('Administrador Academico', 'Administrador');

-- El Tutor solo lee lo de sus alumnos (el alcance lo aplica cada endpoint).
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre IN ('asistencia.ver', 'notas.ver', 'horarios.ver')
WHERE r.nombre = 'Tutor';
