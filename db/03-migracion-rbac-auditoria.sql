-- 03-migracion-rbac-auditoria.sql
-- Migracion incremental e idempotente. No elimina datos existentes.

USE ProyectoEstela;
SET NAMES utf8mb4;

INSERT IGNORE INTO roles (nombre) VALUES
  ('Alumno'), ('Preceptor'), ('Directivo'), ('Administrador Academico'), ('Docente'), ('Administrador');

INSERT IGNORE INTO sistemas (nombre, descripcion) VALUES
  ('Galisencia', 'Sistema de gestion academica y asistencia'),
  ('Galiservas', 'Sistema de reservas de recursos escolares');

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('alumnos.ver','Ver alumnos'), ('alumnos.crear','Crear alumnos'),
  ('alumnos.editar','Editar alumnos'), ('alumnos.dar_baja','Dar de baja alumnos'),
  ('cursos.ver','Ver cursos'), ('cursos.crear','Crear cursos'),
  ('cursos.asignar','Asignar preceptores a cursos'),
  ('asistencia.ver','Ver asistencias'), ('asistencia.registrar','Registrar asistencias'),
  ('asistencia.editar','Editar asistencias'), ('notas.ver','Ver notas'),
  ('notas.crear','Crear notas'), ('reportes.ver','Ver reportes'),
  ('usuarios.ver','Ver usuarios y roles'), ('usuarios.crear','Crear usuarios'),
  ('usuarios.editar_rol','Cambiar roles de usuarios'), ('auditoria.ver','Ver auditoria'),
  ('recursos.ver','Ver recursos'), ('recursos.crear','Crear recursos'),
  ('recursos.editar','Editar recursos'), ('recursos.desactivar','Desactivar recursos'),
  ('reservas.ver','Ver reservas permitidas'), ('reservas.crear','Crear reservas'),
  ('reservas.editar','Editar reservas'), ('reservas.cancelar','Cancelar reservas'),
  ('reservas.administrar','Administrar todas las reservas'),
  ('galiservas.acceder','Acceder al sistema Galiservas');

