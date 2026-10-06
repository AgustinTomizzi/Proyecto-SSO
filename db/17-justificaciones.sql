-- 17-justificaciones.sql
-- Migracion incremental e idempotente: justificacion de inasistencias.
-- Una justificacion cubre un rango de fechas de un alumno (motivo y adjunto
-- opcional); las ausencias de ese rango pasan a 'justificado'. El adjunto se
-- guarda en la base para que funcione con varias replicas del backend.

USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS justificaciones (
  id_justificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  adjunto MEDIUMBLOB NULL,
  adjunto_nombre VARCHAR(255) NULL,
  adjunto_tipo VARCHAR(64) NULL,
  creado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_justificacion),
  KEY idx_justif_alumno (alumno_id, desde, hasta),
  CONSTRAINT fk_justif_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_justif_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT chk_justif_rango CHECK (hasta >= desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nuevo estado (MODIFY es idempotente).
ALTER TABLE asistencias
  MODIFY estado ENUM('presente','tarde','ausente','justificado') NOT NULL DEFAULT 'presente';

DROP PROCEDURE IF EXISTS migrar_justificaciones;
DELIMITER $$
CREATE PROCEDURE migrar_justificaciones()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asistencias' AND COLUMN_NAME = 'justificacion_id') THEN
    ALTER TABLE asistencias
      ADD COLUMN justificacion_id INT UNSIGNED NULL AFTER estado,
      ADD CONSTRAINT fk_asist_justificacion FOREIGN KEY (justificacion_id) REFERENCES justificaciones (id_justificacion) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL migrar_justificaciones();
DROP PROCEDURE migrar_justificaciones;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('asistencia.justificar', 'Justificar inasistencias de alumnos');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'asistencia.justificar'
WHERE r.nombre IN ('Preceptor', 'Administrador Academico', 'Administrador');
