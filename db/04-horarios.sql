USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS horarios_curso (
  id_horario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  tamanio INT UNSIGNED NOT NULL,
  imagen MEDIUMBLOB NOT NULL,
  actualizado_por INT UNSIGNED DEFAULT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_horario),
  UNIQUE KEY uq_horario_curso (curso_id),
  CONSTRAINT fk_horario_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_horario_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('horarios.ver', 'Ver el horario del curso'),
  ('horarios.gestionar', 'Cargar, reemplazar y eliminar horarios');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Alumno' AND p.nombre = 'horarios.ver';

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador Academico' AND p.nombre IN ('horarios.ver', 'horarios.gestionar');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador' AND p.nombre IN ('horarios.ver', 'horarios.gestionar');
