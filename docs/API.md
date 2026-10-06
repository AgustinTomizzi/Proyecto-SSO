# API HTTP

## Alcance y convención

La API JSON está en `Galisencia/Galileo_Auth/api`. En Docker se accede por el nginx de cada frontend, en el mismo origen que la app:

```text
http://localhost:3000/api      (Galisencia)
http://localhost:5174/api      (Galiservas)
http://127.0.0.1:8080/api      (solo con docker compose --profile dev)
```

Todas las respuestas usan JSON UTF-8. Éxito: `{"ok":true,...}`. Error: `{"ok":false,"error":"mensaje"}` y, en algunos casos, `"codigo"`. Los cuerpos de escritura son `application/json` (multipart solo para subir horarios).

**Estado:** están implementados login, sesión, cambio de contraseña, logout, alumnos, historial de alumno, asistencias, cursos/asignaciones, notas, horarios, usuarios, reportes, auditoría, recursos, reservas y reportes de reservas. Las limitaciones indicadas son comportamiento observado en el código, no contratos deseados.

**Orden en cada endpoint:** sesión (`401`) → cuenta sin contraseña inicial pendiente (`403`) → permiso (`403`) → alcance → validación (`400`) → transacción si hay concurrencia → auditoría → respuesta.

## Autenticación, sesión y CORS

PHP crea una sesión de servidor y entrega la cookie estándar `PHPSESSID`. Después del login, el navegador debe reenviar esa cookie. Con `fetch`, las llamadas necesitan `credentials: "include"`. En desarrollo, el Vite de Galisencia proxifica `/api` a `http://localhost:80`; Galiservas llama a `http://localhost:8080/api` (perfil `dev` de Docker) y se apoya en el CORS que `APP_ENV=dev` habilita para localhost.

La cookie representa autenticación compartida en el mismo host, pero SSO completo exige que ambos sistemas consuman la misma sesión PHP y comprueben permisos. El frontend no guarda la sesión ni datos de alumnos en `localStorage`: al cargar consulta `sesion.php`, y el backend autoriza cada operación por su cuenta.

**Cookie y sesión.** `PHPSESSID` es `HttpOnly` y `SameSite=Lax`; lleva `Secure` cuando `APP_ENV` no es `dev` (producción exige HTTPS). `session.use_strict_mode=1`: un ID de sesión que no emitió el servidor se descarta y se entrega uno nuevo. Tras `SESSION_TIMEOUT_MINUTES` (30 por defecto) sin pedidos, la sesión se vacía y la API responde `401`.

**CORS.** Se habilita (con credenciales) para los orígenes listados en `CORS_ALLOWED_ORIGINS`, separados por coma. Solo con `APP_ENV=dev` se acepta además cualquier puerto de `localhost`/`127.0.0.1`. En Docker los frontends llaman a `/api` en su mismo origen, así que no dependen de CORS.

**CSRF.** Todo `POST`, `PUT`, `PATCH` o `DELETE` debe enviar el header `X-Requested-With: galileo`; sin él la API responde `403` con `"codigo":"csrf"`. Si el pedido tiene cuerpo, su `Content-Type` debe ser `application/json` (en `horarios.php` también `multipart/form-data`); otro tipo, como un formulario HTML, recibe `415`. Un formulario de otro sitio no puede enviar ese header, y un `fetch` cruzado necesita preflight CORS. Ambos frontends lo mandan en todos sus pedidos.

**Cabeceras.** Toda respuesta de la API incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store`; con HTTPS (directo o `X-Forwarded-Proto`) agrega `Strict-Transport-Security`. El nginx de cada frontend envía una CSP propia (`'self'` más Google Fonts), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`; su HSTS queda comentado hasta tener HTTPS.

### Login: **Implementada**

`POST /login.php`

