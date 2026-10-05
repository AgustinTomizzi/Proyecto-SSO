-- 05-seguridad.sql
-- Migracion incremental e idempotente: limite de intentos de autenticacion
-- y cambio obligatorio de contrasena.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Intentos fallidos de login y de reconfirmacion de contrasena (tipo).
-- El bloqueo se decide por email: detras del proxy todos los clientes
-- comparten IP, asi que la IP se guarda solo como dato de diagnostico.
CREATE TABLE IF NOT EXISTS login_intentos (
  id_intento BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  tipo ENUM('login', 'reauth') NOT NULL DEFAULT 'login',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_intento),
  KEY idx_intentos_email_tipo_fecha (email, tipo, fecha),
  KEY idx_intentos_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cuentas que deben elegir una contrasena propia antes de operar
-- (por ejemplo, las cuentas demo con demo1234).
SET @existe_columna := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'debe_cambiar_password'
);
SET @sql := IF(@existe_columna = 0,
  'ALTER TABLE usuarios ADD COLUMN debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 0 AFTER rol_id',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Solo al crear la columna: marcar las cuentas demo de instalaciones anteriores.
UPDATE usuarios SET debe_cambiar_password = 1
WHERE @existe_columna = 0 AND email IN (
  'admin@galileo.edu.ar', 'academica@galileo.edu.ar', 'preceptor@galileo.edu.ar',
  'preceptora.lagos@galileo.edu.ar', 'directivo@galileo.edu.ar', 'docente@galileo.edu.ar',
  'alumno@galileo.edu.ar', 'mateo.usuario@galileo.edu.ar'
);
