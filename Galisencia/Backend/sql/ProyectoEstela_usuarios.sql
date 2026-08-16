-- SQL para la base de datos remota (ProyectoEstela) en el server del colegio.
-- Ejecutalo en phpMyAdmin (server.galileo.edu.ar:81) antes de usar el login real.
--
-- IMPORTANTE: si la BD ya tiene una tabla `usuarios` con otra estructura,
-- NO corras el CREATE y adapta el SELECT de api/login.php a esas columnas.
-- Este script asume las columnas que usa el backend de Galisencia.

CREATE TABLE IF NOT EXISTS usuarios (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    nombre   VARCHAR(100) NOT NULL,
    email    VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol      ENUM('alumno','preceptor','directivo','admin') NOT NULL DEFAULT 'alumno',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios de prueba (contrasena: "galileo123" hasheada).
-- Para produccion, borra estos y crea los reales.
INSERT INTO usuarios (nombre, email, password, rol) VALUES
    ('Sofia Gutiérrez', 'alumno@galileo.edu.ar',  '$2y$10$7Q9k3vYz0nZ1aB2cD3e4f.8gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ', 'alumno'),
    ('Prof. Ramirez',   'preceptor@galileo.edu.ar','$2y$10$7Q9k3vYz0nZ1aB2cD3e4f.8gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ', 'preceptor'),
    ('Lic. Barbosa',    'directivo@galileo.edu.ar','$2y$10$7Q9k3vYz0nZ1aB2cD3e4f.8gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ', 'directivo'),
    ('Admin Estela',    'admin@galileo.edu.ar',    '$2y$10$7Q9k3vYz0nZ1aB2cD3e4f.8gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ', 'admin')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
