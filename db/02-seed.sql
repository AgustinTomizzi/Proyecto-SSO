-- 02-seed.sql
-- Datos para una base limpia creada por 01-schema.sql.
-- Password de todos los usuarios: demo1234

USE ProyectoEstela;
SET NAMES utf8mb4;

INSERT INTO roles (nombre) VALUES
  ('Alumno'), ('Preceptor'), ('Directivo'), ('Administrador Academico'), ('Docente'), ('Administrador');

INSERT INTO sistemas (nombre, descripcion) VALUES
  ('Galisencia', 'Sistema de gestion academica y asistencia'),
  ('Galiservas', 'Sistema de reservas de recursos escolares');

INSERT INTO permisos (nombre, descripcion) VALUES
  ('alumnos.ver', 'Ver alumnos'),
  ('alumnos.crear', 'Crear alumnos'),
  ('alumnos.editar', 'Editar alumnos'),
  ('alumnos.dar_baja', 'Dar de baja alumnos'),
  ('cursos.ver', 'Ver cursos'),
  ('cursos.crear', 'Crear cursos'),
  ('cursos.asignar', 'Asignar preceptores a cursos'),
  ('asistencia.ver', 'Ver asistencias'),
  ('asistencia.registrar', 'Registrar asistencias'),
  ('asistencia.editar', 'Editar asistencias'),
  ('notas.ver', 'Ver notas'),
  ('notas.crear', 'Crear notas'),
  ('reportes.ver', 'Ver reportes'),
  ('usuarios.ver', 'Ver usuarios y roles'),
  ('usuarios.crear', 'Crear usuarios'),
  ('usuarios.editar_rol', 'Cambiar roles de usuarios'),
  ('auditoria.ver', 'Ver auditoria'),
  ('recursos.ver', 'Ver recursos'),
  ('recursos.crear', 'Crear recursos'),
  ('recursos.editar', 'Editar recursos'),
  ('recursos.desactivar', 'Desactivar recursos'),
  ('reservas.ver', 'Ver reservas permitidas'),
  ('reservas.crear', 'Crear reservas'),
  ('reservas.editar', 'Editar reservas'),
  ('reservas.cancelar', 'Cancelar reservas'),
  ('reservas.administrar', 'Administrar todas las reservas'),
  ('galiservas.acceder', 'Acceder al sistema Galiservas');

-- Galisencia admite todos los perfiles; Galiservas solo Preceptor, Docente y Administrador.
INSERT INTO rol_sistema (rol_id, sistema_id)
SELECT r.id_rol, s.id_sistema FROM roles r CROSS JOIN sistemas s
WHERE s.nombre = 'Galisencia'
   OR (s.nombre = 'Galiservas' AND r.nombre IN ('Preceptor','Docente','Administrador'));

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Alumno' AND p.nombre IN ('asistencia.ver','notas.ver');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Preceptor' AND p.nombre IN ('alumnos.ver','alumnos.crear','alumnos.editar','alumnos.dar_baja','cursos.ver','asistencia.ver','asistencia.registrar','asistencia.editar','notas.ver','reportes.ver','recursos.ver','reservas.ver','reservas.crear','reservas.editar','reservas.cancelar','galiservas.acceder');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Directivo' AND p.nombre IN ('alumnos.ver','cursos.ver','asistencia.ver','notas.ver','reportes.ver');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador Academico' AND p.nombre IN ('alumnos.ver','alumnos.crear','alumnos.editar','alumnos.dar_baja','cursos.ver','cursos.crear','cursos.asignar','asistencia.ver','asistencia.registrar','asistencia.editar','notas.ver','notas.crear','reportes.ver');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Docente' AND p.nombre IN ('alumnos.ver','cursos.ver','asistencia.ver','asistencia.registrar','asistencia.editar','notas.ver','notas.crear','recursos.ver','reservas.ver','reservas.crear','reservas.editar','reservas.cancelar','galiservas.acceder');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador';

