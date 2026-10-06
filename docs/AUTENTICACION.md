# Autenticación intercambiable

El login está aislado detrás de dos interfaces, una en el backend y otra en el frontend, para poder reemplazar el email y contraseña locales por un proveedor de identidad institucional (OIDC: Keycloak, Google Workspace o Microsoft Entra ID) sin tocar el resto del sistema.

## Cómo está armado hoy

### Backend (`Galisencia/Galileo_Auth/includes/autenticacion.php`)

Verificar quién es la persona y abrir la sesión son dos pasos separados:

1. **`ProveedorAutenticacion::autenticar($email, $password)`** devuelve el usuario (fila de `usuarios` con su rol) o `null`. El proveedor de formulario es `AutenticacionLocal`; el ingreso institucional va por OIDC (ver abajo): compara contra el hash bcrypt de `usuarios.contrasena` y tarda lo mismo si la cuenta no existe. `auth_proveedor()` elige el proveedor con la variable `AUTH_PROVIDER` (por defecto `local`).
2. **`auth_iniciar_sesion($usuario)`** regenera el ID de sesión y carga `$_SESSION`. **`auth_cerrar_sesion()`** la destruye.

`api/login.php` aplica el límite de intentos, llama al proveedor y abre la sesión. Todo lo demás no depende de cómo se autenticó la persona:

- el rol y los permisos se releen de la base en cada request (`api_rol_actual()`);
- el alcance y la auditoría;
- las sesiones en MySQL;
- `debe_cambiar_password`.

### Frontend (`Galisencia/Frontend/src/auth/adaptador.ts`)

`AuthContext` solo usa la interfaz `AdaptadorAutenticacion` (`iniciarSesion`, `restaurarSesion`, `cerrarSesion`, `cambiarPassword`). El adaptador `local` llama a `login.php`, `sesion.php`, `logout.php` y `cambiar_password.php`. `VITE_AUTH_MODO` elige el adaptador (por defecto `local`). Galiservas no tiene login propio: delega en Galisencia (login único), así que no cambia.

## Ingreso institucional (OIDC), implementado

La identidad la da el proveedor externo; **los roles siguen en la base**. Una persona solo entra si ya existe en `usuarios` (alta hecha por la escuela), lo que evita que cualquier cuenta del dominio obtenga acceso.

### Modo mixto

Con `AUTH_PROVIDER=local` (por defecto) siguen el email y la contraseña, y además el login muestra "Ingresar con Google" o "Ingresar con Microsoft" para los proveedores configurados. Con `AUTH_PROVIDER=oidc`, `login.php` rechaza el formulario (`405`, código `login_local_deshabilitado`) y solo se entra por el proveedor.

### Configuración (`.env`)

- `APP_URL`: URL pública, por ejemplo `https://escuela.edu.ar`. El redirect_uri que hay que registrar es `{APP_URL}/api/oidc_callback.php`.
- **Google Workspace:**
  - En Google Cloud, crear una credencial OAuth "Aplicación web" con ese redirect_uri.
  - Cargar `OIDC_GOOGLE_CLIENT_ID` y `OIDC_GOOGLE_CLIENT_SECRET`.
  - Conviene restringir la pantalla de consentimiento al dominio de la escuela ("Interno").
- **Microsoft Entra ID:**
  - Registrar una aplicación web con ese redirect_uri.
  - Cargar `OIDC_MICROSOFT_TENANT` (el **ID** del tenant, un GUID, para que el `iss` del token coincida), `OIDC_MICROSOFT_CLIENT_ID` y `OIDC_MICROSOFT_CLIENT_SECRET`.
  - Microsoft no informa `email_verified`: dentro del tenant institucional se toma `email` o `preferred_username` como verificado, porque esas cuentas las administra la escuela.

Los secretos nunca van al repo.

### Cómo funciona

1. `GET /api/oidc_proveedores.php` (público) lista los botones a mostrar: `id` y `etiqueta`, sin client_id ni secretos.
2. `GET /api/oidc_login.php?proveedor=google&next=/preceptor`:
   - Guarda el proveedor y el destino en la sesión. El destino solo puede ser una ruta interna; otra cosa vuelve a `/`.
   - Redirige al proveedor con `state`, `nonce` y PKCE `S256`.
3. `GET /api/oidc_callback.php`:
   - Compara `state` antes de canjear el código.
   - La librería `jumbojett/openid-connect-php` (Composer, instalada en la etapa `dependencias` del Dockerfile) verifica la firma con el JWKS, `iss`, `aud`, `exp` y `nonce`. Además se exige que el token traiga `nonce` y `sub`.
   - La cuenta se busca por `(proveedor, sub)` en `usuario_identidades`. Si no está, por email verificado, y se vincula. Los siguientes ingresos entran por `sub` aunque cambie el email.
   - Abre la sesión con `auth_iniciar_sesion()` y marca `auth_metodo=oidc`. A esa sesión no se le exige cambiar la contraseña local: `sesion.php` devuelve `debeCambiarPassword: false` y `metodoIngreso: "oidc"`.
   - Redirige al destino. Audita `auth.oidc` (con `identidad_vinculada`) y los rechazos como `auth.oidc_rechazado`, con el motivo y el dominio, sin el email completo.
4. **Errores:** van a `/login?error=oidc_<código>`, y el login muestra un mensaje.

| Código | Cuándo |
|---|---|
| `sin_cuenta` | No hay cuenta, o el email no está verificado. |
| `estado` | `state` inválido. |
| `sesion` | Se volvió al callback sin un flujo iniciado. |
| `verificacion` | El token no se pudo verificar. |
| `cancelado` | El proveedor devolvió error. |
| `proveedor` | Ese proveedor no está configurado. |
| `proveedor_no_disponible` | El proveedor no respondió. |

### Proveedor de prueba

`tools/oidc-prueba/servidor.mjs` es un proveedor mínimo (Node, sin dependencias):

- Discovery, JWKS, `authorize` con PKCE, `token` con `id_token` firmado RS256 y `userinfo`.
- "Inicia sesión" cualquier email, sin contraseña.
- Un email con `+noverificado` sale con `email_verified=false`.

Corre en el perfil `oidc-prueba` de Compose. El stack de pruebas (`/cerrar-tarea`) y el CI lo levantan, así `tests/api.test.mjs` prueba el flujo completo:

- Un usuario existente entra con su rol de la base.
- Por `sub` en el segundo ingreso.
- Sin cuenta o con email no verificado, no entra.
- `state` inválido y `next` externo se rechazan.

**El backend lo ignora con `APP_ENV=prod`.**

## Qué no cambia

El orden de controles de cada endpoint, el límite de intentos (se aplica al formulario local), el CSRF por header, las cabeceras de seguridad, el cierre por inactividad y el login único entre Galisencia y Galiservas.
