CREATE TABLE IF NOT EXISTS `roles` (
	`id_rol` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255),
	PRIMARY KEY(`id_rol`)
);


CREATE TABLE IF NOT EXISTS `usuarios` (
	`id_usuario` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255),
	`apellido` VARCHAR(255),
	`email` VARCHAR(255),
	`contraseña` VARCHAR(255),
	`rol_id` INTEGER,
	PRIMARY KEY(`id_usuario`)
);


CREATE TABLE IF NOT EXISTS `cursos` (
	`id_cursos` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` INTEGER,
	`modalidad` INTEGER,
	PRIMARY KEY(`id_cursos`)
);


CREATE TABLE IF NOT EXISTS `alumnos` (
	`id_alumno` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255) NOT NULL,
	`apellido` VARCHAR(255) NOT NULL,
	`dni` VARCHAR(255) UNIQUE,
	`direccion` VARCHAR(255),
	`estado` BOOLEAN,
	`curso_id` INTEGER,
	PRIMARY KEY(`id_alumno`)
);


CREATE TABLE IF NOT EXISTS `materias` (
	`id_materia` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255),
	PRIMARY KEY(`id_materia`)
);


CREATE TABLE IF NOT EXISTS `asistencias` (
	`id_asistencia` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`fecha` DATETIME,
	`presente` BOOLEAN,
	`alumno_id` INTEGER,
	`materia_id` INTEGER,
	PRIMARY KEY(`id_asistencia`)
);


CREATE TABLE IF NOT EXISTS `notas` (
	`id_nota` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nota` DECIMAL,
	`fecha` DATE,
	`alumno_id` INTEGER,
	`materia_id` INTEGER,
	PRIMARY KEY(`id_nota`)
);


CREATE TABLE IF NOT EXISTS `profesores` (
	`id_profesor` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(255),
	`apellido` VARCHAR(255),
	PRIMARY KEY(`id_profesor`)
);


CREATE TABLE IF NOT EXISTS `profesor_materia_curso` (
	`id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	`profesor_id` INTEGER,
	`materia_id` INTEGER,
	`curso_id` INTEGER,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `sistemas` (
	`id_sistema` INTEGER NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(50) NOT NULL UNIQUE,
	`descripcion` VARCHAR(255),
	`activo` BOOLEAN NOT NULL DEFAULT true,
	PRIMARY KEY(`id_sistema`)
);


CREATE TABLE IF NOT EXISTS `permisos` (
	`id_permiso` INTEGER NOT NULL AUTO_INCREMENT,
	`nombre` VARCHAR(100) NOT NULL UNIQUE,
	`descripcion` VARCHAR(255),
	PRIMARY KEY(`id_permiso`)
);


CREATE TABLE IF NOT EXISTS `rol_permiso` (
	`rol_id` INTEGER NOT NULL,
	`permiso_id` INTEGER NOT NULL
);


CREATE INDEX ``
ON `rol_permiso` (`rol_id`, `permiso_id`);
CREATE TABLE IF NOT EXISTS `rol_sistema` (
	`rol_id` INTEGER NOT NULL,
	`sistema_id` INTEGER NOT NULL
);


CREATE INDEX ``
ON `rol_sistema` (`rol_id`, `sistema_id`);
ALTER TABLE `roles`
ADD FOREIGN KEY(`id_rol`) REFERENCES `usuarios`(`rol_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `cursos`
ADD FOREIGN KEY(`id_cursos`) REFERENCES `alumnos`(`curso_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `materias`
ADD FOREIGN KEY(`id_materia`) REFERENCES `asistencias`(`materia_id`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `asistencias`
ADD FOREIGN KEY(`alumno_id`) REFERENCES `alumnos`(`id_alumno`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `notas`
ADD FOREIGN KEY(`alumno_id`) REFERENCES `alumnos`(`id_alumno`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `notas`
ADD FOREIGN KEY(`materia_id`) REFERENCES `materias`(`id_materia`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `profesor_materia_curso`
ADD FOREIGN KEY(`profesor_id`) REFERENCES `profesores`(`id_profesor`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `profesor_materia_curso`
ADD FOREIGN KEY(`materia_id`) REFERENCES `materias`(`id_materia`)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE `profesor_materia_curso`
ADD FOREIGN KEY(`curso_id`) REFERENCES `cursos`(`id_cursos`)
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