INSERT INTO usuarios (nombre, apellido, email, contrasena, rol_id) VALUES
  ('Admin', 'Estela', 'admin@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Administrador')),
  ('Ana', 'Suarez', 'academica@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Administrador Academico')),
  ('Carlos', 'Ramirez', 'preceptor@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Preceptor')),
  ('Laura', 'Lagos', 'preceptora.lagos@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Preceptor')),
  ('Marta', 'Barbosa', 'directivo@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Directivo')),
  ('Diego', 'Medina', 'docente@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Docente')),
  ('Sofia', 'Gutierrez', 'alumno@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Alumno')),
  ('Mateo', 'Fernandez', 'mateo.usuario@galileo.edu.ar', '$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy', (SELECT id_rol FROM roles WHERE nombre = 'Alumno'));

INSERT INTO cursos (anio, division, turno, preceptor, preceptor_id) VALUES
  ('1', 'A', 'Mañana', 'Carlos Ramirez', (SELECT id_usuario FROM usuarios WHERE email = 'preceptor@galileo.edu.ar')),
  ('1', 'B', 'Mañana', 'Laura Lagos', (SELECT id_usuario FROM usuarios WHERE email = 'preceptora.lagos@galileo.edu.ar')),
  ('2', 'A', 'Mañana', 'Carlos Ramirez', (SELECT id_usuario FROM usuarios WHERE email = 'preceptor@galileo.edu.ar')),
  ('2', 'B', 'Tarde', 'Laura Lagos', (SELECT id_usuario FROM usuarios WHERE email = 'preceptora.lagos@galileo.edu.ar')),
  ('3', 'A', 'Mañana', 'Carlos Ramirez', (SELECT id_usuario FROM usuarios WHERE email = 'preceptor@galileo.edu.ar')),
  ('3', 'B', 'Tarde', 'Laura Lagos', (SELECT id_usuario FROM usuarios WHERE email = 'preceptora.lagos@galileo.edu.ar')),
  ('4', 'A', 'Mañana', NULL, NULL),
  ('4', 'B', 'Tarde', NULL, NULL),
  ('5', 'A', 'Mañana', NULL, NULL),
  ('6', 'A', 'Tarde', NULL, NULL);

