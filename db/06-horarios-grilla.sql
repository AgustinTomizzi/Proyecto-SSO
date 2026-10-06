-- 06-horarios-grilla.sql
-- Migracion incremental e idempotente: grilla de horarios por curso
-- (franjas por turno y clases con materia, docente y aula).

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Grilla de horarios (Fase 1). Reemplaza a horarios_curso (imagen), que queda
-- como historico de solo lectura.
CREATE TABLE IF NOT EXISTS franjas_horarias (
  id_franja INT UNSIGNED NOT NULL AUTO_INCREMENT,
  turno VARCHAR(20) NOT NULL,
  orden TINYINT UNSIGNED NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  es_recreo TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_franja),
  UNIQUE KEY uq_franja_turno_orden (turno, orden),
  CONSTRAINT chk_franja_horario CHECK (hora_inicio < hora_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS horario_clases (
  id_clase INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  franja_id INT UNSIGNED NOT NULL,
  materia_id INT UNSIGNED NOT NULL,
  docente_id INT UNSIGNED DEFAULT NULL,
  aula_resource_id INT UNSIGNED DEFAULT NULL,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE DEFAULT NULL,
  PRIMARY KEY (id_clase),
  UNIQUE KEY uq_clase_curso_dia_franja (curso_id, dia_semana, franja_id, vigente_desde),
  KEY idx_clase_docente (docente_id, dia_semana, franja_id),
  KEY idx_clase_aula (aula_resource_id, dia_semana, franja_id),
  CONSTRAINT fk_clase_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_clase_franja FOREIGN KEY (franja_id) REFERENCES franjas_horarias (id_franja) ON DELETE RESTRICT,
  CONSTRAINT fk_clase_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT,
  CONSTRAINT fk_clase_docente FOREIGN KEY (docente_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_clase_aula FOREIGN KEY (aula_resource_id) REFERENCES resources (id_resource) ON DELETE SET NULL,
  CONSTRAINT chk_clase_dia CHECK (dia_semana BETWEEN 1 AND 5),
  CONSTRAINT chk_clase_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Modulos de 40 minutos por turno; los recreos ocupan una franja propia.
INSERT IGNORE INTO franjas_horarias (turno, orden, hora_inicio, hora_fin, es_recreo) VALUES
  ('Mañana', 1, '07:30', '08:10', 0), ('Mañana', 2, '08:10', '08:50', 0), ('Mañana', 3, '08:50', '09:00', 1),
  ('Mañana', 4, '09:00', '09:40', 0), ('Mañana', 5, '09:40', '10:20', 0), ('Mañana', 6, '10:20', '10:30', 1),
  ('Mañana', 7, '10:30', '11:10', 0), ('Mañana', 8, '11:10', '11:50', 0),
  ('Tarde', 1, '13:00', '13:40', 0), ('Tarde', 2, '13:40', '14:20', 0), ('Tarde', 3, '14:20', '14:30', 1),
  ('Tarde', 4, '14:30', '15:10', 0), ('Tarde', 5, '15:10', '15:50', 0), ('Tarde', 6, '15:50', '16:00', 1),
  ('Tarde', 7, '16:00', '16:40', 0), ('Tarde', 8, '16:40', '17:20', 0);
