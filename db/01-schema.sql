-- 01-schema.sql
-- Base unica compartida ProyectoEstela (Galisencia + Galiservas despues).
-- Tablas compartidas + dominio Galisencia. Corrige contrasena/contrasena y FKs.

CREATE DATABASE IF NOT EXISTS ProyectoEstela CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ProyectoEstela;

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
  PRIMARY KEY (id_cursos)
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
