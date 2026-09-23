-- Ejecutar una sola vez en instalaciones existentes. En una base nueva Docker lo aplica automáticamente.
CREATE TABLE IF NOT EXISTS reservation_deliveries (
  reservation_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  requested_quantity INT UNSIGNED NOT NULL,
  delivered_quantity INT UNSIGNED NOT NULL,
  shortage_reason VARCHAR(500) DEFAULT NULL,
  observation VARCHAR(1000) DEFAULT NULL,
  recorded_by INT UNSIGNED NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_delivery_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id_reservation) ON DELETE RESTRICT,
  CONSTRAINT fk_delivery_user FOREIGN KEY (recorded_by) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  CONSTRAINT chk_delivery_quantities CHECK (requested_quantity > 0 AND delivered_quantity <= requested_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_incidents (
  id_incident BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  resource_id INT UNSIGNED NOT NULL,
  reservation_id BIGINT UNSIGNED DEFAULT NULL,
  equipment_identifier VARCHAR(100) DEFAULT NULL,
  description VARCHAR(1000) NOT NULL,
  status ENUM('abierto','resuelto') NOT NULL DEFAULT 'abierto',
  resolution VARCHAR(1000) DEFAULT NULL,
  reported_by INT UNSIGNED NOT NULL,
  reported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_by INT UNSIGNED DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL,
  KEY idx_incident_resource_status (resource_id, status),
  KEY idx_incident_reported (reported_at),
  CONSTRAINT fk_incident_resource FOREIGN KEY (resource_id) REFERENCES resources(id_resource) ON DELETE RESTRICT,
  CONSTRAINT fk_incident_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id_reservation) ON DELETE RESTRICT,
  CONSTRAINT fk_incident_author FOREIGN KEY (reported_by) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  CONSTRAINT fk_incident_resolver FOREIGN KEY (resolved_by) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
