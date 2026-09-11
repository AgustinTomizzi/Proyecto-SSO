-- 01-schema.sql
-- Base unica compartida ProyectoEstela (Galisencia + Galiservas despues).
-- Tablas compartidas + dominio Galisencia. Corrige contrasena/contrasena y FKs.
-- Incluye preceptor_id en cursos y tabla auditoria (antes en migracion 03).

CREATE DATABASE IF NOT EXISTS ProyectoEstela CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE roles (
  id_rol INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuarios (
  id_usuario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  rol_id INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id_usuario),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES roles (id_rol) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sistemas (
  id_sistema INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permisos (
  id_permiso INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id_permiso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rol_permiso (
  rol_id INT UNSIGNED NOT NULL,
  permiso_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_rp_rol FOREIGN KEY (rol_id) REFERENCES roles (id_rol) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permiso FOREIGN KEY (permiso_id) REFERENCES permisos (id_permiso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rol_sistema (
  rol_id INT UNSIGNED NOT NULL,
  sistema_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (rol_id, sistema_id),
  CONSTRAINT fk_rs_rol FOREIGN KEY (rol_id) REFERENCES roles (id_rol) ON DELETE CASCADE,
  CONSTRAINT fk_rs_sistema FOREIGN KEY (sistema_id) REFERENCES sistemas (id_sistema) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dominio Galisencia
CREATE TABLE cursos (
  id_cursos INT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio VARCHAR(20) NOT NULL,
  division VARCHAR(20) NOT NULL,
  turno VARCHAR(20) NOT NULL DEFAULT 'Mañana',
  preceptor VARCHAR(255) DEFAULT NULL,
  preceptor_id INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id_cursos),
  CONSTRAINT fk_curso_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE alumnos (
  id_alumno INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL DEFAULT '',
  dni VARCHAR(255) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  estado TINYINT(1) NOT NULL DEFAULT 1,
  curso_id INT UNSIGNED DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id_alumno),
  CONSTRAINT fk_alumno_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE alumno_movimientos (
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

CREATE TABLE materias (
  id_materia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id_materia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE asistencias (
  id_asistencia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha DATE NOT NULL,
  estado ENUM('presente','tarde','ausente') NOT NULL DEFAULT 'presente',
  alumno_id INT UNSIGNED DEFAULT NULL,
  materia VARCHAR(255) NOT NULL,
  PRIMARY KEY (id_asistencia),
  CONSTRAINT fk_asist_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  UNIQUE KEY uq_asist (alumno_id, materia, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notas (
  id_nota INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nota DECIMAL(4,2) DEFAULT NULL,
  fecha DATE DEFAULT NULL,
  alumno_id INT UNSIGNED DEFAULT NULL,
  materia VARCHAR(255) NOT NULL,
  PRIMARY KEY (id_nota),
  CONSTRAINT fk_nota_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE profesores (
  id_profesor INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id_profesor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de auditoria (para logging de acciones del sistema)
CREATE TABLE auditoria (
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

-- Dominio Galiservas. Cada recurso representa un inventario reservable en
-- una ubicacion; capacity permite reservar unidades sin modelar cada equipo.
CREATE TABLE resources (
  id_resource INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,
  category ENUM('hardware_pc','audiovisual') NOT NULL,
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

CREATE TABLE reservations (
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
