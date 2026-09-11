# Guía oral de presentación

## Mensaje central

"Proyecto SSO centraliza identidad y permisos para dos aplicaciones escolares. Galisencia gestiona asistencia y Galiservas reserva recursos; ambas comparten usuarios, permisos, sesión PHP, API y MySQL."

Mostrar también el límite conocido: el ciclo se deriva del año de cada fecha y todavía no existen períodos trimestrales independientes.

## Arquitectura en 40 segundos

- React 19 + TypeScript + Vite: interfaz por rol.
- PHP + PDO: sesiones, validación, autorización RBAC y API JSON.
- MySQL `ProyectoEstela`: identidad compartida, dominio académico y auditoría.
- Cookie `PHPSESSID`: identidad de servidor; `localStorage` solo conserva estado visual.
- Docker: alternativa con MySQL/backend/frontend Galisencia.
- USB/XAMPP: alternativa offline para aula, con Apache, MySQL y Node portátiles.

## Entidades que hay que saber explicar

- `usuarios -> roles -> rol_permiso -> permisos`: quién es y qué puede hacer.
- `roles -> rol_sistema -> sistemas`: a qué aplicación pertenece el rol, aunque hoy la API autoriza directamente por permiso.
- `cursos -> alumnos -> asistencias/notas`: núcleo Galisencia.
- `cursos.preceptor_id -> usuarios`: alcance de alumnos del preceptor.
- `auditoria -> usuarios`: quién cambió qué, preservando nombre/rol histórico.
- `resources -> reservations -> usuarios`: Galiservas con capacidad e intervalos.

## Métodos backend

- `POST login.php`: valida bcrypt, regenera sesión, devuelve usuario normalizado.
- `GET/POST/PUT/DELETE alumnos.php`: listado, alta, edición y borrado con permisos; preceptor limitado a cursos asignados en este recurso.
- `GET/POST asistencias.php`: consulta y *upsert* por alumno/materia/fecha.
- `GET/POST/PUT cursos.php`: catálogo, alta y asignación de preceptor.
- `GET/POST notas.php`: consulta y alta.
- `GET reportes.php`: agrega porcentajes y riesgo.
- `GET/POST/PUT usuarios.php`: lista, crea y cambia rol, solo Administrador.
- `GET auditoria.php`: filtros y límite de 500.
- `GET/POST/PUT/DELETE recursos.php`: listado y administración con baja lógica.
- `GET/POST/PUT/DELETE reservas.php`: alcance propio/admin, capacidad y estados.

## Lógica de negocio

- Asistencia única por `(alumno, materia, fecha)`.
- Estados: presente, tarde, ausente.
- Peso: `1`, `0,5`, `0`; riesgo debajo de `75%`.
- Preceptor-alumnos: usa FK `preceptor_id`, no un nombre escrito.
- La baja de alumno y recurso es lógica; se conserva historial.
- Reservas solapadas suman cantidades; una transacción con `FOR UPDATE` evita superar capacidad.
- RBAC se verifica en servidor para cada operación.
- Auditoría cubre cambios académicos, usuarios, recursos y reservas; falta login/asistencia/notas.

## Secuencia de demo segura

1. Ejecutar `USB-Setup\VERIFICAR.bat` y luego `INICIAR_DEMO.bat`.
2. Abrir Galisencia en `http://localhost:5173`.
3. Login preceptor; mostrar curso y registrar un estado.
4. Login directivo; mostrar promedio y alumnos en riesgo.
5. Login `admin@...`; mostrar usuarios y auditoría.
6. Abrir Galiservas `:5174`, elegir Aulas o Pañol, crear una reserva automática y mostrar la disponibilidad de la franja.
7. Abrir el ER para conectar la demo con PK, FK y reglas.
8. Cerrar con SSO, RBAC, trazabilidad y portabilidad.

## Cuentas de demo

Contraseña común: `demo1234`.

| Email | Rol real en seed | Uso recomendado |
|---|---|---|
| `alumno@galileo.edu.ar` | Alumno | Vista personal. |
| `preceptor@galileo.edu.ar` | Preceptor | Registro de asistencia. |
| `directivo@galileo.edu.ar` | Directivo | Reportes. |
| `academica@galileo.edu.ar` | Administrador Academico | Gestión académica. |
| `docente@galileo.edu.ar` | Docente | Notas/asistencia y reservas propias. |
| `admin@galileo.edu.ar` | Administrador | Administración total. |

## Preguntas probables

**¿Por qué es SSO?**  
Porque una identidad y sesión PHP central es consumida por ambas aplicaciones. Cada una vuelve a comprobar permisos en la misma API/BD.

**¿La selección de rol del login es segura?**  
No concede nada. El backend obtiene el rol desde MySQL; la UI solo lo usa en modo mock/para navegación.

**¿Cómo guardan contraseñas?**  
Como hashes compatibles con `password_hash`/`password_verify` (bcrypt en el seed), nunca texto plano.

**¿Qué impide dos asistencias iguales?**  
La UNIQUE `(alumno_id, materia, fecha)` y el POST actualiza el registro existente.

**¿Cómo calculan riesgo?**  
Presente suma 1, tarde 0,5, ausente 0. Porcentaje sobre registros; riesgo si es menor a 75%.

**¿Los permisos del frontend alcanzan?**  
No. El control importante está en PHP y base. Las rutas del frontend son experiencia de usuario.

**¿Qué se audita?**  
Cambios de alumnos/cursos/usuarios y operaciones de recursos/reservas. Guardamos actor, rol, acción, entidad, detalle JSON y fecha.

**¿Cómo evita Galiservas sobre-reservas?**  
Valida recurso/capacidad, suma cantidades de intervalos solapados activos y bloquea el recurso con `FOR UPDATE` dentro de una transacción.

**¿Por qué XAMPP para USB?**  
Reduce dependencias del aula. Apache/MySQL, Node y `node_modules` viajan preempaquetados; no se descarga nada al iniciar.

**¿Qué pasa si ya hay datos?**  
`INICIAR_DEMO.bat` solo importa si `ProyectoEstela` no existe. El reinicio destructivo está separado y exige escribir una frase exacta.

**¿Qué mejorarían primero?**  
Alcance propio/curso en asistencias y notas, logout API en Galisencia, auditoría de login/asistencia/notas y disponibilidad por franja en las tarjetas.

## Frases que no se deben usar

- No decir "no quedan límites de seguridad".
- No decir "Administrador Académico y Administrador son iguales".
- No decir "Docker publica el frontend Galiservas".
- No decir "la UI protege la API".
- No decir "la demo siempre persiste": puede caer a mock si el backend no responde.