INSERT INTO alumnos (nombre, apellido, dni, direccion, email, curso_id, estado) VALUES
  ('Sofia','Gutierrez','46000001','Belgrano 101','alumno@galileo.edu.ar',1,1),
  ('Mateo','Fernandez','46000002','Belgrano 102','mateo.usuario@galileo.edu.ar',1,1),
  ('Valentina','Lopez','46000003','Belgrano 103','valentina.lopez@galileo.edu.ar',1,1),
  ('Benjamin','Rodriguez','46000004','Belgrano 104','benjamin.rodriguez@galileo.edu.ar',1,1),
  ('Camila','Gonzalez','46000005','San Martin 201','camila.gonzalez@galileo.edu.ar',2,1),
  ('Thiago','Diaz','46000006','San Martin 202','thiago.diaz@galileo.edu.ar',2,1),
  ('Isabella','Martinez','46000007','San Martin 203','isabella.martinez@galileo.edu.ar',2,1),
  ('Lucas','Sanchez','46000008','San Martin 204','lucas.sanchez@galileo.edu.ar',2,1),
  ('Emma','Perez','46000009','Mitre 301','emma.perez@galileo.edu.ar',3,1),
  ('Agustin','Romero','46000010','Mitre 302','agustin.romero@galileo.edu.ar',3,1),
  ('Martina','Torres','46000011','Mitre 303','martina.torres@galileo.edu.ar',3,1),
  ('Bautista','Acosta','46000012','Mitre 304','bautista.acosta@galileo.edu.ar',3,1),
  ('Lucia','Herrera','46000013','Rivadavia 401','lucia.herrera@galileo.edu.ar',4,1),
  ('Joaquin','Mendez','46000014','Rivadavia 402','joaquin.mendez@galileo.edu.ar',4,1),
  ('Juana','Castro','46000015','Rivadavia 403','juana.castro@galileo.edu.ar',4,1),
  ('Tomas','Vega','46000016','Rivadavia 404','tomas.vega@galileo.edu.ar',4,1),
  ('Delfina','Rojas','46000017','Sarmiento 501','delfina.rojas@galileo.edu.ar',5,1),
  ('Franco','Silva','46000018','Sarmiento 502','franco.silva@galileo.edu.ar',5,1),
  ('Malena','Ortiz','46000019','Sarmiento 503','malena.ortiz@galileo.edu.ar',5,1),
  ('Bruno','Navarro','46000020','Sarmiento 504','bruno.navarro@galileo.edu.ar',5,1),
  ('Renata','Molina','46000021','Colon 601','renata.molina@galileo.edu.ar',6,1),
  ('Santino','Ruiz','46000022','Colon 602','santino.ruiz@galileo.edu.ar',6,1),
  ('Catalina','Blanco','46000023','Colon 603','catalina.blanco@galileo.edu.ar',6,1),
  ('Facundo','Paz','46000024','Colon 604','facundo.paz@galileo.edu.ar',6,1),
  ('Emilia','Cabrera','46000025','Alberdi 701','emilia.cabrera@galileo.edu.ar',7,1),
  ('Nicolas','Ibarra','46000026','Alberdi 702','nicolas.ibarra@galileo.edu.ar',7,1),
  ('Pilar','Aguirre','46000027','Alberdi 703','pilar.aguirre@galileo.edu.ar',7,1),
  ('Lautaro','Farias','46000028','Alberdi 704','lautaro.farias@galileo.edu.ar',8,1),
  ('Abril','Peralta','46000029','Moreno 801','abril.peralta@galileo.edu.ar',8,1),
  ('Ignacio','Campos','46000030','Moreno 802','ignacio.campos@galileo.edu.ar',8,1),
  ('Olivia','Vera','46000031','Moreno 803','olivia.vera@galileo.edu.ar',9,1),
  ('Manuel','Correa','46000032','Moreno 804','manuel.correa@galileo.edu.ar',9,1),
  ('Alma','Gimenez','46000033','Italia 901','alma.gimenez@galileo.edu.ar',9,1),
  ('Pedro','Luna','46000034','Italia 902','pedro.luna@galileo.edu.ar',10,1),
  ('Mia','Benitez','46000035','Italia 903','mia.benitez@galileo.edu.ar',10,1);

INSERT INTO materias (nombre) VALUES
  ('Matematica'),('Lengua'),('Historia'),('Biologia'),('Ingles'),('Fisica'),('Ed. Tecnica'),('Geografia'),('Quimica'),('Ciudadania');

DELIMITER $$
CREATE PROCEDURE seed_datos_academicos()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE aid INT;
  DECLARE cur CURSOR FOR SELECT id_alumno FROM alumnos;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  carga: LOOP
    FETCH cur INTO aid;
    IF done THEN LEAVE carga; END IF;
    INSERT INTO asistencias (fecha, estado, alumno_id, materia) VALUES
      ('2026-08-24','presente',aid,'Matematica'),
      ('2026-08-25',IF(MOD(aid,5)=0,'ausente','presente'),aid,'Lengua'),
      ('2026-08-26',IF(MOD(aid,4)=0,'tarde','presente'),aid,'Historia'),
      ('2026-08-27','presente',aid,'Biologia');
    INSERT INTO notas (nota, fecha, alumno_id, materia) VALUES
      (6 + MOD(aid,5), '2026-08-20', aid, 'Matematica'),
      (5 + MOD(aid,6), '2026-08-21', aid, 'Lengua'),
      (6 + MOD(aid + 2,5), '2026-08-22', aid, 'Historia');
  END LOOP;
  CLOSE cur;
END$$
DELIMITER ;
CALL seed_datos_academicos();
DROP PROCEDURE seed_datos_academicos;

