# Roles y permisos

## Principio de seguridad

La matriz efectiva sale de `db/02-seed.sql`. La interfaz puede ocultar pantallas, pero la autorización real ocurre en PHP mediante sesión y `tienePermiso`. Una ruta React, `localStorage` o un botón oculto nunca autorizan una operación; el rol se relee de la base en cada request.

Los seis roles están asociados a **Galisencia**. Galiservas está asociado exclusivamente a Preceptor, Docente y Administrador. La API de Galiservas exige que el rol tenga el sistema habilitado en `rol_sistema`; la UI pide además el permiso `galiservas.acceder`.

## Matriz exacta del seed canónico

| Permiso | Alumno | Preceptor | Directivo | Admin. Académico | Docente | Administrador | Tutor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `alumnos.ver` | No | Sí | Sí | Sí | Sí | Sí | No |
| `alumnos.crear` | No | Sí | No | Sí | No | Sí | No |
| `alumnos.editar` | No | Sí | No | Sí | No | Sí | No |
| `alumnos.dar_baja` | No | Sí | No | Sí | No | Sí | No |
| `cursos.ver` | No | Sí | Sí | Sí | Sí | Sí | No |
| `cursos.crear` | No | No | No | Sí | No | Sí | No |
| `cursos.asignar` | No | No | No | Sí | No | Sí | No |
| `asistencia.ver` | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| `asistencia.registrar` | No | Sí | No | Sí | Sí | Sí | No |
| `asistencia.editar` | No | Sí | No | Sí | Sí | Sí | No |
| `notas.ver` | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| `notas.crear` | No | No | No | Sí | Sí | Sí | No |
| `reportes.ver` | No | Sí | Sí | Sí | No | Sí | No |
| `usuarios.ver` | No | No | No | No | No | Sí | No |
| `usuarios.crear` | No | No | No | No | No | Sí | No |
| `usuarios.editar_rol` | No | No | No | No | No | Sí | No |
| `auditoria.ver` | No | No | No | No | No | Sí | No |
| `recursos.ver` | No | Sí | No | No | Sí | Sí | No |
| `recursos.crear` | No | No | No | No | No | Sí | No |
| `recursos.editar` | No | No | No | No | No | Sí | No |
| `recursos.desactivar` | No | No | No | No | No | Sí | No |
| `reservas.ver` | No | Sí | No | No | Sí | Sí | No |
| `reservas.crear` | No | Sí | No | No | Sí | Sí | No |
| `reservas.editar` | No | Sí | No | No | Sí | Sí | No |
| `reservas.cancelar` | No | Sí | No | No | Sí | Sí | No |
| `reservas.administrar` | No | No | No | No | No | Sí | No |
| `galiservas.acceder` | No | Sí | No | No | Sí | Sí | No |
| `horarios.ver` | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| `horarios.gestionar` | No | No | No | Sí | No | Sí | No |
| `suplencias.crear` | No | Sí | No | Sí | No | Sí | No |
| `ciclos.promover` | No | No | No | Sí | No | Sí | No |
| `config.gestionar` | No | No | No | No | No | Sí | No |
| `asistencia.justificar` | No | Sí | No | Sí | No | Sí | No |
| `tutores.gestionar` | No | No | No | Sí | No | Sí | No |

`Administrador` recibe todos los permisos con un `CROSS JOIN`, de modo que también recibirá futuros permisos al regenerar un seed adaptado. La migración eleva `admin@galileo.edu.ar` a este rol.

## Capacidades y prohibiciones

### Alumno

Puede consultar únicamente su propia asistencia, sus notas, su historial, su resumen de reportes y el horario de su curso.

No puede acceder a Galiservas, gestionar alumnos/cursos, tomar asistencia, cargar notas, ver reportes institucionales, administrar recursos, usuarios o auditoría.

### Preceptor

Puede gestionar alumnos de cursos asignados, ver historial, tomar/corregir asistencia, consultar riesgo de sus cursos y operar reservas propias confirmadas automáticamente. Baja y cambio de curso exigen reingresar su contraseña.

No puede crear/asignar cursos, cargar notas, ver reportes ajenos, administrar reservas ajenas, recursos, usuarios o auditoría. Alumnos, asistencia, notas, reportes e historial aplican alcance por `preceptor_id`.

Suplencias: puede registrar las propias para cubrir un curso ajeno, con límites para que no se puedan encadenar: hasta 30 días, sin fechas pasadas, empezando como mucho dentro de 7 días, una sola vigente o futura a la vez y hasta 30 días por curso en cualquier ventana de 60. Mientras están vigentes, el curso entra en su alcance para la operación diaria (asistencia, justificaciones y consulta de alumnos, notas, historial y reportes), pero no para altas, bajas ni cambios de curso de alumnos, que siguen limitados a sus cursos titulares. Administración Académica y Administrador las gestionan para cualquier preceptor.

### Tutor (portal de familias)

Solo lectura, y solo de sus alumnos vinculados en `tutor_alumno` (activos): asistencia, notas, historial, justificaciones (con motivo y adjunto, como el propio alumno) y el horario de sus cursos. No lista alumnos, cursos ni reportes, y no escribe nada. Recibe por email el aviso diario de inasistencias, que puede apagar. Solo accede a Galisencia. Las cuentas las crea y vincula quien tiene `tutores.gestionar` (Administración Académica y Administrador).

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
| Datos del tutor | Solo alumnos vinculados (`api_alumnos_del_tutor`) | Según permiso. |
| Alumnos de preceptor | Cursos con `preceptor_id` propio y cursos con suplencia vigente | Según permiso. |
| Cursos de preceptor | Asignados y con suplencia vigente | Todos según permiso. |
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

## Notificaciones por email

Cada usuario ve y cambia solo sus propias preferencias e historial (`/notificaciones.php`), sin permiso extra. El estado de la cola de envío (`?cola=1`) exige `config.gestionar` (Administrador).