No requiere sesión. Valida que email y contraseña no estén vacíos, busca email exacto, verifica `password_verify`, regenera el ID de sesión y guarda identidad/rol. Si el email no existe igual ejecuta `password_verify` contra un hash falso, para que el tiempo de respuesta no revele qué cuentas existen; el mensaje de error es el mismo en ambos casos. Tras 5 intentos fallidos del mismo email en 15 minutos responde `429` con `Retry-After`, aunque la contraseña sea correcta.

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
    "id": "3",
    "nombre": "Carlos",
    "email": "preceptor@galileo.edu.ar",
    "rol": "preceptor",
    "rol_backend": "Preceptor",
    "debeCambiarPassword": true
  },
  "permisos": ["alumnos.ver", "asistencia.registrar", "..."],
  "sistemas": ["Galisencia", "Galiservas"]
}
```

`usuario.debeCambiarPassword` indica que la cuenta todavía tiene una contraseña inicial (por ejemplo `demo1234`): mientras sea `true`, el resto de la API responde `403` con `"codigo":"debe_cambiar_password"` y solo quedan disponibles `sesion.php`, `cambiar_password.php` y `logout.php`.

Para Alumno, `id` se reemplaza por `alumnos.id_alumno` y se agrega `curso` si el email coincide. Roles de salida (`rol`): `alumno`, `preceptor`, `directivo`, `admin`. `Administrador` y `Administrador Academico` salen como `admin`, `Docente` como `preceptor` y un rol desconocido como `alumno`; `rol_backend` conserva el nombre real. La autorización nunca usa `rol`: el backend relee el rol de la base en cada request.

Errores: `400` campos ausentes, `401` credenciales inválidas, `405` otro método, `429` demasiados intentos fallidos, `500` conexión a BD.

### Consultar sesión: **Implementada**

`GET /sesion.php`

Reconstruye el usuario desde `$_SESSION`/BD y devuelve sus permisos, sin confiar en rol enviado por el cliente.

```json
{"ok":true,"usuario":{"id":"3","nombre":"Carlos","apellido":"Ramirez","email":"preceptor@galileo.edu.ar","rol":"Preceptor","rol_backend":"Preceptor","debeCambiarPassword":false},"permisos":["alumnos.ver","asistencia.registrar"],"sistemas":["Galisencia","Galiservas"]}
```

Para un Alumno activo, `id` pasa a ser `alumnos.id_alumno` y se agrega `curso`.

Sin sesión o usuario ya inexistente: `401`; otro método: `405`.

### Cambiar contraseña: **Implementada**

`POST /cambiar_password.php`, requiere sesión. Autoservicio: no requiere permiso RBAC, cada usuario cambia solo la suya.

```json
{"actual":"demo1234","nueva":"una-contraseña-propia"}
```

Valida que la nueva tenga entre 8 y 72 caracteres, sea distinta de la actual y no sea `demo1234`. Verifica la actual con el mismo límite de reconfirmaciones que las acciones sensibles. Guarda el hash, apaga `debe_cambiar_password`, regenera el ID de sesión y audita `usuarios.cambiar_password` sin datos de la contraseña. Respuesta: `{"ok":true}`.

Errores: `400` datos inválidos, `401` sin sesión o contraseña actual incorrecta, `405` otro método, `429` demasiados intentos.

### Logout: **Implementada**

`POST /logout.php` vacía la sesión, vence la cookie con sus parámetros actuales, destruye la sesión y devuelve `{"ok":true}`. Otro método: `405`.

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

Valida ID positivo y existencia. El Preceptor tiene `alumnos.editar`, pero solo sobre alumnos de sus cursos y hacia cursos suyos (`403`). Todo cambio de curso registra una fila `cambio_curso` en `alumno_movimientos`. Audita `alumnos.editar` con antes/después.

### Dar de baja: **Implementada como baja lógica**

`DELETE /alumnos.php?id=15`, permiso `alumnos.dar_baja`.

Valida ID y alcance del preceptor, actualiza `estado=0`, registra un movimiento `baja` en `alumno_movimientos` y conserva asistencias/notas. Audita antes/después. Respuesta: `{"ok":true}`.

Cuando un Preceptor cambia a un alumno de curso o lo da de baja debe reenviar `currentPassword` (sin él, `400`). Una contraseña incorrecta responde `401`; tras 5 reconfirmaciones fallidas en 15 minutos responde `429` (contador separado del de login).

Errores del recurso: `400` dato inválido, `401` sin sesión o contraseña de reconfirmación incorrecta, `403` sin permiso/fuera de alcance, `404` alumno inexistente, `405` método no permitido, `429` demasiadas reconfirmaciones fallidas.

## Materias

`GET /materias.php`, cualquier usuario autenticado. Catálogo ordenado por nombre:

```json
{"ok":true,"materias":[{"id":"7","nombre":"Ed. Técnica"},{"id":"1","nombre":"Matemática"}]}
```

Asistencias, notas y reportes identifican la materia por `materiaId`. **Compatibilidad por un ciclo:** también aceptan `materia` como texto y lo resuelven contra el catálogo sin distinguir tildes ni mayúsculas (`"matematica"` → `Matemática`). Una materia que no está en el catálogo responde `400` («materia inexistente»). Las respuestas devuelven `materiaId` y `materia` (nombre canónico).

## Asistencias

### Consultar: **Implementada**

`GET /asistencias.php?alumnoId=1&fecha=2026-06-09&materiaId=1&cursoId=1&ciclo=2026`, permiso `asistencia.ver`.

Todos los filtros son opcionales, combinables y validados (`400` si son inválidos): `alumnoId` y `cursoId` enteros positivos, `fecha` YYYY-MM-DD real, `materiaId` (o `materia` en texto) del catálogo, `ciclo` año de cuatro dígitos. Solo incluye alumnos activos y ordena por fecha.

**Alcance:** el Alumno ve solo sus registros, el Preceptor solo los de sus cursos y el Docente solo los de las materias que dicta en cada curso según la grilla vigente (un filtro fuera de alcance devuelve lista vacía). Directivo, Administrador Académico y Administrador ven todo.

```json
{"ok":true,"registros":[{"id":"1","alumnoId":"1","materiaId":"1","materia":"Matemática","fecha":"2026-06-09","estado":"presente"}]}
```

### Registrar o corregir: **Implementada**

`POST /asistencias.php`, permiso `asistencia.registrar`.

```json
{"alumnoId":1,"materiaId":1,"fecha":"2026-09-03","estado":"tarde"}
```

- **Validación (`400`):** `alumnoId` entero positivo, `materiaId` (o `materia`) del catálogo, `fecha` YYYY-MM-DD real y `estado` en `presente`/`tarde`/`ausente`. El alumno debe existir y estar activo (`400`).
- **Alcance (`403`):** el Preceptor solo opera sobre alumnos de sus cursos; el Docente solo sobre las materias que dicta en el curso del alumno; el Alumno solo sobre sí mismo.
- **Corrección:** si ya existe `(alumno, materia_id, fecha)` actualiza el estado, pero exige además `asistencia.editar` (`403` si falta).
- Bloquea alumno y registro con `FOR UPDATE` dentro de una transacción, audita `asistencia.registrar` o `asistencia.editar` con antes/después y responde `200`:

```json
{"ok":true,"registro":{"id":"41","alumnoId":"1","materiaId":"1","materia":"Matemática","fecha":"2026-09-03","estado":"tarde"}}
```

Otros métodos: `405`.

### Historial de un alumno: **Implementada**

`GET /historial_alumno.php?id=1`, permiso `asistencia.ver`. El Alumno solo ve el suyo y el Preceptor solo alumnos de sus cursos actuales (`403`). Devuelve `alumno`, `asistencia` agrupada por ciclo y materia con porcentaje, y `movimientos` (`alumno_movimientos`: cambios de curso y bajas). Errores: `400` id inválido, `404` alumno inexistente.

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

`GET /notas.php?alumnoId=1&materiaId=2`, permiso `notas.ver`. Los filtros son opcionales y validados (`400`). Solo incluye alumnos activos; el Alumno ve solo sus notas y el Preceptor solo las de sus cursos.

```json
{"ok":true,"notas":[{"id":"1","alumnoId":"1","materiaId":"2","materia":"Lengua","fecha":"2026-09-03","nota":"8.50"}]}
```

### Crear: **Implementada**

`POST /notas.php`, permiso `notas.crear`.

```json
{"alumnoId":1,"materiaId":2,"fecha":"2026-09-03","nota":8.5}
```

Exige alumno activo, `materiaId` (o `materia`) del catálogo y `nota` numérica entre 1 y 10; `fecha` es opcional (si falta, la fecha del servidor en hora argentina). Cualquier dato inválido da `400`. El Preceptor solo puede cargar en sus cursos y el Docente solo en las materias que dicta en el curso del alumno (`403`). Audita `notas.crear` y responde `200` con `{"ok":true,"nota":{...}}` (incluye `id`, `materiaId` y `materia`). Otros métodos: `405`.

## Horarios

### Consultar: **Implementada**

`GET /horarios.php[?cursoId=1]`, permiso `horarios.ver`. Lista los cursos con los datos del horario cargado (`horarioId`, `nombreArchivo`, `mimeType`, `tamanio`, `actualizadoEn`). El Alumno solo ve su curso.

`GET /horarios.php?imagen=1&cursoId=1[&download=1]` devuelve la imagen. Errores: `400` curso inválido, `403` Alumno pidiendo otro curso, `404` sin horario.

### Cargar o reemplazar: **Implementada**

`POST /horarios.php` (`multipart/form-data` con `cursoId` e `imagen`), permiso `horarios.gestionar`. Solo PNG, JPG o WEBP válidos de hasta 5 MB (se verifica el contenido, no la extensión). Reemplaza el horario anterior del curso, audita `horarios.gestionar` y responde `201`. Curso inexistente: `404`.

### Eliminar: **Implementada**

`DELETE /horarios.php` con `{"cursoId":1}`, permiso `horarios.gestionar`. Audita y responde `200`; sin horario, `404`.

## Grilla de horarios

Formato del colegio: 12 módulos de 60 minutos (mañana, tarde y vespertino) compartidos por todos los cursos. Cada fila de `horario_clases` es curso + día (1 = lunes … 5 = viernes) + módulo + grupo (0 = curso completo; 1 y 2 = mitades en paralelo), con materia, docente y aula opcionales y una vigencia. Una clase de varios módulos son varias filas; la API permite operar el bloque entero.

### Consultar: **Implementada**

`GET /horario_grilla.php?cursoId=1[&fecha=2026-04-06]`, permiso `horarios.ver`. También acepta `docenteId` o `aulaId` en lugar de `cursoId` (al menos uno, `400`). Devuelve los 12 módulos, el curso (si se filtró por curso) y las clases vigentes a `fecha` (por defecto hoy, en hora argentina). El Alumno solo ve su curso: sin filtro recibe el suyo y otro curso da `403`. El Docente puede pedir sus propias clases con `docenteId`.

```json
{"ok":true,"fecha":"2026-04-06","curso":{"id":"1","anio":"1","division":"A","turno":"Mañana"},
 "franjas":[{"id":"1","orden":1,"turno":"Mañana","horaInicio":"07:40","horaFin":"08:40"}],
 "clases":[{"id":"12","cursoId":"1","curso":"1 A","dia":1,"franjaId":"1","orden":1,"turno":"Mañana","horaInicio":"07:40","horaFin":"08:40","grupo":0,"materiaId":"14","materia":"Ciencias Naturales","docenteId":"40","docente":"Raffo, Y.","aulaId":"7","aula":"AT5","vigenteDesde":"2026-03-02","vigenteHasta":null}]}
