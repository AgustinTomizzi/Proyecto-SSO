-- 12-actividad-demo.sql
-- DATOS DE DEMOSTRACION (no ejecutar en una instalacion real).
-- Se generan al crear la base, relativos a la fecha de ese momento:
--   * 8 semanas de asistencias de cada alumno activo, segun la grilla vigente
--     de su curso (grupo 0 y, en celdas partidas, el grupo 1 o 2 segun el id
--     del alumno), con tardanzas y ausencias distribuidas; algunos alumnos
--     quedan por debajo del 75 %.
--   * Reservas de Galiservas: finalizadas en las dos semanas previas y
--     confirmadas en las tres siguientes.
-- Es determinista para una misma fecha e idempotente (INSERT IGNORE).

USE ProyectoEstela;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS generar_actividad_demo;
DELIMITER $$
CREATE PROCEDURE generar_actividad_demo()
BEGIN
  DECLARE dias INT DEFAULT 56;
  DECLARE f DATE;
  DECLARE n INT DEFAULT -14;

  WHILE dias >= 1 DO
    SET f = DATE_SUB(CURDATE(), INTERVAL dias DAY);
    IF WEEKDAY(f) < 5 THEN
      INSERT IGNORE INTO asistencias (fecha, estado, alumno_id, materia_id)
      SELECT DISTINCT f,
        CASE
          WHEN MOD(CRC32(CONCAT(a.id_alumno, '-', hc.materia_id, '-', f)), 100) < IF(MOD(a.id_alumno, 6) = 0, 30, 6) THEN 'ausente'
          WHEN MOD(CRC32(CONCAT(a.id_alumno, '-', hc.materia_id, '-', f)), 100) < IF(MOD(a.id_alumno, 6) = 0, 40, 14) THEN 'tarde'
          ELSE 'presente'
        END,
        a.id_alumno, hc.materia_id
      FROM alumnos a
      JOIN horario_clases hc ON hc.curso_id = a.curso_id
        AND hc.dia_semana = WEEKDAY(f) + 1
        AND (hc.grupo = 0 OR hc.grupo = 2 - MOD(a.id_alumno, 2))
        AND hc.vigente_desde <= f AND (hc.vigente_hasta IS NULL OR hc.vigente_hasta >= f)
      WHERE a.estado = 1;
    END IF;
    SET dias = dias - 1;
  END WHILE;

  -- Reservas: una o dos por dia habil, rotando recursos y usuarios.
  WHILE n <= 21 DO
    SET f = DATE_ADD(CURDATE(), INTERVAL n DAY);
    IF WEEKDAY(f) < 5 AND n <> 0 THEN
      INSERT IGNORE INTO reservations (user_id, resource_id, reservation_date, start_time, end_time, quantity, reason, status)
      SELECT
        (SELECT id_usuario FROM usuarios WHERE email = ELT(MOD(ABS(n), 3) + 1, 'docente@galileo.edu.ar', 'preceptor@galileo.edu.ar', 'preceptora.lagos@galileo.edu.ar')),
        r.id_resource, f,
        ELT(MOD(ABS(n), 4) + 1, '08:00', '10:00', '13:30', '15:30'),
        ELT(MOD(ABS(n), 4) + 1, '09:20', '11:40', '15:00', '17:00'),
        LEAST(r.capacity, 2 + MOD(ABS(n), 3)),
        ELT(MOD(ABS(n), 5) + 1, 'Práctica de programación', 'Taller audiovisual', 'Trabajo práctico de redes', 'Proyecto integrador', 'Clase de laboratorio'),
        IF(n < 0, 'completada', 'confirmada')
      FROM resources r
      WHERE r.active = 1 AND r.name = ELT(MOD(ABS(n), 4) + 1, 'Aula 210', 'Notebooks', 'Aula 209', 'Proyectores');
      IF MOD(ABS(n), 2) = 0 THEN
        INSERT IGNORE INTO reservations (user_id, resource_id, reservation_date, start_time, end_time, quantity, reason, status)
        SELECT (SELECT id_usuario FROM usuarios WHERE email = 'docente@galileo.edu.ar'), r.id_resource, f, '17:30', '19:30',
          LEAST(r.capacity, 3), 'Clase del vespertino', IF(n < 0, 'completada', 'confirmada')
        FROM resources r WHERE r.active = 1 AND r.name = 'Aula 208';
      END IF;
    END IF;
    SET n = n + 1;
  END WHILE;
END$$
DELIMITER ;

CALL generar_actividad_demo();
DROP PROCEDURE generar_actividad_demo;
