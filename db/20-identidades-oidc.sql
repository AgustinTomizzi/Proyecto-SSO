-- 20-identidades-oidc.sql
-- Migracion incremental e idempotente: ingreso institucional por OIDC (Google
-- Workspace, Microsoft Entra ID). Vincula una cuenta existente con su identidad
-- en el proveedor (proveedor, sub). No hay autoregistro: solo entra quien ya
-- existe en usuarios.

USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuario_identidades (
  proveedor VARCHAR(30) NOT NULL,
  sub VARCHAR(255) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NULL,
  vinculada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_ingreso DATETIME NULL,
  PRIMARY KEY (proveedor, sub),
  UNIQUE KEY uq_identidad_usuario (usuario_id, proveedor),
  CONSTRAINT fk_identidad_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
