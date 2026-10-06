# Diseño de la Fase 4

`PLAN_CAMBIOS.md` pide diseño previo para la Fase 4. Este documento fija el alcance y las decisiones antes de implementar. Quedan **a futuro**, fuera de esta etapa: multi-colegio (`institucion_id`, configuración y dominio por institución) y planes y facturación, backups automáticos y monitoreo.

Se implementan cuatro partes, en este orden (cada una con su migración, tests, docs y commit):

| Parte | Qué resuelve |
|---|---|
| 4.1 Portal de familias | Rol Tutor con alumnos vinculados y aviso diario de inasistencias. |
| 4.2 PWA del preceptor | Galisencia instalable en el celular y toma de asistencia que tolera cortes de conexión. |
| 4.3 SSO institucional (OIDC) | Ingreso con Google Workspace o Microsoft Entra ID, además del email y contraseña. |
| 4.4 Protección de datos | Medidas técnicas para la Ley 25.326: política de privacidad, consentimiento, retención y derecho de acceso. La revisión legal la tiene que hacer un abogado. |

Principios que no cambian: autorización solo en el backend, rol y permisos leídos de la base en cada request, orden sesión → permiso → alcance → validación → transacción → auditoría, auditoría sin datos sensibles y cero secretos en el repo.

---

## 4.1 Portal de familias

### Modelo

- Rol nuevo **Tutor** en `roles`, con acceso solo a Galisencia (`rol_sistema`) y los permisos de lectura del Alumno: `asistencia.ver`, `notas.ver` y `horarios.ver`.
- Tabla `tutor_alumno(tutor_id → usuarios, alumno_id → alumnos, parentesco, creado_por, creado_en)`, con PK `(tutor_id, alumno_id)`. Un tutor puede tener varios hijos y un alumno varios tutores.
- Permiso nuevo `tutores.gestionar` para Administración Académica y Administrador.

### Alcance del Tutor (backend)

Se agrega `api_alumnos_del_tutor($usuarioId)`. En todos los endpoints donde hoy se limita al Alumno a lo propio, el Tutor queda limitado a **sus alumnos vinculados y activos**:

- `alumnos.php` (GET), `asistencias.php` (GET), `notas.php` (GET), `historial_alumno.php` y `reportes.php`.
- `horario_grilla.php`: el curso de cada hijo.
- `justificaciones.php` (GET): el Tutor ve el motivo y el adjunto de sus hijos, igual que el propio alumno.

El Tutor no escribe nada. Las justificaciones las carga la escuela.

`login.php` y `sesion.php` devuelven `rol: "tutor"` (hoy un rol desconocido cae en `"alumno"`; se corrige para que nunca herede el alcance de otro rol) y la lista `alumnos` vinculados (id, nombre, curso).

### Gestión

`/tutores.php` (permiso `tutores.gestionar`):

- `GET ?alumnoId=` o `?q=`: tutores y vínculos.
- `POST`: crear la cuenta del tutor (contraseña inicial con `debe_cambiar_password`) y vincularlo, o vincular uno existente por email.
- `DELETE`: desvincular.

Todo auditado sin datos sensibles. En la UI: pestaña "Familias" en Gestión académica.

### Aviso de inasistencias

- Tipo de notificación nuevo `inasistencia` (se puede apagar en las preferencias).
- **Un aviso por tutor, alumno y día, no uno por materia.** Al registrar una ausencia se arma o actualiza una notificación pendiente con referencia `inasistencia:{tutor}:{alumno}:{fecha}`, programada para la hora de resumen (`notificaciones.hora_resumen_inasistencias`, por defecto 18:00).
- Si se carga después de esa hora, sale en la próxima pasada del worker. El cuerpo lista las materias del día.
- Si la ausencia se corrige a presente o se justifica, el aviso se recalcula; si ya no quedan ausencias, se borra. Las ausencias justificadas no se avisan.

### Frontend del Tutor

Ruta `/familia`:

- Selector de hijo, si tiene más de uno.
- La misma vista de asistencia del alumno (`AsistenciaDashboard`), sus justificaciones y su horario.
- Una tarjeta de preferencias de avisos.

Sin cambiar el diseño de Galisencia.

---

## 4.2 PWA del preceptor

### Instalable

`manifest.webmanifest` (nombre, íconos 192 y 512 desde el logo actual, `display: standalone`, colores del tema) y un service worker propio (sin dependencias nuevas):

- Precarga el *app shell* (HTML, JS y CSS del build) y sirve la navegación con estrategia *network-first* con respaldo al shell.
- **No guarda respuestas de `/api/`**: son datos personales de menores y no deben quedar en caché en el teléfono.

### Asistencia sin conexión

