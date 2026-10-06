-- 08-alcance-docente.sql
-- Migracion incremental e idempotente: con la grilla de horarios, Preceptor,
-- Docente y Directivo pueden consultar horarios (horarios.ver). El alcance del
-- Docente (cursos y materias que dicta) lo aplica la API leyendo horario_clases.

USE ProyectoEstela;
SET NAMES utf8mb4;

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'horarios.ver'
WHERE r.nombre IN ('Preceptor', 'Docente', 'Directivo');
