# API HTTP

## Alcance y convención

La API JSON implementada está en `Galisencia/Galileo_Auth/api`. En USB/XAMPP su base Apache es:

```text
http://localhost/Proyecto-SSO/Galisencia/Galileo_Auth/api
```

Todas las respuestas usan JSON UTF-8. Éxito: `{"ok":true,...}`. Error: `{"ok":false,"error":"mensaje"}`. Los cuerpos de escritura son `application/json`.

**Estado:** login, sesión, logout, alumnos, asistencias, cursos/asignaciones, notas, usuarios, reportes, auditoría, recursos y reservas están implementados. Las limitaciones indicadas son comportamiento observado en el código, no contratos deseados.

## Autenticación, sesión y CORS

PHP crea una sesión de servidor y entrega la cookie estándar `PHPSESSID`. Después del login, el navegador debe reenviar esa cookie. Con `fetch`, las llamadas necesitan `credentials: "include"`; el kit USB evita CORS proxificando `/api` a Apache desde Vite.

La cookie representa autenticación compartida en el mismo host, pero SSO completo exige que ambos sistemas consuman la misma sesión PHP y comprueben permisos. El `localStorage` del frontend (`galisencia.session`) solo restaura la interfaz: no autoriza operaciones backend.

### Login: **Implementada**

`POST /login.php`

No requiere sesión. Valida que email y contraseña no estén vacíos, busca email exacto, verifica `password_verify`, regenera el ID de sesión y guarda identidad/rol.

```json
{
  "email": "preceptor@galileo.edu.ar",
  "password": "demo1234"
}
```

```json
{
  "ok": true,
  "usuario": {
    "id": "2",
    "nombre": "Prof.",
    "email": "preceptor@galileo.edu.ar",
    "rol": "preceptor"
  }
}
```

Para Alumno, `id` se reemplaza por `alumnos.id_alumno` y se agrega `curso` si el email coincide. Roles de salida: `alumno`, `preceptor`, `directivo`, `admin`; `Docente` se mapea temporalmente a `preceptor`.

Errores: `400` campos ausentes, `401` credenciales inválidas, `405` otro método, `500` conexión a BD.

### Consultar sesión: **Implementada**

`GET /sesion.php`

Reconstruye el usuario desde `$_SESSION`/BD y devuelve sus permisos, sin confiar en rol enviado por el cliente.

```json
{"ok":true,"usuario":{"id":"3","nombre":"Carlos","apellido":"Ramirez","email":"preceptor@galileo.edu.ar","rol":"Preceptor"},"permisos":["alumnos.ver","asistencia.registrar"]}
```

Sin sesión o usuario ya inexistente: `401`; otro método: `405`.

### Logout: **Implementada**

`POST /logout.php` vacía la sesión, vence la cookie con sus parámetros actuales, destruye la sesión y devuelve `{"ok":true}`. Otro método: `405`. También existe `GET ../logout.php` para páginas HTML, que destruye y redirige.

Galiservas consume el endpoint JSON. Ambos frontends llaman al logout PHP para destruir la sesión compartida.

## Alumnos

### Listar: **Implementada**

`GET /alumnos.php`, permiso `alumnos.ver`.

```json
{"ok":true,"alumnos":[{"id":"1","nombre":"Sofia Gutierrez","curso":"1 A","cursoId":1,"email":"alumno@galileo.edu.ar"}]}
```

Preceptor: solo cursos cuyo `cursos.preceptor_id` sea su `id_usuario`. Por defecto solo devuelve `estado=1`; el Administrador puede pedir `?incluirInactivos=1`.

### Crear: **Implementada**

`POST /alumnos.php`, permiso `alumnos.crear`.

```json
{"nombre":"Ana","apellido":"Paz","curso":"1 A","email":"ana@galileo.edu.ar"}
```

`nombre` y `apellido` son obligatorios; email, si existe, debe ser válido. Acepta `cursoId` o resuelve `curso` por año/división y rechaza cursos inexistentes. También acepta `dni` y `direccion`. Un preceptor recibe `403` fuera de sus cursos. Respuesta `200` con el alumno creado.

### Editar: **Implementada**

`PUT /alumnos.php`, permiso `alumnos.editar`.

```json
{"id":1,"nombre":"Sofia","apellido":"Gutierrez","curso":"2 A","email":"alumno@galileo.edu.ar"}
```

Valida ID positivo y existencia. Si el actor fuera preceptor, limita curso original y destino; en el seed canónico el preceptor no posee `alumnos.editar`. Audita `alumnos.editar`.

### Dar de baja: **Implementada como baja lógica**

`DELETE /alumnos.php?id=15`, permiso `alumnos.dar_baja`.

Valida ID y alcance del preceptor, actualiza `estado=0` y conserva asistencias/notas. Audita antes/después. Respuesta: `{"ok":true}`.

Errores del recurso: `400` dato inválido, `401` sin sesión, `403` sin permiso/fuera de alcance, `404` alumno inexistente, `405` método no permitido.