- Si al guardar la asistencia falla la red (no un error de la API), las marcas quedan en una cola local en IndexedDB.
- La cola guarda solo `alumnoId`, `materiaId`, `fecha` y `estado`: ningún nombre, DNI ni email.
- Se reenvía sola cuando vuelve la conexión (evento `online` y al abrir la app). El servidor ya hace *upsert* por alumno, materia y fecha, así que reenviar es seguro.
- La pantalla muestra "N marcas pendientes de enviar" y un botón "Reintentar".
- La cola se borra al cerrar sesión.
- La lista de alumnos tiene que haberse cargado con conexión: no se guarda el padrón en el dispositivo.

### Uso en el celular

En pantallas angostas, la toma de asistencia oculta columnas secundarias (DNI, email, división) y agranda los botones Presente/Tarde/Ausente. Solo media queries: el diseño de escritorio no cambia.

---

## 4.3 SSO institucional (OIDC)

Se sigue `docs/AUTENTICACION.md`, con estos ajustes:

- **Modo mixto:** el email y contraseña local sigue disponible (familias y cuentas sin Workspace) y se agregan botones "Ingresar con Google" y "Ingresar con Microsoft" solo para los proveedores configurados. `AUTH_PROVIDER=oidc` sigue permitiendo apagar el login local.
- **Proveedores por entorno:** `OIDC_GOOGLE_CLIENT_ID/SECRET`, `OIDC_MICROSOFT_TENANT/CLIENT_ID/SECRET` y, solo para pruebas, `OIDC_PRUEBA_*`.
- **Librería:** `jumbojett/openid-connect-php` instalada con Composer en el build de la imagen. Verifica la firma con el JWKS, `iss`, `aud`, `exp`, `nonce` y PKCE; no se validan tokens a mano.
- **Vinculación:**
  - Solo entra quien ya existe en `usuarios`: no hay autoregistro.
  - El primer ingreso vincula por email verificado (`email_verified`) y guarda `(proveedor, sub)` en `usuario_identidades`. Los siguientes entran por `sub`, aunque cambie el email.
  - Un intento con una cuenta desconocida responde con un error genérico y se audita.
- **Sesión:** se abre con `auth_iniciar_sesion()`, igual que el login local, y `debe_cambiar_password` no aplica a quien entra por OIDC.
- **Pruebas:** un proveedor OIDC de prueba mínimo (Node, firma RS256) en el stack de pruebas, para que `tests/api.test.mjs` pruebe el flujo completo:
  - Un usuario existente entra con su rol de la base.
  - Uno inexistente no entra.
  - `state` inválido se rechaza.
  - El segundo ingreso entra por `sub`.

  No hace falta Internet ni credenciales reales.

---

## 4.4 Protección de datos (medidas técnicas)

> Esto **no reemplaza** la revisión legal. Queda marcado como borrador para que lo revise un abogado (Ley 25.326, datos de menores, inscripción de bases ante la AAIP).

- **Política de privacidad:** página pública `/privacidad`, con el texto en un solo archivo y marcado "Borrador sujeto a revisión legal". Cubre responsable, finalidades, datos que se tratan (con mención especial a menores y datos de salud de las justificaciones), plazos de conservación, derechos de acceso, rectificación y supresión, cómo ejercerlos y la AAIP como órgano de control.
- **Consentimiento informado:**
  - Tabla `consentimientos(usuario_id, version, aceptado_en)`.
  - La versión vigente está en `config_institucion` (`privacidad.version_politica`).
  - Al ingresar, si el usuario no aceptó la versión vigente, Galisencia muestra la política y pide aceptarla antes de seguir (como el cambio de contraseña inicial). Galiservas delega en Galisencia.
  - Cambiar la versión vuelve a pedir la aceptación.
- **Retención:**
  - Plazos configurables en `config_institucion`: auditoría (24 meses), notificaciones enviadas o con error (6 meses), intentos de login (30 días) y adjuntos de justificaciones (24 meses: se borra el archivo y queda el registro).
  - Una tarea diaria (`cli/retencion.php`, que corre el mismo `notificador`) aplica los plazos y registra cuánto borró.
- **Derecho de acceso:**
  - `GET /datos_personales.php?alumnoId=` devuelve en JSON todo lo que el sistema tiene de un alumno: datos, asistencias, notas, justificaciones sin el binario, movimientos y tutores.
  - Lo pueden pedir Administración Académica, el Administrador, el propio alumno y sus tutores.
  - Se audita (sin el contenido).
  - Para un usuario cualquiera: sus propios datos de cuenta.
- **Documentación:** `docs/PROTECCION_DE_DATOS.md` con el inventario de datos personales (qué, dónde, para qué, quién accede, cuánto tiempo), las medidas técnicas existentes y la lista de puntos para la revisión legal.

---

## Riesgos y decisiones abiertas

- Las credenciales reales de Google o Microsoft las carga la escuela en `.env`. Sin ellas los botones no aparecen y todo sigue funcionando con email y contraseña.
- Los avisos a familias dependen del SMTP real en producción. En desarrollo van a Mailpit.
- La PWA no permite tomar asistencia de un curso cuya lista nunca se cargó con conexión. Es intencional, por privacidad.
- Los textos legales son borradores.
