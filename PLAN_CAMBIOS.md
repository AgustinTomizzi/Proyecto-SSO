# Plan de cambios: Proyecto-SSO

Origen: análisis completo del repo (octubre 2026). Cada tarea indica **qué**, **dónde** y **listo cuando**.
Ejecutar en orden, una fase por vez, con lint + build + tests al final de cada tarea.

## Cómo arrancar en Claude Code
1. Copiá `CLAUDE.md` y este archivo a la raíz de `Proyecto-SSO`.
2. Abrí Claude Code en esa carpeta y pegá:
   > Leé CLAUDE.md y PLAN_CAMBIOS.md. Ejecutá la Fase 0 tarea por tarea. Después de cada una corré lint, build de los dos frontends y `tests/api.test.mjs`, y mostrame un resumen antes de seguir.
3. Al terminar cada fase, pedí lo mismo para la siguiente.

---

## Fase 0: seguridad y limpieza (1 a 2 días)

**0.1 Quitar Gravatar.**
Dónde: `api/login.php`, `api/sesion.php`, usos de `avatarUrl` en `Galisencia/Frontend` y `Galiservas/Frontend`.
Listo cuando: ningún request sale a gravatar.com y el avatar muestra las iniciales del usuario.

**0.2 No dejar datos de alumnos en `localStorage`.**
Dónde: `Galisencia/Frontend/src/data/StoreContext.tsx`.
Qué: dejar de persistir `{alumnos, cursos, registros}` reales; solo el modo demo (mock) puede persistir. Al cerrar sesión, limpiar todo.
Listo cuando: tras logout, `localStorage` no contiene nombres, DNI ni asistencias.

**0.3 Rol siempre desde la base.**
Dónde: `api/_common.php` (`api_rol_es`, `api_es_administrador`), `includes/scope.php` (se elimina en 0.9).
Qué: función `api_rol_actual()` que lee `usuarios.rol_id` → `roles.nombre` en cada request y refresca la sesión.
Listo cuando: test nuevo: pasar a un Administrador a Alumno con sesión abierta → su siguiente request ya queda limitado a su propia asistencia.

**0.4 Límite de intentos de login y de reconfirmación de contraseña.**
Dónde: `api/login.php`, `includes/scope.php::api_requerir_contrasena` (mover a `_common.php`), `alumnos.php` (re-auth), migración `db/05-seguridad.sql` con tabla `login_intentos(email, ip, fecha)`.
Qué: bloqueo temporal tras 5 intentos fallidos en 15 minutos; ejecutar `password_verify` contra un hash falso cuando el usuario no existe (igualar tiempos); mensaje genérico.
Listo cuando: test de 6 intentos → 429; y el tiempo de respuesta de "usuario inexistente" ≈ "contraseña mala".

**0.5 Credenciales y primer inicio.**
Dónde: `docker-compose.yml`, nuevo `.env.example` en la raíz, nuevo `db/00-usuario-app.sh`, `db/05-seguridad.sql`.
Qué: variables de entorno para todas las contraseñas (sin `rootpassword` escrito); usuario MySQL de la aplicación con permisos solo sobre `ProyectoEstela` (el backend deja de usar root); no publicar el puerto 8080 salvo con un profile de desarrollo; columna `usuarios.debe_cambiar_password` + endpoint `POST /api/cambiar_password.php`; el seed marca esa columna para las cuentas demo y se documenta que `demo1234` es solo para demo.
Listo cuando: `grep -r rootpassword` no encuentra nada y un usuario con la marca no puede operar hasta cambiar su contraseña.

