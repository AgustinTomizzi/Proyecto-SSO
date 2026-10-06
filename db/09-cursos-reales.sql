-- 09-cursos-reales.sql
-- Migracion incremental e idempotente: los 39 cursos del colegio
-- (1º A-H, 2º y 3º A-F, 4º a 6º 1-5, 7º 1-4). En una instalacion anterior
-- agrega los que falten; los cursos existentes no se tocan.

USE ProyectoEstela;
SET NAMES utf8mb4;

SET @existe_unico := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cursos' AND INDEX_NAME = 'uq_curso_anio_division'
);
SET @sql := IF(@existe_unico = 0,
  'ALTER TABLE cursos ADD UNIQUE KEY uq_curso_anio_division (anio, division)',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO cursos (anio, division, turno) VALUES
  ('1','A','Mañana'), ('1','B','Mañana'), ('1','C','Mañana'), ('1','D','Mañana'),
  ('1','E','Mañana'), ('1','F','Mañana'), ('1','G','Mañana'), ('1','H','Mañana'),
  ('2','A','Mañana'), ('2','B','Mañana'), ('2','C','Mañana'), ('2','D','Mañana'), ('2','E','Mañana'), ('2','F','Mañana'),
  ('3','A','Mañana'), ('3','B','Mañana'), ('3','C','Mañana'), ('3','D','Mañana'), ('3','E','Mañana'), ('3','F','Mañana'),
  ('4','1','Mañana'), ('4','2','Mañana'), ('4','3','Mañana'), ('4','4','Mañana'), ('4','5','Mañana'),
  ('5','1','Mañana'), ('5','2','Mañana'), ('5','3','Mañana'), ('5','4','Mañana'), ('5','5','Mañana'),
  ('6','1','Mañana'), ('6','2','Mañana'), ('6','3','Mañana'), ('6','4','Mañana'), ('6','5','Mañana'),
  ('7','1','Tarde'), ('7','2','Tarde'), ('7','3','Tarde'), ('7','4','Tarde');
