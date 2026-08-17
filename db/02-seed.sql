-- 02-seed.sql
-- Datos de demo. Password de todos los usuarios: demo1234
-- Hash bcrypt de 'demo1234':
-- $2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy

USE ProyectoEstela;

-- Roles (el orden define los ids: 1 Alumno, 2 Preceptor, 3 Directivo, 4 Admin Acad, 5 Docente, 6 Admin)
INSERT IGNORE INTO roles (nombre) VALUES
  ('Alumno'), ('Preceptor'), ('Directivo'), ('Administrador Académico'), ('Docente'), ('Administrador');

-- Permisos (Galisencia)
INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('alumnos.ver','Ver alumnos'),
  ('alumnos.crear','Crear alumnos'),
  ('alumnos.editar','Editar alumnos'),
  ('alumnos.dar_baja','Dar de baja alumnos'),
  ('cursos.ver','Ver cursos'),
  ('asistencia.ver','Ver asistencias'),
  ('asistencia.registrar','Registrar asistencias'),
  ('asistencia.editar','Editar asistencias'),
  ('notas.ver','Ver notas'),
  ('notas.crear','Crear notas'),
  ('reportes.ver','Ver reportes');

-- Sistema
INSERT IGNORE INTO sistemas (nombre, descripcion) VALUES
  ('Galisencia','Sistema de gestión de asistencia');

-- Roles -> Sistema Galisencia
INSERT IGNORE INTO rol_sistema (rol_id, sistema_id)
SELECT r.id_rol, s.id_sistema FROM roles r CROSS JOIN sistemas s
WHERE s.nombre = 'Galisencia'
  AND r.nombre IN ('Alumno','Preceptor','Directivo','Administrador Académico');

-- Roles -> Permisos
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Alumno' AND p.nombre IN ('asistencia.ver','notas.ver');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Preceptor' AND p.nombre IN ('asistencia.ver','asistencia.registrar','asistencia.editar','alumnos.ver','cursos.ver');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Directivo' AND p.nombre IN ('asistencia.ver','alumnos.ver','cursos.ver','notas.ver','reportes.ver');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador Académico' AND p.nombre IN
  ('asistencia.ver','asistencia.registrar','asistencia.editar',
   'alumnos.ver','alumnos.crear','alumnos.editar','alumnos.dar_baja',
   'cursos.ver','notas.ver','notas.crear','reportes.ver');

-- Usuarios demo (password: demo1234)
INSERT INTO usuarios (nombre, apellido, email, contrasena, rol_id) VALUES
  ('Admin','Estela','admin@galileo.edu.ar','$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy',4),
  ('Prof.','Ramírez','preceptor@galileo.edu.ar','$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy',2),
  ('Lic.','Barbosa','directivo@galileo.edu.ar','$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy',3),
  ('Sofía','Gutiérrez','alumno@galileo.edu.ar','$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy',1);

-- Cursos
INSERT INTO cursos (anio, division, turno, preceptor) VALUES
  ('1.º','A','Mañana','Prof. Ramírez'),
  ('1.º','B','Mañana','Prof. Lagos'),
  ('2.º','A','Tarde','Prof. Medina'),
  ('2.º','B','Tarde','Prof. Sosa'),
  ('3.º','A','Mañana','Prof. Spinelli');

-- Alumnos (15)
INSERT INTO alumnos (nombre, apellido, email, curso_id, estado) VALUES
  ('Sofía','Gutiérrez','alumno@galileo.edu.ar',1,1),
  ('Mateo','Fernández','mateo.fernandez@galileo.edu.ar',1,1),
  ('Valentina','López','valentina.lopez@galileo.edu.ar',1,1),
  ('Benjamín','Rodríguez','benjamin.rodriguez@galileo.edu.ar',2,1),
  ('Camila','González','camila.gonzalez@galileo.edu.ar',2,1),
  ('Thiago','Díaz','thiago.diaz@galileo.edu.ar',2,1),
  ('Isabella','Martínez','isabella.martinez@galileo.edu.ar',3,1),
  ('Lucas','Sánchez','lucas.sanchez@galileo.edu.ar',3,1),
  ('Emma','Pérez','emma.perez@galileo.edu.ar',3,1),
  ('Agustín','Romero','agustin.romero@galileo.edu.ar',4,1),
  ('Martina','Torres','martina.torres@galileo.edu.ar',4,1),
  ('Bautista','Acosta','bautista.acosta@galileo.edu.ar',4,1),
  ('Lucía','Herrera','lucia.herrera@galileo.edu.ar',5,1),
  ('Joaquín','Méndez','joaquin.mendez@galileo.edu.ar',5,1),
  ('Juana','Castro','juana.castro@galileo.edu.ar',5,1);

-- Materias
INSERT IGNORE INTO materias (nombre) VALUES
  ('Matemática'),('Lengua'),('Historia'),('Biología'),('Inglés'),('Física'),('Ed. Técnica');

-- Asistencias demo (generadas para todos los alumnos)
DELIMITER $$
DROP PROCEDURE IF EXISTS seed_asistencias$$
CREATE PROCEDURE seed_asistencias()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE aid INT;
  DECLARE cur CURSOR FOR SELECT id_alumno FROM alumnos;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  loop1: LOOP
    FETCH cur INTO aid;
    IF done THEN LEAVE loop1; END IF;
    INSERT IGNORE INTO asistencias (fecha, estado, alumno_id, materia) VALUES
      ('2026-06-09','presente',aid,'Matemática'),
      ('2026-06-10','tarde',aid,'Matemática'),
      ('2026-06-11','presente',aid,'Lengua'),
      ('2026-06-12','presente',aid,'Lengua'),
      ('2026-06-15','ausente',aid,'Historia'),
      ('2026-06-16','presente',aid,'Historia'),
      ('2026-06-17','presente',aid,'Biología'),
      ('2026-06-18','tarde',aid,'Biología');
  END LOOP;
  CLOSE cur;
END$$
DELIMITER ;
CALL seed_asistencias();
DROP PROCEDURE IF EXISTS seed_asistencias;
