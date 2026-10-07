-- Producción: deja inutilizables las cuentas que siguen con la contraseña
-- inicial (debe_cambiar_password = 1), para que nadie entre desde internet con
-- la contraseña demo conocida. El Administrador las rehabilita desde
-- Usuarios > Restablecer (contraseña temporal). deploy/desplegar.sh le da
-- antes una contraseña temporal propia al primer Administrador. Idempotente.
USE ProyectoEstela;
UPDATE usuarios
SET contrasena = CONCAT('!bloqueada-', SHA2(CONCAT(RAND(), id_usuario, NOW(6)), 256))
WHERE debe_cambiar_password = 1 AND contrasena LIKE '$2y$%';
SELECT ROW_COUNT() AS cuentas_bloqueadas;
