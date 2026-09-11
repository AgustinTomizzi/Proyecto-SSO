USE ProyectoEstela;

-- =====================================================
-- CORREGIR CONTRASEÑA
-- =====================================================

ALTER TABLE usuarios
MODIFY contrasena VARCHAR(255) NOT NULL;


-- =====================================================
-- SISTEMAS
-- =====================================================

CREATE TABLE IF NOT EXISTS sistemas (
    id_sistema INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,

    PRIMARY KEY (id_sistema),
    UNIQUE KEY uk_sistemas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


INSERT IGNORE INTO sistemas
(nombre, descripcion)
VALUES
('Galisencia', 'Sistema de gestión de asistencia'),
('Galiservas', 'Sistema de gestión de reservas');


-- =====================================================
-- PERMISOS
-- =====================================================

CREATE TABLE IF NOT EXISTS permisos (
    id_permiso INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) DEFAULT NULL,

    PRIMARY KEY (id_permiso),
    UNIQUE KEY uk_permisos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


INSERT IGNORE INTO permisos
(nombre, descripcion)
VALUES

-- GALISENCIA

('asistencia.ver',
 'Ver asistencias'),

('asistencia.registrar',
 'Registrar asistencias'),

('asistencia.editar',
 'Editar asistencias'),

('alumnos.ver',
 'Ver alumnos'),

('alumnos.crear',
 'Crear alumnos'),

('alumnos.editar',
 'Editar alumnos'),

('alumnos.promover',
 'Promover alumnos'),

('alumnos.cambiar_curso',
 'Cambiar alumnos de curso'),

('alumnos.dar_baja',
 'Dar de baja alumnos'),

('cursos.ver',
 'Ver cursos'),

('cursos.gestionar',
 'Gestionar cursos'),

('materias.ver',
 'Ver materias'),

('materias.gestionar',
 'Gestionar materias'),

('notas.ver',
 'Ver notas'),

('notas.crear',
 'Crear notas'),

('notas.editar',
 'Editar notas'),

('profesores.ver',
 'Ver profesores'),

('profesores.gestionar',
 'Gestionar profesores'),

('reportes.ver',
 'Ver reportes'),

('estadisticas.ver',
 'Ver estadísticas'),


-- GALISERVAS

('reservas.ver',
 'Ver reservas'),

('reservas.crear',
 'Crear reservas'),

('reservas.editar',
 'Editar reservas'),

('reservas.cancelar',
 'Cancelar reservas'),

('recursos.ver',
 'Ver recursos'),

('recursos.crear',
 'Crear recursos'),

('recursos.editar',
 'Editar recursos'),

('recursos.eliminar',
 'Eliminar recursos'),

('calendario.ver',
 'Ver calendario');


-- =====================================================
-- RELACIÓN ROL - PERMISO
-- =====================================================

CREATE TABLE IF NOT EXISTS rol_permiso (
    rol_id INT UNSIGNED NOT NULL,
    permiso_id INT UNSIGNED NOT NULL,

    PRIMARY KEY (rol_id, permiso_id),

    CONSTRAINT fk_rol_permiso_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id_rol)
        ON DELETE CASCADE,

    CONSTRAINT fk_rol_permiso_permiso
        FOREIGN KEY (permiso_id)
        REFERENCES permisos(id_permiso)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================
-- RELACIÓN ROL - SISTEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS rol_sistema (
    rol_id INT UNSIGNED NOT NULL,
    sistema_id INT UNSIGNED NOT NULL,

    PRIMARY KEY (rol_id, sistema_id),

    CONSTRAINT fk_rol_sistema_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id_rol)
        ON DELETE CASCADE,

    CONSTRAINT fk_rol_sistema_sistema
        FOREIGN KEY (sistema_id)
        REFERENCES sistemas(id_sistema)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================
-- ROLES
-- =====================================================

INSERT IGNORE INTO roles (nombre)
VALUES
('Alumno'),
('Preceptor'),
('Directivo'),
('Administrador Académico'),
('Docente'),
('Administrador');


-- =====================================================
-- RELACIÓN ROLES - GALISENCIA
-- =====================================================

INSERT IGNORE INTO rol_sistema (rol_id, sistema_id)

SELECT r.id_rol, s.id_sistema
FROM roles r
CROSS JOIN sistemas s
WHERE s.nombre = 'Galisencia'
AND r.nombre IN (
    'Alumno',
    'Preceptor',
    'Directivo',
    'Administrador Académico'
);


-- =====================================================
-- RELACIÓN ROLES - GALISERVAS
-- =====================================================

INSERT IGNORE INTO rol_sistema (rol_id, sistema_id)

SELECT r.id_rol, s.id_sistema
FROM roles r
CROSS JOIN sistemas s
WHERE s.nombre = 'Galiservas'
AND r.nombre IN (
    'Docente',
    'Directivo',
    'Administrador'
);


-- =====================================================
-- PERMISOS DEL ALUMNO
-- =====================================================

INSERT IGNORE INTO rol_permiso

SELECT
    r.id_rol,
    p.id_permiso

FROM roles r
CROSS JOIN permisos p

WHERE r.nombre = 'Alumno'

AND p.nombre IN (
    'asistencia.ver',
    'notas.ver'
);


-- =====================================================
-- PERMISOS DEL PRECEPTOR
-- =====================================================

INSERT IGNORE INTO rol_permiso

SELECT
    r.id_rol,
    p.id_permiso

FROM roles r
CROSS JOIN permisos p

WHERE r.nombre = 'Preceptor'

AND p.nombre IN (
    'asistencia.ver',
    'asistencia.registrar',
    'asistencia.editar',
    'alumnos.ver',
    'cursos.ver'
);


-- =====================================================
-- PERMISOS DEL DIRECTIVO
-- =====================================================

INSERT IGNORE INTO rol_permiso

SELECT
    r.id_rol,
    p.id_permiso

FROM roles r
CROSS JOIN permisos p

WHERE r.nombre = 'Directivo'

AND p.nombre IN (
    'asistencia.ver',
    'alumnos.ver',
    'cursos.ver',
    'materias.ver',
    'notas.ver',
    'profesores.ver',
    'reportes.ver',
    'estadisticas.ver',
    'reservas.ver',
    'calendario.ver'
);


-- =====================================================
-- PERMISOS DEL ADMINISTRADOR ACADÉMICO
-- =====================================================

INSERT IGNORE INTO rol_permiso

SELECT
    r.id_rol,
    p.id_permiso

FROM roles r
CROSS JOIN permisos p

WHERE r.nombre = 'Administrador Académico'

AND p.nombre IN (
    'asistencia.ver',
    'asistencia.registrar',
    'asistencia.editar',

    'alumnos.ver',
    'alumnos.crear',
    'alumnos.editar',
    'alumnos.promover',
    'alumnos.cambiar_curso',
    'alumnos.dar_baja',

    'cursos.ver',
    'cursos.gestionar',

    'materias.ver',
    'materias.gestionar',

    'notas.ver',
    'notas.crear',
    'notas.editar',

    'profesores.ver',
    'profesores.gestionar',

    'reportes.ver',
    'estadisticas.ver'
);


-- =====================================================
-- PERMISOS DEL DOCENTE
-- =====================================================

INSERT IGNORE INTO rol_permiso

SELECT
    r.id_rol,
    p.id_permiso

FROM roles r
CROSS JOIN permisos p

WHERE r.nombre = 'Docente'

AND p.nombre IN (
    'reservas.ver',
    'reservas.crear',
    'reservas.editar',
    'reservas.cancelar',
    'calendario.ver'
);


-- =====================================================
-- PERMISOS DEL ADMINISTRADOR
-- =====================================================

INSERT IGNORE INTO rol_permiso

SELECT
    r.id_rol,
    p.id_permiso

FROM roles r
CROSS JOIN permisos p

WHERE r.nombre = 'Administrador'

AND p.nombre IN (
    'reservas.ver',
    'reservas.crear',
    'reservas.editar',
    'reservas.cancelar',

    'recursos.ver',
    'recursos.crear',
    'recursos.editar',
    'recursos.eliminar',

    'calendario.ver'
);