## Asistencias

### Consultar: **Implementada**

`GET /asistencias.php?alumnoId=1&fecha=2026-06-09&materia=Matematica`, permiso `asistencia.ver`.

Todos los filtros son opcionales y combinables.

```json
{"ok":true,"registros":[{"id":"1","alumnoId":"1","materia":"Matematica","fecha":"2026-06-09","estado":"presente"}]}
```

### Registrar o corregir: **Implementada**

`POST /asistencias.php`, permiso `asistencia.registrar`.

```json
{"alumnoId":1,"materia":"Matematica","fecha":"2026-09-03","estado":"tarde"}
```

Requiere alumno positivo, materia y fecha no vacías. Si ya existe `(alumno, materia, fecha)`, actualiza; si no, inserta. Estados permitidos: `presente`, `tarde`, `ausente`; un valor desconocido se reemplaza hoy por `presente`.

Límites actuales: no valida formato de fecha/materia/alumno, no audita y no restringe al preceptor a sus cursos. No existe `PUT` separado aunque el permiso `asistencia.editar` está sembrado. Métodos restantes devuelven `405`.

## Cursos y asignaciones

### Listar: **Implementada**

`GET /cursos.php`, permiso `cursos.ver`.

```json
{"ok":true,"cursos":[{"id":"1","anio":"1","division":"A","turno":"Mañana","preceptorId":"3","preceptor":"Carlos Ramirez"}]}
```

El preceptor solo recibe cursos propios; otros roles con permiso reciben todos. Métodos admitidos: GET, POST y PUT.

### Crear curso: **Implementada**

`POST /cursos.php`, permiso `cursos.crear`.

```json
{"anio":"5","division":"B","turno":"Tarde"}
```

Turnos válidos: `Mañana`, `Tarde`, `Noche`. Rechaza duplicado `(anio, division, turno)` con `409`, crea sin preceptor, audita y devuelve `201`.

### Asignar preceptor: **Implementada**

`PUT /cursos.php`, permiso `cursos.asignar`.

```json
{"id":1,"preceptorId":2}
```

Valida curso y que el usuario tenga rol exacto `Preceptor`; `preceptorId:null` desasigna. Actualiza `preceptor_id` y texto legado, audita y devuelve `200`; `400` usuario/rol y `404` curso.

No existe entidad `asignaciones` separada: la asignación vigente es `cursos.preceptor_id`.

## Notas

### Consultar: **Implementada**

`GET /notas.php?alumnoId=1`, permiso `notas.ver`. El filtro es opcional.

```json
{"ok":true,"notas":[{"id":"1","alumnoId":"1","materia":"Lengua","fecha":"2026-09-03","nota":"8.50"}]}
```

### Crear: **Implementada**

`POST /notas.php`, permiso `notas.crear`.

```json
{"alumnoId":1,"materia":"Lengua","nota":"8.50"}
```

Exige alumno positivo y materia; nota puede ser vacía/`NULL`; fecha es la del servidor. No valida rango, existencia, alcance ni audita. Otros métodos no responden `405` explícito.

## Usuarios y roles

### Listar: **Implementada**

`GET /usuarios.php`, permiso `usuarios.ver`.

```json
{"ok":true,"usuarios":[{"id":"1","nombre":"Admin","apellido":"Estela","email":"admin@galileo.edu.ar","rolId":"6","rol":"Administrador","cursosAsignados":null}],"roles":[{"id":"1","nombre":"Alumno"}]}
```

No expone hashes. Devuelve también el catálogo de roles.

### Crear usuario: **Implementada**

`POST /usuarios.php`, permiso `usuarios.crear`.

```json
{"nombre":"Julia","apellido":"Paz","email":"julia@galileo.edu.ar","password":"demo1234","rolId":5}
```

Exige nombre, email válido/único, contraseña de al menos ocho caracteres y rol existente. Hashea con `PASSWORD_DEFAULT`, audita y devuelve `201`; duplicado `409`.

### Cambiar rol: **Implementada**

`PUT /usuarios.php`, permiso `usuarios.editar_rol`.

```json
{"id":2,"rolId":3}
```

Valida IDs positivos, rol y usuario existentes; actualiza y audita. Impide quitar el rol al último `Administrador` (`409`). No invalida inmediatamente sesiones ya abiertas. `400`, `404` o `200`; métodos restantes `405`.

También existe el formulario HTML legado `../crear_usuario.php`.

## Reportes

### Resumen institucional: **Implementada**

`GET /reportes.php`, permiso `reportes.ver`.

```json
{
  "ok": true,
  "resumen": {
    "promedio": 88,
    "totalAlumnos": 15,
    "enRiesgo": 2,
    "porCurso": [{"curso":"1 A","promedio":83,"enRiesgo":1}],
    "alumnosEnRiesgo": [{"alumno":{"id":"3","nombre":"Valentina Lopez","curso":"1 A","email":"..."},"general":63}]
  }
}
```