-- Agrega columnas faltantes sin asumir que la base proviene de una version concreta.
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cursos' AND COLUMN_NAME='preceptor_id');
SET @sql := IF(@col_exists=0, 'ALTER TABLE cursos ADD COLUMN preceptor_id INT UNSIGNED DEFAULT NULL AFTER preceptor', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cursos' AND CONSTRAINT_NAME='fk_curso_preceptor');
SET @sql := IF(@fk_exists=0, 'ALTER TABLE cursos ADD CONSTRAINT fk_curso_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='alumnos' AND COLUMN_NAME='estado');
SET @sql := IF(@col_exists=0, 'ALTER TABLE alumnos ADD COLUMN estado TINYINT(1) NOT NULL DEFAULT 1 AFTER direccion', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE cursos c JOIN usuarios u ON CONCAT(u.nombre, ' ', u.apellido)=c.preceptor
SET c.preceptor_id=u.id_usuario WHERE c.preceptor_id IS NULL;

CREATE TABLE IF NOT EXISTS alumno_movimientos (
  id_movimiento BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id INT UNSIGNED NOT NULL,
  tipo ENUM('cambio_curso','baja') NOT NULL,
  curso_origen_id INT UNSIGNED DEFAULT NULL,
  curso_destino_id INT UNSIGNED DEFAULT NULL,
  ciclo_lectivo YEAR NOT NULL,
  realizado_por INT UNSIGNED NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_movimiento),
  KEY idx_movimiento_alumno_ciclo (alumno_id, ciclo_lectivo, fecha),
  CONSTRAINT fk_movimiento_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE RESTRICT,
  CONSTRAINT fk_movimiento_origen FOREIGN KEY (curso_origen_id) REFERENCES cursos (id_cursos) ON DELETE SET NULL,
  CONSTRAINT fk_movimiento_destino FOREIGN KEY (curso_destino_id) REFERENCES cursos (id_cursos) ON DELETE SET NULL,
  CONSTRAINT fk_movimiento_actor FOREIGN KEY (realizado_por) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resources (
  id_resource INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,
  category ENUM('hardware_pc','audiovisual') NOT NULL DEFAULT 'hardware_pc',
  location VARCHAR(150) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  available TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_resource),
  UNIQUE KEY uq_resource_name_location (name, location),
  KEY idx_resources_available (active, available),
  CONSTRAINT chk_resource_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reservations (
  id_reservation BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pendiente','confirmada','rechazada','cancelada','completada') NOT NULL DEFAULT 'confirmada',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_reservation),
  KEY idx_reservation_resource_slot (resource_id, reservation_date, start_time, end_time, status),
  KEY idx_reservation_user (user_id, reservation_date),
  CONSTRAINT fk_reservation_user FOREIGN KEY (user_id) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT,
  CONSTRAINT fk_reservation_resource FOREIGN KEY (resource_id) REFERENCES resources (id_resource) ON DELETE RESTRICT,
  CONSTRAINT chk_reservation_quantity CHECK (quantity > 0),
  CONSTRAINT chk_reservation_time CHECK (start_time < end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='resources' AND COLUMN_NAME='category');
SET @sql := IF(@col_exists=0, "ALTER TABLE resources ADD COLUMN category ENUM('hardware_pc','audiovisual') NOT NULL DEFAULT 'hardware_pc' AFTER type", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE reservations ALTER COLUMN status SET DEFAULT 'confirmada';
UPDATE reservations SET status='confirmada' WHERE status='pendiente';

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED DEFAULT NULL,
  usuario_nombre VARCHAR(255) DEFAULT NULL,
  rol VARCHAR(100) DEFAULT NULL,
  accion VARCHAR(100) NOT NULL,
  entidad VARCHAR(100) NOT NULL,
  entidad_id VARCHAR(100) DEFAULT NULL,
  detalle JSON DEFAULT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_auditoria),
  KEY idx_auditoria_fecha (fecha),
  KEY idx_auditoria_usuario (usuario_id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Conserva el id y las reservas existentes al convertir el inventario del Pañol.
UPDATE reservations rv
JOIN resources anterior ON anterior.id_resource=rv.resource_id AND anterior.name='Pañol' AND anterior.location='Pañol'
JOIN resources nuevo ON nuevo.name='Notebooks' AND nuevo.location='Pañol'
SET rv.resource_id=nuevo.id_resource;

DELETE anterior FROM resources anterior
JOIN resources nuevo ON nuevo.name='Notebooks' AND nuevo.location='Pañol'
WHERE anterior.name='Pañol' AND anterior.location='Pañol';

UPDATE resources
SET name='Notebooks', type='notebook', category='hardware_pc', description='Inventario reservable de 30 notebooks', capacity=30
WHERE name='Pañol' AND location='Pañol';

UPDATE resources SET category='audiovisual' WHERE type IN ('proyector','camara','microfono','parlante');

INSERT IGNORE INTO resources (name, type, category, location, description, capacity, active, available) VALUES
  ('Aula 210','desktop_pc','hardware_pc','Aula 210','Inventario reservable de 6 PC de escritorio',6,1,1),
  ('Aula 209','desktop_pc','hardware_pc','Aula 209','Inventario reservable de 5 PC de escritorio',5,1,1),
  ('Aula 208','desktop_pc','hardware_pc','Aula 208','Inventario reservable de 5 PC de escritorio',5,1,1),
  ('Notebooks','notebook','hardware_pc','Pañol','Inventario reservable de 30 notebooks',30,1,1),
  ('Teclados','teclado','hardware_pc','Pañol','Teclados para equipos de laboratorio',20,1,1),
  ('Mouse','mouse','hardware_pc','Pañol','Mouse para equipos de laboratorio',20,1,1),
  ('CPUs','cpu','hardware_pc','Pañol','Unidades de procesamiento disponibles para prácticas',6,1,1),
  ('Proyectores','proyector','audiovisual','Pañol','Proyectores portátiles para clases y actos',5,1,1),
  ('Cámaras','camara','audiovisual','Pañol','Cámaras para producciones audiovisuales escolares',6,1,1),
  ('Micrófonos','microfono','audiovisual','Pañol','Micrófonos para actos, clases y producciones',8,1,1),
  ('Parlantes','parlante','audiovisual','Pañol','Parlantes portátiles para actividades escolares',8,1,1),
  ('Cables','cable','hardware_pc','Pañol','Cables de audio, video, red y alimentación',30,1,1);

-- Galisencia admite todos los perfiles; Galiservas solo Preceptor, Docente y Administrador.
INSERT IGNORE INTO rol_sistema (rol_id, sistema_id)
SELECT r.id_rol, s.id_sistema FROM roles r CROSS JOIN sistemas s
WHERE r.nombre IN ('Alumno','Preceptor','Directivo','Administrador Academico','Docente','Administrador')
  AND (s.nombre='Galisencia' OR (s.nombre='Galiservas' AND r.nombre IN ('Preceptor','Docente','Administrador')));

DELETE rs FROM rol_sistema rs
JOIN roles r ON r.id_rol=rs.rol_id JOIN sistemas s ON s.id_sistema=rs.sistema_id
WHERE s.nombre='Galiservas' AND r.nombre NOT IN ('Preceptor','Docente','Administrador');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='Alumno' AND p.nombre IN ('asistencia.ver','notas.ver');
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='Preceptor' AND p.nombre IN ('alumnos.ver','alumnos.crear','alumnos.editar','alumnos.dar_baja','cursos.ver','asistencia.ver','asistencia.registrar','asistencia.editar','notas.ver','reportes.ver','recursos.ver','reservas.ver','reservas.crear','reservas.editar','reservas.cancelar','galiservas.acceder');
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='Directivo' AND p.nombre IN ('alumnos.ver','cursos.ver','asistencia.ver','notas.ver','reportes.ver');
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='Administrador Academico' AND p.nombre IN ('alumnos.ver','alumnos.crear','alumnos.editar','alumnos.dar_baja','cursos.ver','cursos.crear','cursos.asignar','asistencia.ver','asistencia.registrar','asistencia.editar','notas.ver','notas.crear','reportes.ver');
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p
WHERE r.nombre='Docente' AND p.nombre IN ('alumnos.ver','cursos.ver','asistencia.ver','asistencia.registrar','asistencia.editar','notas.ver','notas.crear','recursos.ver','reservas.ver','reservas.crear','reservas.editar','reservas.cancelar','galiservas.acceder');
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol,p.id_permiso FROM roles r CROSS JOIN permisos p WHERE r.nombre='Administrador';

DELETE rp FROM rol_permiso rp
JOIN roles r ON r.id_rol=rp.rol_id JOIN permisos p ON p.id_permiso=rp.permiso_id
WHERE r.nombre IN ('Alumno','Directivo','Administrador Academico')
  AND (p.nombre LIKE 'recursos.%' OR p.nombre LIKE 'reservas.%' OR p.nombre='galiservas.acceder');

-- Corrige instalaciones donde la cuenta principal quedo como Administrador Academico.
UPDATE usuarios SET rol_id=(SELECT id_rol FROM roles WHERE nombre='Administrador')
WHERE email='admin@galileo.edu.ar';
