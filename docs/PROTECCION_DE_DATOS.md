# Protección de datos personales

Medidas técnicas del sistema frente a la **Ley 25.326** de Protección de los Datos Personales. **No reemplazan la revisión legal**: la lista de pendientes para el abogado está al final.

## Inventario de datos personales

| Dato | Dónde | Para qué | Quién accede | Conservación |
|---|---|---|---|---|
| Nombre, apellido, DNI, dirección y email del alumno | `alumnos` | Gestión académica | Administración Académica y Administrador; Preceptor y Docente en su alcance (sin acceso a la API de usuarios); el propio alumno y su familia | Mientras lo exija la normativa educativa |
| Curso, asistencias, notas y movimientos | `alumnos`, `asistencias`, `notas`, `alumno_movimientos` | Seguimiento académico y regularidad | Según rol y alcance (`docs/ROLES_Y_PERMISOS.md`) | Ídem |
| **Datos de salud:** motivo y certificado de las justificaciones | `justificaciones` | Justificar inasistencias | Quien puede justificar en su alcance, el alumno y su tutor. El resto ve solo "justificada" | Certificado: `retencion.adjuntos_meses` (24); el motivo queda con la justificación |
| Cuentas: nombre, email, rol y contraseña (hash bcrypt) | `usuarios` | Ingreso y permisos | Administrador | Mientras la cuenta exista |
| Identidad en Google o Microsoft (`sub` y email) | `usuario_identidades` | Ingreso institucional | Sistema | Mientras la cuenta exista |
| Familias: vínculo y parentesco | `tutor_alumno` | Portal de familias | Administración Académica y Administrador; el propio tutor | Mientras el vínculo exista |
| Reservas (motivo incluido) | `reservations` | Galiservas | Dueño de la reserva; administración de reservas | Sin plazo definido (pendiente legal) |
| Avisos por email | `notificaciones` | Notificaciones | El destinatario; el Administrador ve el estado de la cola | Enviados, con error o cancelados: `retencion.notificaciones_meses` (6) |
| Intentos de ingreso (email y fecha) | `login_intentos` | Límite de intentos | Sistema | `retencion.login_intentos_dias` (30) |
| Auditoría (quién hizo qué cambio, sin DNI, contraseñas, direcciones ni motivos de salud) | `auditoria` | Seguridad y trazabilidad | Administrador | `retencion.auditoria_meses` (24) |
| Aceptación de la política | `consentimientos` | Registro del consentimiento | El propio usuario (en su exportación) | Mientras la cuenta exista |
| Sesiones | `sesiones` | Sesión iniciada | Sistema | Vencen por inactividad (`SESSION_TIMEOUT_MINUTES`) |

## Medidas técnicas

- **Consentimiento informado:**
  - La política está en `/privacidad`, es pública y su texto vive en `Galisencia/Frontend/src/components/privacidad/TextoPolitica.tsx`.
  - Hasta aceptar la versión vigente (`privacidad.version_politica` en `config_institucion`), el backend rechaza todo pedido con `403` y el código `debe_aceptar_politica`. Las únicas excepciones son la sesión, el cambio de contraseña, el cierre de sesión y la aceptación.
  - Galisencia muestra la política y pide aceptarla, y Galiservas deriva a Galisencia.
  - Cada aceptación queda en `consentimientos` y en la auditoría. Cambiar la versión vuelve a pedirla a todos.
- **Derecho de acceso (art. 14):**
  - `GET /api/datos_personales.php` descarga en JSON todo lo que el sistema tiene de una cuenta o de un alumno.
  - Lo puede pedir el propio alumno o su tutor desde "Privacidad". La administración, con `datos.exportar`, lo hace desde "Gestión académica" con el botón "Datos".
  - Se audita sin el contenido.
- **Rectificación y supresión:**
  - Se hacen desde la gestión existente: edición de alumnos y usuarios, baja lógica y desvinculación de tutores.
  - La supresión física no está automatizada (pendiente legal: qué se puede borrar y qué hay que conservar).
- **Retención:**
  - `cli/retencion.php` aplica los plazos, que se editan con `PUT /api/config_institucion.php`.
  - El servicio `notificador` la corre sola una vez por día.
  - Cada aplicación queda en la auditoría (`privacidad.retencion`) con la cantidad de registros borrados.
- **Minimización y acceso:**
  - Autorización y alcance por rol en el backend, en cada pedido.
  - Motivo y certificados de salud reservados.
  - La auditoría no guarda DNI, contraseñas, direcciones ni motivos.
  - Sin Gravatar ni servicios externos con datos de alumnos.
- **Seguridad:**
  - Contraseñas con bcrypt y sesiones que vencen por inactividad.
  - Protección CSRF y cabeceras de seguridad.
  - HTTPS con HSTS (`PROXY_MODO=https`).
  - Usuario de base sin permisos de DDL.
  - La PWA no guarda respuestas de la API en el teléfono, y la cola sin conexión guarda solo ids.

## Pendientes para la revisión legal

1. Validar el texto de la política (`TextoPolitica.tsx`): responsable, finalidades, plazos y canal para ejercer los derechos.
2. **Menores de edad:** quién presta el consentimiento (el alumno, su responsable o ambos), desde qué edad, y si alcanza la aceptación en el sistema o hace falta un consentimiento firmado de los responsables.
3. Inscripción de las bases de datos ante la AAIP, si corresponde.
4. Plazos de conservación de datos académicos (asistencias, notas y legajos) según la normativa educativa provincial, y de reservas y auditoría.
5. Tratamiento de los datos de salud (justificaciones), que son datos sensibles (art. 7).
6. Procedimiento y plazos de respuesta para rectificación y supresión, y qué datos no se pueden suprimir por obligación legal.
7. Encargados de tratamiento: hosting, proveedor de email (SMTP) y Google o Microsoft, con sus contratos y la eventual transferencia internacional (art. 12).
