-- 04-migracion-galiservas.sql
-- Migración incremental para el dominio Galiservas (reservas).
-- NO borra tablas ni datos existentes. Se puede correr sobre una base con 01+02+03.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1) Tablas del dominio Galiservas
-- ---------------------------------------------------------------------

-- Categorías de recursos (ej: Hardware de PC, Recursos audiovisuales)
CREATE TABLE IF NOT EXISTS categorias_recursos (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  PRIMARY KEY (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recursos reservables: aulas (con stock de computadoras) y elementos del pañol.
CREATE TABLE IF NOT EXISTS recursos (
  id_recurso INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  tipo ENUM('aula','pañol') NOT NULL DEFAULT 'pañol',
  categoria_id INT UNSIGNED DEFAULT NULL,
  stock_total INT UNSIGNED NOT NULL DEFAULT 1,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_recurso),
  KEY idx_recurso_tipo (tipo),
  CONSTRAINT fk_recurso_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_recursos (id_categoria) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reservas (un recurso + franja horaria + cantidad). El stock disponible se
-- calcula: stock_total - SUM(cantidad) de reservas solapadas.
CREATE TABLE IF NOT EXISTS reservas (
  id_reserva INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED DEFAULT NULL,
  recurso_id INT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  horario VARCHAR(40) NOT NULL,
  cantidad INT UNSIGNED NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_reserva),
  KEY idx_reserva_recurso_fecha (recurso_id, fecha),
  KEY idx_reserva_usuario (usuario_id),
  CONSTRAINT fk_reserva_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_reserva_recurso FOREIGN KEY (recurso_id) REFERENCES recursos (id_recurso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2) Nuevos permisos de Galiservas
-- ---------------------------------------------------------------------
INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('reservas.ver', 'Ver recursos y disponibilidad de reservas'),
  ('reservas.crear', 'Crear reservas de aulas y recursos');

-- ---------------------------------------------------------------------
-- 3) Sistema Galiservas + roles con acceso (Preceptor, Docente, Admin)
--    Quedan FUERA: Alumno y Directivo (sin acceso bajo ninguna circunstancia).
-- ---------------------------------------------------------------------
INSERT IGNORE INTO sistemas (nombre, descripcion) VALUES
  ('Galiservas', 'Sistema de reservas de aulas, computadoras y recursos');

INSERT IGNORE INTO rol_sistema (rol_id, sistema_id)
SELECT r.id_rol, s.id_sistema
FROM roles r CROSS JOIN sistemas s
WHERE s.nombre = 'Galiservas'
  AND r.nombre IN ('Preceptor', 'Docente', 'Administrador Academico', 'Administrador');

-- ---------------------------------------------------------------------
-- 4) Permisos de reservas por rol
-- ---------------------------------------------------------------------
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.nombre IN ('Preceptor', 'Docente', 'Administrador Academico', 'Administrador')
  AND p.nombre IN ('reservas.ver', 'reservas.crear');

-- El rol "Administrador" debe conservar TODOS los permisos nuevos.
INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'Administrador';

-- ---------------------------------------------------------------------
-- 5) Categorías y recursos semilla
-- ---------------------------------------------------------------------
INSERT IGNORE INTO categorias_recursos (nombre) VALUES
  ('Hardware de PC'),
  ('Recursos audiovisuales');

-- Aulas con computadoras (tipo 'aula', stock = nº de computadoras)
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total) VALUES
  ('Aula 208', 'aula', NULL, 30),
  ('Aula 209', 'aula', NULL, 28),
  ('Aula 210', 'aula', NULL, 25);

-- Pañol — Hardware de PC
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Notebooks', 'pañol', c.id_categoria, 12 FROM categorias_recursos c WHERE c.nombre = 'Hardware de PC';
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Teclados', 'pañol', c.id_categoria, 20 FROM categorias_recursos c WHERE c.nombre = 'Hardware de PC';
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Mouse', 'pañol', c.id_categoria, 20 FROM categorias_recursos c WHERE c.nombre = 'Hardware de PC';
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'CPUs', 'pañol', c.id_categoria, 10 FROM categorias_recursos c WHERE c.nombre = 'Hardware de PC';

-- Pañol — Recursos audiovisuales
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Proyectores', 'pañol', c.id_categoria, 4 FROM categorias_recursos c WHERE c.nombre = 'Recursos audiovisuales';
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Cámaras', 'pañol', c.id_categoria, 3 FROM categorias_recursos c WHERE c.nombre = 'Recursos audiovisuales';
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Micrófonos', 'pañol', c.id_categoria, 6 FROM categorias_recursos c WHERE c.nombre = 'Recursos audiovisuales';
INSERT IGNORE INTO recursos (nombre, tipo, categoria_id, stock_total)
SELECT 'Parlantes', 'pañol', c.id_categoria, 6 FROM categorias_recursos c WHERE c.nombre = 'Recursos audiovisuales';