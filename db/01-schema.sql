-- 01-schema.sql
-- Base unica compartida ProyectoEstela (Galisencia + Galiservas despues).
-- Tablas compartidas + dominio Galisencia. Corrige contrasena/contrasena y FKs.
-- Incluye preceptor_id en cursos y tabla auditoria (antes en migracion 03).

CREATE DATABASE IF NOT EXISTS ProyectoEstela CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ProyectoEstela;
SET NAMES utf8mb4;

CREATE TABLE roles (
  id_rol INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuarios (
  id_usuario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  rol_id INT UNSIGNED DEFAULT NULL,
  debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_usuario),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES roles (id_rol) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sistemas (
  id_sistema INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_sistema)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permisos (
  id_permiso INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id_permiso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rol_permiso (
  rol_id INT UNSIGNED NOT NULL,
  permiso_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (rol_id, permiso_id),
  CONSTRAINT fk_rp_rol FOREIGN KEY (rol_id) REFERENCES roles (id_rol) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permiso FOREIGN KEY (permiso_id) REFERENCES permisos (id_permiso) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rol_sistema (
  rol_id INT UNSIGNED NOT NULL,
  sistema_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (rol_id, sistema_id),
  CONSTRAINT fk_rs_rol FOREIGN KEY (rol_id) REFERENCES roles (id_rol) ON DELETE CASCADE,
  CONSTRAINT fk_rs_sistema FOREIGN KEY (sistema_id) REFERENCES sistemas (id_sistema) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dominio Galisencia
CREATE TABLE cursos (
  id_cursos INT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio VARCHAR(20) NOT NULL,
  division VARCHAR(20) NOT NULL,
  turno VARCHAR(20) NOT NULL DEFAULT 'Mañana',
  preceptor VARCHAR(255) DEFAULT NULL,
  preceptor_id INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id_cursos),
  UNIQUE KEY uq_curso_anio_division (anio, division),
  CONSTRAINT fk_curso_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE alumnos (
  id_alumno INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL DEFAULT '',
  dni VARCHAR(255) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  estado TINYINT(1) NOT NULL DEFAULT 1,
  curso_id INT UNSIGNED DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  usuario_id INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id_alumno),
  UNIQUE KEY uq_alumno_usuario (usuario_id),
  CONSTRAINT fk_alumno_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE SET NULL,
  CONSTRAINT fk_alumno_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE horarios_curso (
  id_horario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  tamanio INT UNSIGNED NOT NULL,
  imagen MEDIUMBLOB NOT NULL,
  actualizado_por INT UNSIGNED DEFAULT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_horario),
  UNIQUE KEY uq_horario_curso (curso_id),
  CONSTRAINT fk_horario_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_horario_usuario FOREIGN KEY (actualizado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE alumno_movimientos (
  id_movimiento BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id INT UNSIGNED NOT NULL,
  tipo ENUM('cambio_curso','baja','promocion','repitencia','egreso') NOT NULL,
  curso_origen_id INT UNSIGNED DEFAULT NULL,
  curso_destino_id INT UNSIGNED DEFAULT NULL,
  ciclo_lectivo YEAR NOT NULL,
  realizado_por INT UNSIGNED NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_movimiento),
  KEY idx_movimiento_alumno_ciclo (alumno_id, ciclo_lectivo, fecha),
  CONSTRAINT fk_movimiento_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE RESTRICT,
  CONSTRAINT fk_movimiento_origen FOREIGN KEY (curso_origen_id) REFERENCES cursos (id_cursos) ON DELETE SET NULL,
  CONSTRAINT fk_movimiento_destino FOREIGN KEY (curso_destino_id) REFERENCES cursos (id_cursos) ON DELETE SET NULL,
  CONSTRAINT fk_movimiento_actor FOREIGN KEY (realizado_por) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE materias (
  id_materia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id_materia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Justificacion de inasistencias: cubre un rango de fechas de un alumno; las
-- ausencias del rango pasan a 'justificado'. Adjunto opcional en la base.
CREATE TABLE justificaciones (
  id_justificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alumno_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  adjunto MEDIUMBLOB NULL,
  adjunto_nombre VARCHAR(255) NULL,
  adjunto_tipo VARCHAR(64) NULL,
  creado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_justificacion),
  KEY idx_justif_alumno (alumno_id, desde, hasta),
  CONSTRAINT fk_justif_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_justif_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT chk_justif_rango CHECK (hasta >= desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE asistencias (
  id_asistencia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha DATE NOT NULL,
  estado ENUM('presente','tarde','ausente','justificado') NOT NULL DEFAULT 'presente',
  justificacion_id INT UNSIGNED DEFAULT NULL,
  alumno_id INT UNSIGNED DEFAULT NULL,
  materia_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_asistencia),
  CONSTRAINT fk_asist_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_asist_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT,
  CONSTRAINT fk_asist_justificacion FOREIGN KEY (justificacion_id) REFERENCES justificaciones (id_justificacion) ON DELETE SET NULL,
  UNIQUE KEY uq_asist_materia (alumno_id, materia_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notas (
  id_nota INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nota DECIMAL(4,2) DEFAULT NULL,
  fecha DATE DEFAULT NULL,
  alumno_id INT UNSIGNED DEFAULT NULL,
  materia_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_nota),
  KEY idx_nota_alumno_materia (alumno_id, materia_id),
  CONSTRAINT fk_nota_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_nota_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE profesores (
  id_profesor INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(255) NOT NULL,
  apellido VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id_profesor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de auditoria (para logging de acciones del sistema)
CREATE TABLE auditoria (
  id_auditoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED DEFAULT NULL,
  usuario_nombre VARCHAR(255) DEFAULT NULL,
  rol VARCHAR(100) DEFAULT NULL,
  accion VARCHAR(100) NOT NULL,
  entidad VARCHAR(100) NOT NULL,
  entidad_id VARCHAR(100) DEFAULT NULL,
  detalle JSON DEFAULT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_auditoria),
  KEY idx_auditoria_fecha (fecha),
  KEY idx_auditoria_usuario (usuario_id),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Intentos fallidos de login y reconfirmacion de contrasena (ver 05-seguridad.sql).
CREATE TABLE login_intentos (
  id_intento BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  tipo ENUM('login', 'reauth') NOT NULL DEFAULT 'login',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_intento),
  KEY idx_intentos_email_tipo_fecha (email, tipo, fecha),
  KEY idx_intentos_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dominio Galiservas. Cada recurso representa un inventario reservable en
-- una ubicacion; capacity permite reservar unidades sin modelar cada equipo.
CREATE TABLE resources (
  id_resource INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,
  category ENUM('hardware_pc','audiovisual') NOT NULL,
  location VARCHAR(150) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  available TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_resource),
  UNIQUE KEY uq_resource_name_location (name, location),
  KEY idx_resources_available (active, available),
  CONSTRAINT chk_resource_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reservations (
  id_reservation BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  reason VARCHAR(500) NOT NULL,
  status ENUM('pendiente','confirmada','rechazada','cancelada','completada') NOT NULL DEFAULT 'confirmada',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_reservation),
  KEY idx_reservation_resource_slot (resource_id, reservation_date, start_time, end_time, status),
  KEY idx_reservation_user (user_id, reservation_date),
  CONSTRAINT fk_reservation_user FOREIGN KEY (user_id) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT,
  CONSTRAINT fk_reservation_resource FOREIGN KEY (resource_id) REFERENCES resources (id_resource) ON DELETE RESTRICT,
  CONSTRAINT chk_reservation_quantity CHECK (quantity > 0),
  CONSTRAINT chk_reservation_time CHECK (start_time < end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Grilla de horarios (Fase 1). Mismo formato que los horarios del colegio:
-- 12 modulos de 60 minutos compartidos por todos los cursos (mañana, tarde y
-- vespertino); un curso puede cursar en varios turnos. Reemplaza a
-- horarios_curso (imagen), que queda como historico de solo lectura.
CREATE TABLE franjas_horarias (
  id_franja INT UNSIGNED NOT NULL AUTO_INCREMENT,
  orden TINYINT UNSIGNED NOT NULL,
  turno VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  PRIMARY KEY (id_franja),
  UNIQUE KEY uq_franja_orden (orden),
  CONSTRAINT chk_franja_horario CHECK (hora_inicio < hora_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aulas del colegio por codigo (AT5, TR2, 204, Playón...). Si el aula tambien
-- se reserva en Galiservas, resource_id la vincula con el recurso.
CREATE TABLE aulas (
  id_aula INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) DEFAULT NULL,
  resource_id INT UNSIGNED DEFAULT NULL,
  -- 1 = admite varias clases a la vez (Playón, Campo, Patio).
  compartida TINYINT(1) NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id_aula),
  UNIQUE KEY uq_aula_codigo (codigo),
  UNIQUE KEY uq_aula_resource (resource_id),
  CONSTRAINT fk_aula_resource FOREIGN KEY (resource_id) REFERENCES resources (id_resource) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Una fila por curso, dia, modulo y grupo. grupo 0 = curso completo;
-- 1 y 2 = mitades del curso que cursan en paralelo (celda partida).
CREATE TABLE horario_clases (
  id_clase INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  franja_id INT UNSIGNED NOT NULL,
  grupo TINYINT UNSIGNED NOT NULL DEFAULT 0,
  materia_id INT UNSIGNED NOT NULL,
  docente_id INT UNSIGNED DEFAULT NULL,
  aula_id INT UNSIGNED DEFAULT NULL,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE DEFAULT NULL,
  PRIMARY KEY (id_clase),
  UNIQUE KEY uq_clase_celda (curso_id, dia_semana, franja_id, grupo, vigente_desde),
  KEY idx_clase_docente (docente_id, dia_semana, franja_id),
  KEY idx_clase_aula (aula_id, dia_semana, franja_id),
  CONSTRAINT fk_clase_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_clase_franja FOREIGN KEY (franja_id) REFERENCES franjas_horarias (id_franja) ON DELETE RESTRICT,
  CONSTRAINT fk_clase_materia FOREIGN KEY (materia_id) REFERENCES materias (id_materia) ON DELETE RESTRICT,
  CONSTRAINT fk_clase_docente FOREIGN KEY (docente_id) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_clase_aula FOREIGN KEY (aula_id) REFERENCES aulas (id_aula) ON DELETE SET NULL,
  CONSTRAINT chk_clase_dia CHECK (dia_semana BETWEEN 1 AND 5),
  CONSTRAINT chk_clase_grupo CHECK (grupo IN (0, 1, 2)),
  CONSTRAINT chk_clase_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sesiones PHP compartidas entre réplicas del backend (SESSION_STORE=db).
CREATE TABLE sesiones (
  id VARCHAR(128) NOT NULL,
  datos MEDIUMBLOB NOT NULL,
  actualizada INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sesiones_actualizada (actualizada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Suplencias: un preceptor cubre temporalmente un curso ajeno. El alcance
-- del preceptor incluye el curso solo mientras la suplencia esta vigente.
CREATE TABLE cursos_suplencias (
  id_suplencia INT UNSIGNED NOT NULL AUTO_INCREMENT,
  curso_id INT UNSIGNED NOT NULL,
  preceptor_id INT UNSIGNED NOT NULL,
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  motivo VARCHAR(255) DEFAULT NULL,
  creado_por INT UNSIGNED DEFAULT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_suplencia),
  KEY idx_suplencia_preceptor (preceptor_id, desde, hasta),
  KEY idx_suplencia_curso (curso_id, desde, hasta),
  CONSTRAINT fk_suplencia_curso FOREIGN KEY (curso_id) REFERENCES cursos (id_cursos) ON DELETE CASCADE,
  CONSTRAINT fk_suplencia_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_suplencia_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  CONSTRAINT chk_suplencia_fechas CHECK (hasta >= desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ciclos lectivos: la promocion de alumnos cierra un ciclo y abre el siguiente.
CREATE TABLE ciclos_lectivos (
  id_ciclo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  anio SMALLINT UNSIGNED NOT NULL,
  estado ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
  cerrado_por INT UNSIGNED DEFAULT NULL,
  cerrado_en DATETIME DEFAULT NULL,
  PRIMARY KEY (id_ciclo),
  UNIQUE KEY uq_ciclo_anio (anio),
  CONSTRAINT fk_ciclo_cerrado_por FOREIGN KEY (cerrado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Portal de familias: un tutor (rol Tutor) ve a sus alumnos vinculados.
CREATE TABLE tutor_alumno (
  tutor_id INT UNSIGNED NOT NULL,
  alumno_id INT UNSIGNED NOT NULL,
  parentesco VARCHAR(40) NULL,
  creado_por INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tutor_id, alumno_id),
  KEY idx_tutor_alumno_alumno (alumno_id),
  CONSTRAINT fk_tutor_alumno_tutor FOREIGN KEY (tutor_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_alumno_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_alumno_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notificaciones por email: cola (notificaciones) y tipos apagados por usuario.
CREATE TABLE notificaciones (
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

CREATE TABLE notificacion_preferencias (
  usuario_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  habilitada TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, tipo),
  CONSTRAINT fk_notif_pref_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Configuracion institucional (clave/valor). Claves, tipos y valores por
-- defecto: includes/config.php. Solo se guardan los valores modificados.
CREATE TABLE config_institucion (
  clave VARCHAR(64) NOT NULL,
  valor VARCHAR(255) NOT NULL,
  actualizado_por INT UNSIGNED DEFAULT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave),
  CONSTRAINT fk_config_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
