CREATE TABLE IF NOT EXISTS `usuarios` (
	`id_usuario` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255) NOT NULL,
	`apellido` VARCHAR(255) NOT NULL,
	`email` VARCHAR(255) NOT NULL UNIQUE,
	`contraseña` VARCHAR(255) NOT NULL,
	`rol_id` INTEGER,
	PRIMARY KEY(`id_usuario`)
);


CREATE TABLE IF NOT EXISTS `historial_auditoria` (
	`id_historial` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`usuario_id` INTEGER NOT NULL,
	`accion` VARCHAR(255) NOT NULL,
	`fecha_y_hora` DATETIME NOT NULL,
	PRIMARY KEY(`id_historial`)
);


CREATE TABLE IF NOT EXISTS `recursos` (
	`id_recurso` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre_lab` VARCHAR(255) NOT NULL,
	`tipo_recurso` VARCHAR(255) NOT NULL,
	`estado` BOOLEAN NOT NULL,
	PRIMARY KEY(`id_recurso`)
);


CREATE TABLE IF NOT EXISTS `reservas` (
	`id_reservas` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`usuario_id` INTEGER,
	`recurso_id` INTEGER,
	`fecha` DATE NOT NULL,
	`horario` DATETIME NOT NULL,
	PRIMARY KEY(`id_reservas`)
);


CREATE TABLE IF NOT EXISTS `roles` (
	`id_rol` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255),
	PRIMARY KEY(`id_rol`)
);


CREATE TABLE IF NOT EXISTS `rol_sistema` (
	`rol_id` INTEGER NOT NULL,
	`sistema_id` INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS `rol_permiso` (
	`rol_id` INTEGER NOT NULL,
	`permiso_id` INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS `permisos` (
	`id_permiso` INTEGER NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(100) NOT NULL UNIQUE,
	`descripcion` VARCHAR(255),
	PRIMARY KEY(`id_permiso`)
);


CREATE TABLE IF NOT EXISTS `sistemas` (
	`id_sistema` INTEGER NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(50) NOT NULL UNIQUE,
	`descripcion` VARCHAR(255),
	`activo` BOOLEAN NOT NULL DEFAULT true,
	PRIMARY KEY(`id_sistema`)
);


ALTER TABLE `usuarios`
ADD FOREIGN KEY(`id_usuario`) REFERENCES `historial_auditoria`(`usuario_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `recursos`
ADD FOREIGN KEY(`id_recurso`) REFERENCES `reservas`(`recurso_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `reservas`
ADD FOREIGN KEY(`usuario_id`) REFERENCES `usuarios`(`id_usuario`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `roles`
ADD FOREIGN KEY(`id_rol`) REFERENCES `usuarios`(`rol_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `sistemas`
ADD FOREIGN KEY(`id_sistema`) REFERENCES `rol_sistema`(`sistema_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `roles`
ADD FOREIGN KEY(`id_rol`) REFERENCES `rol_sistema`(`rol_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `roles`
ADD FOREIGN KEY(`id_rol`) REFERENCES `rol_permiso`(`rol_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `permisos`
ADD FOREIGN KEY(`id_permiso`) REFERENCES `rol_permiso`(`permiso_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;