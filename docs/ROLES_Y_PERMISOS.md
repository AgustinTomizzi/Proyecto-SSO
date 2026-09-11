# Roles y permisos

## Principio de seguridad

La matriz efectiva sale de `db/02-seed.sql`. La interfaz puede ocultar pantallas, pero la autorización real ocurre en PHP mediante sesión y `tienePermiso`. El rol seleccionado, una ruta React, `localStorage` o un botón oculto nunca autorizan una operación.

Los seis roles están asociados a **Galisencia**. Galiservas está asociado exclusivamente a Preceptor, Docente y Administrador, y la API exige además `galiservas.acceder`.

## Matriz exacta del seed canónico

| Permiso | Alumno | Preceptor | Directivo | Admin. Académico | Docente | Administrador |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `alumnos.ver` | No | Sí | Sí | Sí | Sí | Sí |
| `alumnos.crear` | No | Sí | No | Sí | No | Sí |
| `alumnos.editar` | No | Sí | No | Sí | No | Sí |
| `alumnos.dar_baja` | No | Sí | No | Sí | No | Sí |
| `cursos.ver` | No | Sí | Sí | Sí | Sí | Sí |
| `cursos.crear` | No | No | No | Sí | No | Sí |
| `cursos.asignar` | No | No | No | Sí | No | Sí |
| `asistencia.ver` | Sí | Sí | Sí | Sí | Sí | Sí |
| `asistencia.registrar` | No | Sí | No | Sí | Sí | Sí |
| `asistencia.editar` | No | Sí | No | Sí | Sí | Sí |
| `notas.ver` | Sí | Sí | Sí | Sí | Sí | Sí |
| `notas.crear` | No | No | No | Sí | Sí | Sí |
| `reportes.ver` | No | Sí | Sí | Sí | No | Sí |
| `usuarios.ver` | No | No | No | No | No | Sí |
| `usuarios.crear` | No | No | No | No | No | Sí |
| `usuarios.editar_rol` | No | No | No | No | No | Sí |
| `auditoria.ver` | No | No | No | No | No | Sí |
| `recursos.ver` | No | Sí | No | No | Sí | Sí |
| `recursos.crear` | No | No | No | No | No | Sí |
| `recursos.editar` | No | No | No | No | No | Sí |
| `recursos.desactivar` | No | No | No | No | No | Sí |
| `reservas.ver` | No | Sí | No | No | Sí | Sí |
| `reservas.crear` | No | Sí | No | No | Sí | Sí |
| `reservas.editar` | No | Sí | No | No | Sí | Sí |
| `reservas.cancelar` | No | Sí | No | No | Sí | Sí |
| `reservas.administrar` | No | No | No | No | No | Sí |
| `galiservas.acceder` | No | Sí | No | No | Sí | Sí |

`Administrador` recibe todos los permisos con un `CROSS JOIN`, de modo que también recibirá futuros permisos al regenerar un seed adaptado. La migración eleva `admin@galileo.edu.ar` a este rol.

## Capacidades y prohibiciones

### Alumno

Puede consultar únicamente su propia asistencia y sus notas.

No puede acceder a Galiservas, gestionar alumnos/cursos, tomar asistencia, cargar notas, ver reportes institucionales, administrar recursos, usuarios o auditoría.

### Preceptor

Puede gestionar alumnos de cursos asignados, ver historial, tomar/corregir asistencia, consultar riesgo de sus cursos y operar reservas propias confirmadas automáticamente. Baja y cambio de curso exigen reingresar su contraseña.

No puede crear/asignar cursos, cargar notas, ver reportes ajenos, administrar reservas ajenas, recursos, usuarios o auditoría. Alumnos, asistencia, notas, reportes e historial aplican alcance por `preceptor_id`.

### Directivo

Puede leer información académica y reportes institucionales.

No puede acceder a Galiservas ni modificar alumnos/cursos/asistencias/notas, administrar recursos, usuarios o auditoría.

### Administrador Académico

Puede gestionar alumnos, cursos/asignaciones, asistencia, notas y reportes académicos.

No puede acceder a Galiservas ni gestionar recursos, usuarios/roles o auditoría.

### Docente

Puede ver alumnos/cursos/asistencia/notas, tomar asistencia, cargar notas y operar reservas propias.

No puede modificar alumnos/cursos, ver reportes globales, administrar reservas ajenas/recursos/usuarios/auditoría. El login Galisencia lo normaliza visualmente a `preceptor`; Galiservas conserva el rol textual de `sesion.php`.

### Administrador

Puede todas las capacidades del catálogo: administración académica, recursos, reservas, usuarios/roles y auditoría. Es el único que puede crear/editar/desactivar recursos porque `recursos.php` verifica permiso **y** rol exacto.

No puede violar validaciones: capacidad, solapamientos, FKs y protección del último Administrador siguen vigentes.

## Alcance backend obligatorio

| Recurso | Usuario común | Administrador funcional |
|---|---|---|
| Alumnos de preceptor | Solo cursos con `preceptor_id` propio | Según permiso. |
| Cursos de preceptor | Solo asignados | Todos según permiso. |
| Asistencia/notas | Alumno propio o cursos asignados | Según permiso. |
| Reservas | Solo `user_id` propio | Todas con `reservas.administrar`. |
| Edición de reserva | Propia y activa | Cualquiera; puede finalizar/cancelar. |
| Cancelación | Propia pendiente/confirmada | Cualquiera. |
| Recursos inactivos | No visibles | Administrador con `incluirInactivos`. |

## Orden obligatorio en cada endpoint

1. Recuperar sesión y responder `401` si falta.
2. Consultar permiso y responder `403` si falta.
3. Aplicar alcance propio, cursos asignados o institucional.
4. Validar campos, estado y relaciones.
5. Usar transacción/bloqueo cuando haya concurrencia, como reservas.
6. Registrar auditoría sin datos sensibles.
7. Responder HTTP/JSON consistentes.

Un usuario autenticado no es automáticamente un usuario autorizado.
