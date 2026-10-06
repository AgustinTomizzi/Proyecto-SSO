-- 18-notificaciones.sql
-- Migracion incremental e idempotente: notificaciones por email.
-- notificaciones es la cola: el backend encola (reserva creada, modificada,
-- cancelada y recordatorio) y el worker cli/enviar_notificaciones.php envia por
-- SMTP. notificacion_preferencias guarda solo los tipos que el usuario apago.

USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  destinatario VARCHAR(255) NOT NULL,
  asunto VARCHAR(200) NOT NULL,
  cuerpo TEXT NOT NULL,
  -- Evita duplicados (por ejemplo, un solo recordatorio pendiente por reserva).
  referencia VARCHAR(80) NULL,
  estado ENUM('pendiente','enviada','error','cancelada') NOT NULL DEFAULT 'pendiente',
  intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ultimo_error VARCHAR(255) NULL,
  programada_para DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviada_en DATETIME NULL,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_notificacion),
  UNIQUE KEY uq_notif_referencia (referencia),
  KEY idx_notif_cola (estado, programada_para),
  KEY idx_notif_usuario (usuario_id, creada_en),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notificacion_preferencias (
  usuario_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  habilitada TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, tipo),
  CONSTRAINT fk_notif_pref_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
