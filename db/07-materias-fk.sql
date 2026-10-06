-- 07-materias-fk.sql
-- Migracion incremental e idempotente: asistencias y notas referencian
-- materias por FK (materia_id) en lugar de guardar el nombre como texto.
--
-- La comparacion de nombres usa la collation de las tablas (utf8mb4 *_ai_ci),
-- que ignora tildes y mayusculas: "matematica", "Matemática" y "MATEMATICA"
-- resuelven a la misma materia.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Nombres canonicos con tildes (coinciden con los que muestra la interfaz).
UPDATE materias SET nombre = CASE nombre
  WHEN 'Matematica' THEN 'Matemática'
  WHEN 'Biologia' THEN 'Biología'
  WHEN 'Ingles' THEN 'Inglés'
  WHEN 'Fisica' THEN 'Física'
  WHEN 'Ed. Tecnica' THEN 'Ed. Técnica'
  WHEN 'Geografia' THEN 'Geografía'
  WHEN 'Quimica' THEN 'Química'
  WHEN 'Ciudadania' THEN 'Ciudadanía'
  ELSE nombre END
WHERE BINARY nombre IN ('Matematica','Biologia','Ingles','Fisica','Ed. Tecnica','Geografia','Quimica','Ciudadania');

DROP PROCEDURE IF EXISTS migrar_materias_fk;
DELIMITER $$
CREATE PROCEDURE migrar_materias_fk()
BEGIN
  -- asistencias.materia (texto) -> asistencias.materia_id
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asistencias' AND COLUMN_NAME = 'materia') THEN
    -- Toda materia escrita a mano pasa al catalogo (el UNIQUE ai_ci evita
    -- duplicados); un texto vacio queda como 'Sin materia'.
    INSERT IGNORE INTO materias (nombre)
      SELECT DISTINCT COALESCE(NULLIF(TRIM(materia), ''), 'Sin materia') FROM asistencias;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asistencias' AND COLUMN_NAME = 'materia_id') THEN
      ALTER TABLE asistencias ADD COLUMN materia_id INT UNSIGNED NULL AFTER alumno_id;
    END IF;
    UPDATE asistencias a JOIN materias m ON m.nombre = COALESCE(NULLIF(TRIM(a.materia), ''), 'Sin materia')
      SET a.materia_id = m.id_materia
      WHERE a.materia_id IS NULL;
    -- Variantes del mismo nombre (espacios, etc.) pueden chocar en la clave
    -- nueva: se conserva el registro mas reciente.
    DELETE a FROM asistencias a
      JOIN asistencias b ON b.alumno_id = a.alumno_id AND b.materia_id = a.materia_id AND b.fecha = a.fecha AND b.id_asistencia > a.id_asistencia;
    -- La clave nueva se crea antes de borrar la vieja: la FK de alumno_id
    -- necesita siempre un indice que empiece por esa columna.
    ALTER TABLE asistencias
      MODIFY materia_id INT UNSIGNED NOT NULL,
      ADD CONSTRAINT fk_asist_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT,
      ADD UNIQUE KEY uq_asist_materia (alumno_id, materia_id, fecha);
    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asistencias' AND INDEX_NAME = 'uq_asist') THEN
      ALTER TABLE asistencias DROP INDEX uq_asist;
    END IF;
    ALTER TABLE asistencias DROP COLUMN materia;
  END IF;

  -- notas.materia (texto) -> notas.materia_id
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notas' AND COLUMN_NAME = 'materia') THEN
    INSERT IGNORE INTO materias (nombre)
      SELECT DISTINCT COALESCE(NULLIF(TRIM(materia), ''), 'Sin materia') FROM notas;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notas' AND COLUMN_NAME = 'materia_id') THEN
      ALTER TABLE notas ADD COLUMN materia_id INT UNSIGNED NULL AFTER alumno_id;
    END IF;
    UPDATE notas n JOIN materias m ON m.nombre = COALESCE(NULLIF(TRIM(n.materia), ''), 'Sin materia')
      SET n.materia_id = m.id_materia
      WHERE n.materia_id IS NULL;
    ALTER TABLE notas
      MODIFY materia_id INT UNSIGNED NOT NULL,
      ADD CONSTRAINT fk_nota_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT,
      ADD KEY idx_nota_alumno_materia (alumno_id, materia_id),
      DROP COLUMN materia;
  END IF;
END$$
DELIMITER ;

CALL migrar_materias_fk();
DROP PROCEDURE migrar_materias_fk;
