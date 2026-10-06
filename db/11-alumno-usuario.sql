-- 11-alumno-usuario.sql
-- Migracion incremental e idempotente: el alumno se vincula con su cuenta de
-- usuario por FK (alumnos.usuario_id) en lugar de comparar emails.

USE ProyectoEstela;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS migrar_alumno_usuario;
DELIMITER $$
CREATE PROCEDURE migrar_alumno_usuario()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'alumnos' AND COLUMN_NAME = 'usuario_id') THEN
    ALTER TABLE alumnos
      ADD COLUMN usuario_id INT UNSIGNED NULL AFTER email,
      ADD UNIQUE KEY uq_alumno_usuario (usuario_id),
      ADD CONSTRAINT fk_alumno_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;
CALL migrar_alumno_usuario();
DROP PROCEDURE migrar_alumno_usuario;

-- Backfill por email: solo usuarios con rol Alumno, un usuario por alumno (si
-- dos alumnos comparten email, queda vinculado el de menor id).
UPDATE alumnos a
JOIN (
  SELECT MIN(a2.id_alumno) AS id_alumno, u.id_usuario
  FROM alumnos a2
  JOIN usuarios u ON u.email = a2.email
  JOIN roles r ON r.id_rol = u.rol_id AND r.nombre = 'Alumno'
  WHERE a2.email IS NOT NULL
  GROUP BY u.id_usuario
) v ON v.id_alumno = a.id_alumno
LEFT JOIN alumnos ya ON ya.usuario_id = v.id_usuario
SET a.usuario_id = v.id_usuario
WHERE a.usuario_id IS NULL AND ya.id_alumno IS NULL;
