# Roles y permisos

## Principio de seguridad

La matriz efectiva sale de `db/02-seed.sql`. La interfaz puede ocultar pantallas, pero la autorización real ocurre en PHP mediante sesión y `tienePermiso`. Una ruta React, `localStorage` o un botón oculto nunca autorizan una operación; el rol se relee de la base en cada request.

Los seis roles están asociados a **Galisencia**. Galiservas está asociado exclusivamente a Preceptor, Docente y Administrador. La API de Galiservas exige que el rol tenga el sistema habilitado en `rol_sistema`; la UI pide además el permiso `galiservas.acceder`.

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
| `horarios.ver` | Sí | Sí | Sí | Sí | Sí | Sí |
| `horarios.gestionar` | No | No | No | Sí | No | Sí |
| `suplencias.crear` | No | Sí | No | Sí | No | Sí |
| `ciclos.promover` | No | No | No | Sí | No | Sí |
| `config.gestionar` | No | No | No | No | No | Sí |

`Administrador` recibe todos los permisos con un `CROSS JOIN`, de modo que también recibirá futuros permisos al regenerar un seed adaptado. La migración eleva `admin@galileo.edu.ar` a este rol.

## Capacidades y prohibiciones

### Alumno

Puede consultar únicamente su propia asistencia, sus notas, su historial, su resumen de reportes y el horario de su curso.

No puede acceder a Galiservas, gestionar alumnos/cursos, tomar asistencia, cargar notas, ver reportes institucionales, administrar recursos, usuarios o auditoría.

### Preceptor

Puede gestionar alumnos de cursos asignados, ver historial, tomar/corregir asistencia, consultar riesgo de sus cursos y operar reservas propias confirmadas automáticamente. Baja y cambio de curso exigen reingresar su contraseña.

No puede crear/asignar cursos, cargar notas, ver reportes ajenos, administrar reservas ajenas, recursos, usuarios o auditoría. Alumnos, asistencia, notas, reportes e historial aplican alcance por `preceptor_id`.

Suplencias: puede registrar las propias (hasta 30 días, sin fechas pasadas) para cubrir un curso ajeno; mientras están vigentes el curso entra en su alcance. Administración Académica y Administrador las gestionan para cualquier preceptor.

### Directivo

Puede leer información académica y reportes institucionales.

No puede acceder a Galiservas ni modificar alumnos/cursos/asistencias/notas, administrar recursos, usuarios o auditoría.

### Administrador Académico

Puede gestionar alumnos, cursos/asignaciones, asistencia, notas, reportes académicos y los horarios por curso.

No puede acceder a Galiservas ni gestionar recursos, usuarios/roles o auditoría.

### Docente

Puede ver alumnos/cursos/asistencia/notas, tomar asistencia, cargar notas y operar reservas propias. Su alcance sale de la grilla vigente (`horario_clases`): solo ve alumnos y cursos donde tiene clases, y solo registra asistencia o notas, consulta historial y reportes de las materias que dicta en cada curso (`403` fuera de eso). Sin clases asignadas no ve alumnos.

No puede modificar alumnos/cursos, ver reportes globales, administrar reservas ajenas/recursos/usuarios/auditoría. El login Galisencia lo normaliza visualmente a `preceptor`; Galiservas conserva el rol textual de `sesion.php`.

### Administrador

Puede todas las capacidades del catálogo: administración académica, recursos, reservas, usuarios/roles y auditoría. Es el único que puede crear/editar/desactivar recursos porque `recursos.php` verifica permiso **y** rol exacto.

No puede violar validaciones: capacidad, solapamientos, FKs y protección del último Administrador siguen vigentes.

## Alcance backend obligatorio

| Recurso | Usuario común | Administrador funcional |
|---|---|---|
| Alumnos de preceptor | Cursos con `preceptor_id` propio y cursos con suplencia vigente | Según permiso. |
| Cursos de preceptor | Solo asignados | Todos según permiso. |
| Asistencia/notas | Alumno: solo lo suyo. Preceptor: sus cursos. Docente: los pares curso/materia que dicta según la grilla. Directivo y Admin. Académico: sin restricción de curso | Según permiso. |
| Reservas | Solo `user_id` propio | Todas con `reservas.administrar`. |
| Edición de reserva | Propia y activa | Cualquiera; puede finalizar/cancelar. |
| Cancelación | Propia pendiente/confirmada | Cualquiera. |
| Recursos inactivos | No visibles | Administrador con `incluirInactivos`. |

## Orden obligatorio en cada endpoint

1. Recuperar sesión y responder `401` si falta. El rol se relee de la base (`api_rol_actual()` en `_common.php`) en cada request; `$_SESSION["rol"]` es solo una copia refrescada, nunca la fuente para decidir alcance.
2. Consultar permiso y responder `403` si falta.
3. Aplicar alcance propio, cursos asignados o institucional.
4. Validar campos, estado y relaciones.
5. Usar transacción/bloqueo cuando haya concurrencia, como reservas.
6. Registrar auditoría sin datos sensibles.
7. Responder HTTP/JSON consistentes.

Un usuario autenticado no es automáticamente un usuario autorizado.

Excepción previa al paso 2: si la cuenta tiene `debe_cambiar_password = 1`, `_common.php` responde `403` (`"codigo":"debe_cambiar_password"`) a todo endpoint salvo `sesion.php`, `cambiar_password.php` y `logout.php`. `cambiar_password.php` es autoservicio y no requiere permiso RBAC.
