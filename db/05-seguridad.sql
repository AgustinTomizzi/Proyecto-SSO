-- 05-seguridad.sql
-- Migracion incremental e idempotente: limite de intentos de autenticacion.

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
