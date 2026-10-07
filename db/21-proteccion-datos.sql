-- 21-proteccion-datos.sql
-- Migracion incremental e idempotente: medidas tecnicas de proteccion de datos
-- (Ley 25.326). Registro de aceptacion de la politica de privacidad por version
-- y permiso para exportar los datos personales de un alumno (derecho de acceso).

USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS consentimientos (
  usuario_id INT UNSIGNED NOT NULL,
  version VARCHAR(20) NOT NULL,
  aceptado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, version),
  CONSTRAINT fk_consentimiento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permisos (nombre, descripcion) VALUES
  ('datos.exportar', 'Exportar los datos personales de un alumno (derecho de acceso)');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id_rol, p.id_permiso
FROM roles r
JOIN permisos p ON p.nombre = 'datos.exportar'
WHERE r.nombre IN ('Administrador Academico', 'Administrador');
