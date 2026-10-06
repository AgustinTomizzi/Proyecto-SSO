# Guía oral de presentación

## Mensaje central

"Proyecto SSO centraliza identidad y permisos para dos aplicaciones escolares. Galisencia gestiona asistencia y Galiservas reserva recursos; ambas comparten usuarios, permisos, sesión PHP, API y MySQL."

Mostrar también el límite conocido: el ciclo se deriva del año de cada fecha y todavía no existen períodos trimestrales independientes.

## Arquitectura en 40 segundos

- React 19 + TypeScript + Vite: interfaz por rol.
- PHP + PDO: sesiones, validación, autorización RBAC y API JSON.
- MySQL `ProyectoEstela`: identidad compartida, dominio académico y auditoría.
- Cookie `PHPSESSID`: identidad de servidor; `localStorage` solo conserva estado visual (tema, menú), nunca datos de alumnos.
- Docker Compose: MySQL, backend PHP, Galisencia en `http://localhost:3000/` y Galiservas en `http://localhost:3000/galiservas/`, detrás de un único proxy (mismo origen, misma sesión). El backend no publica puerto (solo con `--profile dev`, en `http://127.0.0.1:8080/api`).
- Seguridad base: límite de intentos de login (429 tras 5 fallos en 15 min), header CSRF `X-Requested-With: galileo` en escrituras, headers de seguridad y sesión que vence a los 30 min de inactividad.

## Entidades que hay que saber explicar

- `usuarios -> roles -> rol_permiso -> permisos`: quién es y qué puede hacer.
- `roles -> rol_sistema -> sistemas`: a qué aplicación pertenece el rol; la API de Galiservas lo valida (`api_requerir_sistema`) además del permiso.
- `cursos -> alumnos -> asistencias/notas`: núcleo Galisencia.
- `cursos.preceptor_id -> usuarios`: alcance de alumnos del preceptor.
- `auditoria -> usuarios`: quién cambió qué, preservando nombre/rol histórico.
- `resources -> reservations -> usuarios`: Galiservas con capacidad e intervalos.

## Métodos backend

- `POST login.php`: valida bcrypt, limita intentos, regenera sesión, devuelve usuario normalizado.
- `GET sesion.php` / `POST logout.php`: recupera o destruye la sesión compartida.
- `POST cambiar_password.php`: cambio de contraseña (obligatorio en el primer ingreso), auditado.
- `GET/POST/PUT/DELETE alumnos.php`: listado, alta, edición y baja con permisos; preceptor limitado a cursos asignados.
- `GET/POST asistencias.php`: consulta y *upsert* por alumno/materia/fecha; valida datos, audita y aplica alcance (Alumno solo lo propio, Preceptor solo sus cursos).
- `GET historial_alumno.php`: asistencia por ciclo/materia y movimientos de curso de un alumno, con el mismo alcance.
- `GET/POST/PUT cursos.php`: catálogo, alta y asignación de preceptor.
- `GET/POST notas.php`: consulta y alta, con validación, auditoría y el mismo alcance.
- `GET reportes.php`: porcentajes y riesgo, con filtros `cursoId`, `ciclo` y `materia` y alcance por rol.
- `GET/POST/PUT/DELETE horario_grilla.php`: grilla semanal con el formato del colegio (módulos, grupos, aulas, vigencias y control de choques); editar requiere `horarios.gestionar`. `horarios.php` quedó como histórico de imágenes de solo lectura.
- `GET/POST/PUT usuarios.php`: lista, crea y cambia rol, solo Administrador.
- `GET auditoria.php`: filtros y límite de 500.
- `GET/POST/PUT/DELETE recursos.php`: listado y administración con baja lógica.
- `GET/POST/PUT/DELETE reservas.php`: alcance propio/admin, capacidad y estados.
- `GET reportes_reservas.php`: reportes de reservas para Administrador.

## Lógica de negocio

- Asistencia única por `(alumno, materia, fecha)`.
- Estados: presente, tarde, ausente.
- Peso: `1`, `0,5`, `0`; riesgo debajo de `75%`.
- Preceptor-alumnos: usa FK `preceptor_id`, no un nombre escrito.
- La baja de alumno y recurso es lógica; se conserva historial.
- Reservas solapadas suman cantidades; una transacción con `FOR UPDATE` evita superar capacidad.
- RBAC se verifica en servidor para cada operación.
- Auditoría cubre alumnos, cursos, asistencias, notas, usuarios (incluido cambio de contraseña), horarios, recursos y reservas; falta auditar el login.

## Secuencia de demo segura

1. Copiar `.env.example` a `.env`, ejecutar `docker compose up --build -d` y verificar con `docker compose ps`.
2. Abrir Galisencia en `http://localhost:3000`.
3. Login preceptor; mostrar curso y registrar un estado.
4. Login directivo; mostrar promedio y alumnos en riesgo.
5. Login `admin@...`; mostrar usuarios y auditoría.
6. Abrir Galiservas en `/galiservas/` (sin volver a iniciar sesión), elegir Aulas o Pañol, crear una reserva automática y mostrar la disponibilidad de la franja.
7. Abrir el ER para conectar la demo con PK, FK y reglas.
8. Cerrar con SSO, RBAC, trazabilidad y portabilidad.

## Cuentas de demo

Contraseña inicial común: `demo1234`. Las cuentas tienen `debe_cambiar_password`: el primer ingreso obliga a elegir una nueva (conviene hacerlo antes de exponer).

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

**¿El usuario puede elegir su rol al entrar?**  
No. El login no tiene selector de rol: el backend lee el rol desde MySQL en cada request, así que un cambio de rol aplica sin volver a iniciar sesión.

**¿Cómo guardan contraseñas?**  
Como hashes compatibles con `password_hash`/`password_verify` (bcrypt en el seed), nunca texto plano.

**¿Qué impide dos asistencias iguales?**  
La UNIQUE `(alumno_id, materia, fecha)` y el POST actualiza el registro existente.

**¿Cómo calculan riesgo?**  
Presente suma 1, tarde 0,5, ausente 0. Porcentaje sobre registros; riesgo si es menor a 75%.

**¿Los permisos del frontend alcanzan?**  
No. El control importante está en PHP y base. Las rutas del frontend son experiencia de usuario.

**¿Qué se audita?**  
Cambios de alumnos, cursos, asistencias, notas, usuarios (incluido cambio de contraseña), horarios, recursos y reservas. Todavía no el login. Guardamos actor, rol, acción, entidad, detalle JSON y fecha.

**¿Cómo evita Galiservas sobre-reservas?**  
Valida recurso/capacidad, suma cantidades de intervalos solapados activos y bloquea el recurso con `FOR UPDATE` dentro de una transacción.

**¿Por qué Docker?**  
Un solo comando levanta MySQL, backend y los dos frontends con la misma configuración en cualquier máquina.

**¿Qué pasa si ya hay datos?**  
`docker compose up` conserva el volumen de MySQL; el esquema y el seed solo se cargan con la base vacía. `docker compose down -v` borra la base y es destructivo.

**¿Qué mejorarían primero?**  
Auditar el login, alcance por curso para Docente y modelar períodos trimestrales.

## Frases que no se deben usar

- No decir "no quedan límites de seguridad".
- No decir "Administrador Académico y Administrador son iguales".
- No decir "la UI protege la API".
- Si el backend no responde, la app lo avisa ("Sin conexión con el servidor") y no muestra datos de demostración.
