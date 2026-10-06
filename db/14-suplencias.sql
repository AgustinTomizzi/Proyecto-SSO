-- 14-suplencias.sql
-- Migracion incremental e idempotente: suplencias de preceptores.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Suplencias: un preceptor cubre temporalmente un curso ajeno. El alcance
-- del preceptor incluye el curso solo mientras la suplencia esta vigente.
CREATE TABLE IF NOT EXISTS cursos_suplencias (
  id_suplencia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  preceptor_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  motivo VARCHAR(255) DEFAULT NULL,
  creado_por INT UNSIGNED DEFAULT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_suplencia),
  KEY idx_suplencia_preceptor (preceptor_id, desde, hasta),
  KEY idx_suplencia_curso (curso_id, desde, hasta),
  CONSTRAINT fk_suplencia_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_suplencia_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_suplencia_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT chk_suplencia_fechas CHECK (hasta >= desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('suplencias.crear', 'Registrar suplencias de preceptores');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'suplencias.crear'
WHERE r.nombre IN ('Preceptor', 'Administrador Academico', 'Administrador');
