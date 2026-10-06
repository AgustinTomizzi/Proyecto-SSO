-- 13-sesiones.sql
-- Migracion incremental e idempotente: sesiones PHP en la base para poder
-- correr mas de una replica del backend.

USE ProyectoEstela;
SET NAMES utf8mb4;

-- Sesiones PHP compartidas entre réplicas del backend (SESSION_STORE=db).
CREATE TABLE IF NOT EXISTS sesiones (
  id VARCHAR(128) NOT NULL,
  datos MEDIUMBLOB NOT NULL,
  actualizada INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sesiones_actualizada (actualizada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
