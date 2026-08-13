-- Ejecuta esto en phpMyAdmin (o desde la consola de MySQL) antes de correr la app.

CREATE DATABASE IF NOT EXISTS login_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE login_app;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