```

`GET /horario_grilla.php?catalogos=1` (permiso `horarios.gestionar`): `docentes` (usuarios con rol Docente) y `aulas` activas (`{id, nombre, compartida}`) para el editor.

### Crear, editar y eliminar: **Implementada**

Permiso `horarios.gestionar` (Administrador Académico y Administrador).

- `POST /horario_grilla.php` con `{"cursoId":1,"dia":1,"franjaId":1,"franjaHastaId":2,"grupo":0,"materiaId":14,"docenteId":40,"aulaId":7,"vigenteDesde":"2026-03-02","vigenteHasta":null}`. `franjaHastaId` (último módulo del bloque, hasta 4 módulos), `grupo`, `docenteId`, `aulaId` y `vigenteHasta` son opcionales; `vigenteDesde` por defecto es hoy. Crea una fila por módulo y responde `201` con `clases` (y `clase`, la primera).
- `PUT /horario_grilla.php` con `id` (una clase) o `ids` (un bloque, hasta 12) y los campos a cambiar: `materiaId`, `docenteId`, `aulaId`, `grupo`, `vigenteDesde`, `vigenteHasta` (`null` borra docente, aula o fin de vigencia). `cursoId`, `dia` y `franjaId` solo se pueden cambiar editando una clase sola (`400` con varias). Todo el bloque se valida y guarda en una transacción.
- `DELETE /horario_grilla.php` con `{"id":12}` o `{"ids":[12,13]}`.

Validaciones (`400`): día 1 a 5, grupo 0 a 2, bloque hacia abajo y de hasta 4 módulos, materia del catálogo, docente con rol Docente, aula activa, vigencia con `hasta >= desde`. Curso, módulo, docente, aula o clase inexistentes: `404`.

Choques (`409`), solo con vigencias superpuestas: el curso completo choca con cualquier grupo del mismo módulo (y viceversa) y un grupo no puede repetirse; un docente no puede estar en dos clases en el mismo día y módulo; un aula no compartida tampoco (Playón, Campo y Patio sí admiten varias). Cada alta, edición o baja se audita como `horarios.gestionar` sobre `horario_clase` con antes/después.

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

Exige nombre, email válido/único, contraseña de al menos ocho caracteres (`password` o `contrasena`) y rol existente. Guarda el email en minúsculas, hashea con `PASSWORD_DEFAULT`, audita y devuelve `201`; duplicado `409`. El usuario creado no queda marcado con `debe_cambiar_password`.

### Cambiar rol: **Implementada**

`PUT /usuarios.php`, permiso `usuarios.editar_rol`.

```json
{"id":2,"rolId":3}
```

Valida IDs positivos, rol y usuario existentes; actualiza y audita. Impide quitar el rol al último `Administrador` (`409`). El cambio aplica desde el siguiente request de las sesiones ya abiertas, porque el rol se relee de la base en cada request. `400`, `404` o `200`; métodos restantes `405`.

Los usuarios se crean solo por esta API (el formulario PHP legado se eliminó).

## Reportes

### Resumen institucional: **Implementada**

`GET /reportes.php[?cursoId=1&ciclo=2026&materiaId=1]` (también acepta `materia` en texto). Acceden quienes tienen `reportes.ver`, el Alumno (solo su resumen), el Preceptor (solo sus cursos) y el Docente (sus cursos y solo las materias que dicta); un `cursoId` ajeno da `403`. Los filtros son opcionales y validados (`400`).

```json
{
  "ok": true,
  "resumen": {
    "promedio": 88,
    "totalAlumnos": 15,
    "alumnosConDatos": 14,
    "enRiesgo": 2,
    "porCurso": [{"curso":"1 A","promedio":83,"enRiesgo":1}],
    "alumnos": [{"alumno":{"id":"3","nombre":"Valentina Lopez","curso":"1 A"},"general":63,"enRiesgo":true,"porMateria":[]}],
    "alumnosEnRiesgo": [{"alumno":{"id":"3","nombre":"Valentina Lopez","curso":"1 A","email":"..."},"general":63}]
  }
}
```

Regla: porcentaje = `(presentes + 0,5 * tardes) / registros * 100`, redondeado. Riesgo es `< 75`. Un alumno sin registros tiene porcentaje `null` y no entra al promedio; sin datos, `promedio` es `null`. Otro método: `405`.

## Auditoría

### Consultar: **Implementada**

`GET /auditoria.php`, permiso `auditoria.ver`.

Filtros opcionales: `usuarioId`, `entidad`, `accion`, `desde`, `hasta`, `limit`. `limit` se fuerza a `1..500` y por defecto es `100`.

```json
{"ok":true,"registros":[{"id":"9","usuarioId":"1","usuarioNombre":"Admin Estela","rol":"Administrador Academico","accion":"alumnos.editar","entidad":"alumno","entidadId":"4","detalle":{"curso_id":2},"fecha":"2026-09-03 10:20:00"}]}
```

Orden descendente. `detalle` se decodifica a JSON. Si falta la tabla devuelve `500` con instrucción de migración. Otro método: `405`.

## Galiservas: recursos y reservas

Todos los endpoints de Galiservas (`recursos.php`, `reservas.php`, `reportes_reservas.php`) exigen primero que el rol tenga habilitado el sistema Galiservas en `rol_sistema` (`403` «tu rol no tiene acceso a Galiservas»). La UI pide además el permiso `galiservas.acceder`. Alumno, Directivo y Administrador Académico no tienen acceso.

### Recursos: **Implementada**

| Método | Permiso y regla | Comportamiento |
|---|---|---|
| `GET /recursos.php` | sistema Galiservas en `rol_sistema` + `recursos.ver` | Activos y disponibles; acepta fecha/horario, ubicación y categoría. Administrador puede usar `?incluirInactivos=1`. |
| `POST /recursos.php` | `recursos.crear` + rol exacto Administrador | Crea; `201`. |
| `PUT /recursos.php` | `recursos.editar` + Administrador | Reemplaza campos; `200`. |
| `DELETE /recursos.php?id=7` | `recursos.desactivar` + Administrador | Baja lógica; `200`. |

POST/PUT aceptan nombres ingleses o alias españoles:

```json
{"name":"Notebooks","type":"notebook","category":"hardware_pc","location":"Pañol","description":"Equipo móvil","capacity":30,"active":true,"available":true}
```

Nombre, tipo, categoría (`hardware_pc` o `audiovisual`), ubicación y capacidad `1..10000` son obligatorios. Para consultar stock de una franja: `GET /recursos.php?fecha=2026-09-15&hora_inicio=10:00&hora_fin=12:00` (los tres juntos; `400` si la franja es inválida); cada fila incluye `reserved` y `available`. La respuesta trae la lista en `recursos` y, por compatibilidad, también en `resources`. También acepta `ubicacion` y `categoria`. ID inexistente: `404`. Altas/cambios/bajas se auditan.

### Reservas: **Implementada**

`GET /reservas.php`, permiso `reservas.ver`. Quien tiene `reservas.administrar` ve todas; los demás solo `user_id` propio. La consulta `?mias=1` enviada por el frontend no cambia la lógica porque el backend ya aplica el alcance. En la respuesta, `confirmada` se muestra como `aprobada` y `completada` como `finalizada`; el `PUT` acepta esos alias.

`POST /reservas.php`, permiso `reservas.crear`:

```json
{"resourceId":3,"date":"2026-09-04","startTime":"10:00","endTime":"11:00","quantity":2,"reason":"Clase de laboratorio"}
```

También acepta `recursoId`, `fecha`, `horaInicio`, `horaFin`, `cantidad`, `motivo`. Solo un administrador de reservas puede indicar `userId`; si hay stock el estado inicial es `confirmada`, sin aprobación manual. Dentro de transacción bloquea el recurso, exige fecha actual o futura (en hora argentina; una fecha pasada da `400`), horas válidas, inicio menor a fin y motivo. Recurso inexistente o no disponible: `409`. Suma cantidades solapadas `pendiente`/`confirmada`; falta de capacidad devuelve `409`. Éxito `201` y auditoría.

`GET /reportes_reservas.php[?desde=2026-09-01&hasta=2026-09-30]`, permiso `reservas.administrar`. Cuenta solo reservas `confirmada`/`completada` y responde `{"ok":true,"report":{"byResource":[],"byCategory":[],"byHour":[]}}` con reservas y unidades por recurso, categoría y hora de inicio. Rango inválido: `400`.

`PUT /reservas.php`, permiso `reservas.editar`, requiere `id` en JSON. Usuario común: solo propia y activa (`pendiente` legado o `confirmada`); no puede cambiar estado salvo cancelar. Administrador: puede editar cualquiera y finalizar/cancelar. Revalida capacidad para estados activos. Respuesta `200`.

`DELETE /reservas.php?id=12`, permiso `reservas.cancelar`, hace cancelación lógica. Usuario común solo propia pendiente/confirmada; administrador puede cancelar cualquier estado. Respuestas: `403` ajena/cambio prohibido, `404` ID, `409` estado/capacidad, `400` validación, `405` método.

## Códigos comunes

| Código | Uso real/recomendado |
|---|---|
| `200` | Lectura, actualización o borrado exitoso. |
| `201` | Altas de cursos, usuarios, recursos, reservas y horarios. Alumnos, asistencias y notas todavía responden `200`. |
| `204` | Preflight `OPTIONS`. |
| `400` | Campo requerido o ID inválido. |
| `401` | Sin sesión o credenciales inválidas. |
| `403` | Falta permiso o alcance, falta el header CSRF (`codigo: csrf`) o la cuenta debe cambiar su contraseña (`codigo: debe_cambiar_password`). |
| `404` | Entidad no encontrada. |
| `405` | Método no permitido, con cabecera `Allow`. |
| `409` | Duplicado (curso, email), quitar el último Administrador, o reserva sin recurso disponible o sin capacidad. |
| `415` | Escritura con un `Content-Type` no admitido (ver CSRF). |
| `429` | Demasiados intentos fallidos de login o reconfirmación; incluye `Retry-After`. |
| `500` | Error interno o BD inaccesible; nunca incluye detalles de PDO. |

No se deben mostrar errores PDO ni hashes al cliente. La autorización siempre se repite en backend con `api_requerir_permiso`; las rutas React no son una barrera de seguridad.
