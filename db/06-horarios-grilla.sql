-- 06-horarios-grilla.sql
-- Migracion incremental e idempotente: grilla de horarios por curso
-- (modulos, aulas y clases con materia, docente, aula, grupo y vigencia).

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Grilla de horarios (Fase 1). Mismo formato que los horarios del colegio:
-- 12 modulos de 60 minutos compartidos por todos los cursos (mañana, tarde y
-- vespertino); un curso puede cursar en varios turnos. Reemplaza a
-- horarios_curso (imagen), que queda como historico de solo lectura.
CREATE TABLE IF NOT EXISTS franjas_horarias (
  id_franja INT UNSIGNED NOT NULL AUTO_INCREMENT,
  orden TINYINT UNSIGNED NOT NULL,
  turno VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  PRIMARY KEY (id_franja),
  UNIQUE KEY uq_franja_orden (orden),
  CONSTRAINT chk_franja_horario CHECK (hora_inicio < hora_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aulas del colegio por codigo (AT5, TR2, 204, Playón...). Si el aula tambien
-- se reserva en Galiservas, resource_id la vincula con el recurso.
CREATE TABLE IF NOT EXISTS aulas (
  id_aula INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) DEFAULT NULL,
  resource_id INT UNSIGNED DEFAULT NULL,
  -- 1 = admite varias clases a la vez (Playón, Campo, Patio).
  compartida TINYINT(1) NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_aula),
  UNIQUE KEY uq_aula_codigo (codigo),
  UNIQUE KEY uq_aula_resource (resource_id),
  CONSTRAINT fk_aula_resource FOREIGN KEY (resource_id) REFERENCES resources (id_resource) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Una fila por curso, dia, modulo y grupo. grupo 0 = curso completo;
-- 1 y 2 = mitades del curso que cursan en paralelo (celda partida).
CREATE TABLE IF NOT EXISTS horario_clases (
  id_clase INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  franja_id INT UNSIGNED NOT NULL,
  grupo TINYINT UNSIGNED NOT NULL DEFAULT 0,
  materia_id INT UNSIGNED NOT NULL,
  docente_id INT UNSIGNED DEFAULT NULL,
  aula_id INT UNSIGNED DEFAULT NULL,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE DEFAULT NULL,
  PRIMARY KEY (id_clase),
  UNIQUE KEY uq_clase_celda (curso_id, dia_semana, franja_id, grupo, vigente_desde),
  KEY idx_clase_docente (docente_id, dia_semana, franja_id),
  KEY idx_clase_aula (aula_id, dia_semana, franja_id),
  CONSTRAINT fk_clase_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_clase_franja FOREIGN KEY (franja_id) REFERENCES franjas_horarias (id_franja) ON DELETE RESTRICT,
  CONSTRAINT fk_clase_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT,
  CONSTRAINT fk_clase_docente FOREIGN KEY (docente_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_clase_aula FOREIGN KEY (aula_id) REFERENCES aulas (id_aula) ON DELETE SET NULL,
  CONSTRAINT chk_clase_dia CHECK (dia_semana BETWEEN 1 AND 5),
  CONSTRAINT chk_clase_grupo CHECK (grupo IN (0, 1, 2)),
  CONSTRAINT chk_clase_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Modulos del colegio (horarios.galileo.edu.ar). Entre modulos hay recreos y,
-- entre la mañana y la tarde, el cambio de turno.
INSERT IGNORE INTO franjas_horarias (orden, turno, hora_inicio, hora_fin) VALUES
  (1, 'Mañana', '07:40', '08:40'), (2, 'Mañana', '08:40', '09:40'),
  (3, 'Mañana', '09:55', '10:55'), (4, 'Mañana', '10:55', '11:55'),
  (5, 'Tarde', '13:00', '14:00'), (6, 'Tarde', '14:00', '15:00'),
  (7, 'Tarde', '15:15', '16:15'), (8, 'Tarde', '16:15', '17:15'),
  (9, 'Vespertino', '17:30', '18:30'), (10, 'Vespertino', '18:30', '19:30'),
  (11, 'Vespertino', '19:40', '20:40'), (12, 'Vespertino', '20:40', '21:40');