Regla: porcentaje = `(presentes + 0,5 * tardes) / registros * 100`, redondeado. Riesgo es `< 75`. Sin registros se considera `100` para promedio, pero porcentaje individual queda nulo. No acepta filtros ni limita por curso del preceptor. Otro método: `405`.

## Auditoría

### Consultar: **Implementada**

`GET /auditoria.php`, permiso `auditoria.ver`.

Filtros opcionales: `usuarioId`, `entidad`, `accion`, `desde`, `hasta`, `limit`. `limit` se fuerza a `1..500` y por defecto es `100`.

```json
{"ok":true,"registros":[{"id":"9","usuarioId":"1","usuarioNombre":"Admin Estela","rol":"Administrador Academico","accion":"alumnos.editar","entidad":"alumno","entidadId":"4","detalle":{"curso_id":2},"fecha":"2026-09-03 10:20:00"}]}
```

Orden descendente. `detalle` se decodifica a JSON. Si falta la tabla devuelve `500` con instrucción de migración. Otro método: `405`.

## Galiservas: recursos y reservas

### Recursos: **Implementada**

| Método | Permiso y regla | Comportamiento |
|---|---|---|
| `GET /recursos.php` | `galiservas.acceder` + `recursos.ver` | Activos y disponibles; acepta fecha/horario, ubicación y categoría. Administrador puede usar `?incluirInactivos=1`. |
| `POST /recursos.php` | `recursos.crear` + rol exacto Administrador | Crea; `201`. |
| `PUT /recursos.php` | `recursos.editar` + Administrador | Reemplaza campos; `200`. |
| `DELETE /recursos.php?id=7` | `recursos.desactivar` + Administrador | Baja lógica; `200`. |

POST/PUT aceptan nombres ingleses o alias españoles:

```json
{"name":"Notebooks","type":"notebook","category":"hardware_pc","location":"Pañol","description":"Equipo móvil","capacity":30,"active":true,"available":true}
```

Nombre, tipo, categoría (`hardware_pc` o `audiovisual`), ubicación y capacidad `1..10000` son obligatorios. Para consultar stock de una franja: `GET /recursos.php?fecha=2026-09-15&hora_inicio=10:00&hora_fin=12:00`; cada fila incluye `reserved` y `available`. También acepta `ubicacion` y `categoria`. ID inexistente: `404`. Altas/cambios/bajas se auditan.

### Reservas: **Implementada**

`GET /reservas.php`, permiso `reservas.ver`. Quien tiene `reservas.administrar` ve todas; los demás solo `user_id` propio. La consulta `?mias=1` enviada por el frontend no cambia la lógica porque el backend ya aplica el alcance.

`POST /reservas.php`, permiso `reservas.crear`:

```json
{"resourceId":3,"date":"2026-09-04","startTime":"10:00","endTime":"11:00","quantity":2,"reason":"Clase de laboratorio"}
```

También acepta `recursoId`, `fecha`, `horaInicio`, `horaFin`, `cantidad`, `motivo`. Solo un administrador de reservas puede indicar `userId`; si hay stock el estado inicial es `confirmada`, sin aprobación manual. Dentro de transacción bloquea el recurso, exige fecha actual o futura, horas válidas, inicio menor a fin, motivo, recurso activo/disponible y capacidad. Suma cantidades solapadas `pendiente`/`confirmada`; falta de capacidad devuelve `409`. Éxito `201` y auditoría.

`GET /reportes_reservas.php`, permiso `reservas.administrar`, resume unidades/reservas por recurso, categoría y hora de inicio.

`PUT /reservas.php`, permiso `reservas.editar`, requiere `id` en JSON. Usuario común: solo propia y activa (`pendiente` legado o `confirmada`); no puede cambiar estado salvo cancelar. Administrador: puede editar cualquiera y finalizar/cancelar. Revalida capacidad para estados activos. Respuesta `200`.

`DELETE /reservas.php?id=12`, permiso `reservas.cancelar`, hace cancelación lógica. Usuario común solo propia pendiente/confirmada; administrador puede cancelar cualquier estado. Respuestas: `403` ajena/cambio prohibido, `404` ID, `409` estado/capacidad, `400` validación, `405` método.

## Códigos comunes

| Código | Uso real/recomendado |
|---|---|
| `200` | Lectura, actualización o borrado exitoso. |
| `201` | Recomendado para nuevas altas; los POST actuales devuelven `200`. |
| `204` | Preflight `OPTIONS`. |
| `400` | Campo requerido o ID inválido. |
| `401` | Sin sesión o credenciales inválidas. |
| `403` | Falta permiso o alcance. |
| `404` | Entidad no encontrada. |
| `405` | Método no permitido; algunos endpoints actuales aún no lo emiten al final. |
| `409` | Recomendado para duplicado/solapamiento. |
| `422` | Recomendado para regla de negocio. |
| `500` | BD inaccesible o auditoría no migrada. |

No se deben mostrar errores PDO ni hashes al cliente. La autorización siempre se repite en backend con `api_requerir_permiso`; las rutas React no son una barrera de seguridad.