INSERT INTO resources (name, type, category, location, description, capacity, active, available) VALUES
  ('Aula 210', 'desktop_pc', 'hardware_pc', 'Aula 210', 'Inventario reservable de 6 PC de escritorio', 6, 1, 1),
  ('Aula 209', 'desktop_pc', 'hardware_pc', 'Aula 209', 'Inventario reservable de 5 PC de escritorio', 5, 1, 1),
  ('Aula 208', 'desktop_pc', 'hardware_pc', 'Aula 208', 'Inventario reservable de 5 PC de escritorio', 5, 1, 1),
  ('Notebooks', 'notebook', 'hardware_pc', 'Pañol', 'Inventario reservable de 30 notebooks', 30, 1, 1),
  ('Teclados', 'teclado', 'hardware_pc', 'Pañol', 'Teclados para equipos de laboratorio', 20, 1, 1),
  ('Mouse', 'mouse', 'hardware_pc', 'Pañol', 'Mouse para equipos de laboratorio', 20, 1, 1),
  ('CPUs', 'cpu', 'hardware_pc', 'Pañol', 'Unidades de procesamiento disponibles para prácticas', 6, 1, 1),
  ('Proyectores', 'proyector', 'audiovisual', 'Pañol', 'Proyectores portátiles para clases y actos', 5, 1, 1),
  ('Cámaras', 'camara', 'audiovisual', 'Pañol', 'Cámaras para producciones audiovisuales escolares', 6, 1, 1),
  ('Micrófonos', 'microfono', 'audiovisual', 'Pañol', 'Micrófonos para actos, clases y producciones', 8, 1, 1),
  ('Parlantes', 'parlante', 'audiovisual', 'Pañol', 'Parlantes portátiles para actividades escolares', 8, 1, 1),
  ('Cables', 'cable', 'hardware_pc', 'Pañol', 'Cables de audio, video, red y alimentación', 30, 1, 1);

INSERT INTO reservations (user_id, resource_id, reservation_date, start_time, end_time, quantity, reason, status) VALUES
  ((SELECT id_usuario FROM usuarios WHERE email='docente@galileo.edu.ar'), 1, '2026-09-07', '08:00', '09:20', 4, 'Practica de programacion', 'confirmada'),
  ((SELECT id_usuario FROM usuarios WHERE email='preceptor@galileo.edu.ar'), 4, '2026-09-08', '10:00', '12:00', 2, 'Taller audiovisual', 'confirmada'),
  ((SELECT id_usuario FROM usuarios WHERE email='docente@galileo.edu.ar'), 2, '2026-09-09', '13:30', '15:00', 1, 'Trabajo practico de tecnologia', 'confirmada'),
  ((SELECT id_usuario FROM usuarios WHERE email='admin@galileo.edu.ar'), 3, '2026-09-10', '09:00', '10:00', 5, 'Capacitacion institucional', 'confirmada'),
  ((SELECT id_usuario FROM usuarios WHERE email='preceptor@galileo.edu.ar'), 4, '2026-09-11', '15:00', '16:30', 1, 'Presentacion grupal', 'cancelada');

INSERT INTO auditoria (usuario_id, usuario_nombre, rol, accion, entidad, entidad_id, detalle, fecha) VALUES
  ((SELECT id_usuario FROM usuarios WHERE email='admin@galileo.edu.ar'), 'Admin Estela', 'Administrador', 'sistema.seed', 'base_datos', NULL, JSON_OBJECT('usuarios', 8, 'alumnos', 35), '2026-09-01 08:00:00'),
  ((SELECT id_usuario FROM usuarios WHERE email='academica@galileo.edu.ar'), 'Ana Suarez', 'Administrador Academico', 'cursos.asignar', 'curso', '1', JSON_OBJECT('preceptor', 'Carlos Ramirez'), '2026-09-01 09:00:00'),
  ((SELECT id_usuario FROM usuarios WHERE email='docente@galileo.edu.ar'), 'Diego Medina', 'Docente', 'reservas.crear', 'reserva', '1', JSON_OBJECT('recurso', 'Aula 210', 'cantidad_pc', 4), '2026-09-02 10:30:00');
