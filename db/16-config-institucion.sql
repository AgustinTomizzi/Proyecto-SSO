-- 16-config-institucion.sql
-- Migracion incremental e idempotente: configuracion institucional (clave/valor).
-- Las claves validas, sus tipos y sus valores por defecto viven en
-- Galisencia/Galileo_Auth/includes/config.php; la tabla guarda solo los valores
-- que la administracion cambio.

USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS config_institucion (
  clave VARCHAR(64) NOT NULL,
  valor VARCHAR(255) NOT NULL,
  actualizado_por INT UNSIGNED DEFAULT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  CONSTRAINT fk_config_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('config.gestionar', 'Modificar la configuracion institucional');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'config.gestionar'
WHERE r.nombre = 'Administrador';