**0.6 Sesión, CORS y cabeceras.**
Dónde: `Galisencia/Galileo_Auth/Dockerfile` (+ `.ini`), `nginx.conf` de ambos frontends, `api/_common.php`.
Qué: `session.use_strict_mode=1`, `cookie_secure` según `APP_ENV`, `SameSite=Lax`, timeout por inactividad (30 min); CORS con `localhost` solo si `APP_ENV=dev` y orígenes explícitos por `CORS_ALLOWED_ORIGINS` en producción; cabeceras CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` (y HSTS cuando haya HTTPS).
Listo cuando: las cabeceras aparecen en `curl -I` y los tests siguen en verde.

**0.7 Protección CSRF para la API.**
Dónde: `api/_common.php`, `apiClient.ts` y `auth.service.ts` (Galisencia), `api.ts` (Galiservas).
Qué: en POST/PUT/DELETE exigir `Content-Type: application/json` (o multipart en horarios) y el header `X-Requested-With: galileo`; los frontends lo envían siempre.
Listo cuando: test: POST sin el header → 403.

**0.8 Zona horaria.**
Dónde: `Dockerfile` PHP (`date.timezone`), `docker-compose.yml` (`TZ` y `--default-time-zone` de MySQL), `Galiservas/Frontend/src/App.tsx`.
Qué: helper `hoyLocal()` (formato `YYYY-MM-DD` con fecha local) usado en todos los `min`/validaciones; recalcularlo en cada uso, no al cargar el módulo.
Listo cuando: a las 22:00 hora Argentina se puede reservar para hoy.

**0.9 Eliminar legacy y sobrantes.** *(grep de referencias antes de borrar)*
- PHP legacy: `login.php`, `logout.php`, `index.php`, `dashboard.php`, `crear_usuario.php`, `admin/`, `galisencia/`, `galiservas/`, `database/permisos.sql`, `includes/scope.php`, y `requerirPermiso/requerirLogin` de `includes/*.php`.
- Frontend/raíz: `Galisencia/Frontend/raiz.txt`, `Galiservas/Frontend/Prototipo/`, `Galisencia/Frontend/public/galiservas/`, `package-lock.json` de la raíz, dependencia `puppeteer-core`, logos duplicados (dejar una sola copia por app en `public/`).
Listo cuando: ambos frontends compilan, los tests pasan y el repo pesa visiblemente menos.

**0.10 Documentación y migraciones ordenadas.**
Qué: renombrar `04-retiros-incidentes.sql` → `05-...` (o reordenar), dejando una sola secuencia sin duplicados; `04-horarios.sql` queda obsoleto tras la Fase 1; corregir `docs/API.md` (asistencias y notas hoy validan, auditan y restringen); actualizar README (quitar lo que no existe: `USB-Setup/`, `vite.galiservas.config.mjs`, o agregarlos al repo).
Listo cuando: README y docs coinciden con el código y un `docker compose down -v && up` crea todo sin errores.

**0.11 Sin mock silencioso.**
Dónde: `StoreContext.tsx`.
Qué: si hay sesión y falla la API, mostrar un banner "Sin conexión con el servidor" y no cargar datos demo.
Listo cuando: apagando el backend se ve el banner y ningún dato inventado.

---

## Fase 1: horarios en tabla, alcance del Docente y datos reales (3 a 5 días)

**1.1 Migración `db/06-horarios-grilla.sql`.**
```
franjas_horarias(id, turno, orden, hora_inicio, hora_fin, es_recreo)
horario_clases(id, curso_id, dia_semana 1-5, franja_id, materia_id, docente_id NULL,
               aula_resource_id NULL, vigente_desde, vigente_hasta NULL)
```
Índices únicos por (curso, día, franja, vigencia). Actualizar `01-schema.sql` y el seed. Migrar `horarios_curso` (imagen) como solo lectura histórica y luego retirarla.

**1.2 Materias como FK.**
`asistencias.materia_id` y `notas.materia_id` con backfill desde el texto (normalizando tildes y mayúsculas). Nueva clave única `(alumno_id, materia_id, fecha)`. La API acepta `materiaId` y por un ciclo sigue aceptando `materia` (texto) resolviéndolo contra `materias`.

**1.3 API `api/horario_grilla.php`.**
GET por curso/docente/aula; POST/PUT/DELETE de celdas con `horarios.gestionar`. Validaciones: un docente no puede estar en dos cursos en la misma franja; un aula no puede tener dos clases a la vez. Auditoría de cada cambio.

**1.4 UI de grilla editable** en `HorariosPage.tsx`.
Grilla día × franja por curso; edición por celda (materia, docente, aula) para Admin Académico y Administrador; solo lectura para el resto. Alumno ve su curso; Docente ve sus clases.

**1.5 Exportación.**
- PDF: vista de impresión con CSS (`@media print`, `@page` A4 apaisado) y botón "Imprimir / Guardar PDF".
- Excel: `exceljs`, una hoja por curso o una hoja única por selección.
Listo cuando: el mismo horario sale idéntico en pantalla, PDF y `.xlsx`.

**1.6 Alcance del Docente (BOLA).**
Helpers `api_cursos_del_docente()` y `api_materias_del_docente()` basados en `horario_clases`. Aplicar en `asistencias.php`, `notas.php`, `alumnos.php`, `historial_alumno.php` y `reportes.php`. Dar `horarios.ver` a Preceptor, Docente y Directivo.
Listo cuando: tests nuevos: Docente → 403 al registrar asistencia o nota en un curso/materia que no dicta, y `GET /alumnos.php` devuelve solo sus cursos.

**1.7 Alumno ↔ usuario por FK.**
`alumnos.usuario_id` único con backfill por email; el alcance del Alumno usa esa FK. Al crear un alumno, opción de crearle usuario. Corregir `scope` y `login.php` para no resolver por email.

**1.8 Seed realista.**
- Un usuario por alumno (contraseña demo, `debe_cambiar_password`).
- Asistencias de 8 semanas por materia según el horario sembrado, con ausencias y tardes distribuidas.
- Reservas relativas a `CURDATE()`, más retiros e incidentes de ejemplo.
- Horarios completos para los 10 cursos.
Listo cuando: el porcentaje por materia da valores variados y el calendario de Galiservas muestra reservas futuras.

**1.9 Paginación y agregación en SQL.**
`asistencias.php` con `page`/`limit` (máx. 500) y `reportes.php` calculando porcentajes con `SUM(CASE...)` en SQL.

---

## Fase 2: SSO sin baches e infraestructura (2 a 4 días)

**2.1 Dominio único con reverse proxy.**
Servicio `proxy` (Caddy o nginx) con `/` → Galisencia, `/galiservas/` → Galiservas, `/api/` → backend. Galiservas con `base: '/galiservas/'`. Quitar puertos hardcodeados y `VITE_GALISERVAS_URL=http://localhost:5174`; los links entre apps pasan a ser relativos. Un solo punto de entrada con HTTPS (certificado por variable de entorno).

**2.2 Login único real.**
Galiservas deja de tener su propio formulario: si no hay sesión, redirige a `/login?next=...` de Galisencia y vuelve. El logout limpia la sesión y avisa a la otra app (evento `storage` o `BroadcastChannel`).

**2.3 Sesiones fuera de `/tmp`.**
Servicio `redis` (o handler de sesión en base) para poder tener más de una réplica del backend.

**2.4 CI en GitHub Actions.**
`.github/workflows/ci.yml`: lint y build de ambos frontends, `docker compose up -d` y `tests/api.test.mjs`, falla si algo rompe.

**2.5 Interfaz de autenticación intercambiable.**
Aislar login/sesión detrás de un `AuthProvider` y un adaptador PHP, documentando en `docs/` cómo reemplazarlo por OIDC (Keycloak, Google o Microsoft).

---

## Fase 3: lo que falta del MVP y de las propuestas (1 a 2 semanas)

**3.1 Suplencias.** Tabla `cursos_suplencias(curso_id, preceptor_id, desde, hasta, creado_por)`; endpoint y UI para que un Preceptor agregue un curso temporal; el alcance incluye el curso solo mientras está vigente; auditoría.

**3.2 Promoción de ciclo lectivo.** Tabla `ciclos_lectivos`; endpoint para Administrador Académico que promueve alumnos al año siguiente (o los da de baja) en lote, con vista previa y registro en `alumno_movimientos` (tipo `promocion`).

**3.3 Calendario de Galiservas** con vistas diaria, semanal y mensual y filtro por categoría de recurso (módulo 4 del MVP).

**3.4 Reglas institucionales de reserva.** Tabla `config_institucion` (hora de apertura y cierre por turno, duración máxima, anticipación mínima y máxima) validada en `reservas.php`; configurable por el Administrador.

**3.5 Justificaciones y reglas de asistencia.** Estado `justificado` + adjunto opcional; el valor de "tarde" y el umbral de regularidad pasan de estar fijos en código (0,5 y 75) a `config_institucion`.

**3.6 Exportaciones en reportes** (Excel y PDF de impresión) en Galisencia y Galiservas.

**3.7 Notificaciones por email.** Tabla `notificaciones` como cola, envío por SMTP configurado por entorno, plantillas para reserva creada/modificada/cancelada y recordatorios; preferencias por usuario.

---

## Fase 4: hoja de ruta comercial (requiere diseño previo, no implementar a ciegas)
- **Multi-colegio:** `institucion_id` en todas las tablas, configuración y dominio por institución.
- **OIDC / SSO institucional** con Google o Microsoft Workspace.
- **Portal de familias:** rol Tutor con alumnos vinculados, notificaciones de inasistencia.
- **PWA** para que el preceptor tome asistencia desde el celular.
- **Planes y facturación**, backups automáticos, monitoreo.
- **Protección de datos:** revisar con un abogado la Ley 25.326 (datos de menores), política de retención y consentimiento.
