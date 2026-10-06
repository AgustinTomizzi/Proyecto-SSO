# Autenticación intercambiable

El login está aislado detrás de dos interfaces, una en el backend y otra en el frontend, para poder reemplazar el email y contraseña locales por un proveedor de identidad institucional (OIDC: Keycloak, Google Workspace o Microsoft Entra ID) sin tocar el resto del sistema.

## Cómo está armado hoy

### Backend (`Galisencia/Galileo_Auth/includes/autenticacion.php`)

Verificar quién es la persona y abrir la sesión son dos pasos separados:

1. **`ProveedorAutenticacion::autenticar($email, $password)`** devuelve el usuario (fila de `usuarios` con su rol) o `null`. El único proveedor implementado es `AutenticacionLocal`: compara contra el hash bcrypt de `usuarios.contrasena` y tarda lo mismo si la cuenta no existe. `auth_proveedor()` elige el proveedor con la variable `AUTH_PROVIDER` (por defecto `local`).
2. **`auth_iniciar_sesion($usuario)`** regenera el ID de sesión y carga `$_SESSION`. **`auth_cerrar_sesion()`** la destruye.

`api/login.php` aplica el límite de intentos, llama al proveedor y abre la sesión. Todo lo demás no depende de cómo se autenticó la persona:

- el rol y los permisos se releen de la base en cada request (`api_rol_actual()`);
- el alcance y la auditoría;
- las sesiones en MySQL;
- `debe_cambiar_password`.

### Frontend (`Galisencia/Frontend/src/auth/adaptador.ts`)

`AuthContext` solo usa la interfaz `AdaptadorAutenticacion` (`iniciarSesion`, `restaurarSesion`, `cerrarSesion`, `cambiarPassword`). El adaptador `local` llama a `login.php`, `sesion.php`, `logout.php` y `cambiar_password.php`. `VITE_AUTH_MODO` elige el adaptador (por defecto `local`). Galiservas no tiene login propio: delega en Galisencia (login único), así que no cambia.

## Cómo pasar a OIDC

La identidad la da el proveedor externo; **los roles siguen en la base**. Una persona solo entra si ya existe en `usuarios` (alta hecha por un Administrador), lo que evita que cualquier cuenta del dominio obtenga acceso.

1. **Registrar la aplicación** en el proveedor:
   - Keycloak: cliente confidencial.
   - Google: credencial OAuth "Aplicación web".
   - Microsoft Entra ID: registro de aplicación.

   URI de redirección: `https://<dominio>/api/oidc_callback.php`. Scopes: `openid email profile`.
2. **Variables de entorno del backend** (en `.env` y `docker-compose.yml`): `AUTH_PROVIDER=oidc`, `OIDC_ISSUER` (por ejemplo `https://accounts.google.com` o `https://<keycloak>/realms/<realm>`), `OIDC_CLIENT_ID` y `OIDC_CLIENT_SECRET`. El secreto nunca va en el repo.
3. **Dependencia**: una librería OIDC mantenida, por ejemplo `jumbojett/openid-connect-php` vía Composer, en lugar de validar tokens a mano.
4. **Endpoints nuevos**:
   - `api/oidc_login.php`: genera `state`, `nonce` y PKCE, los guarda en la sesión y redirige al proveedor.
   - `api/oidc_callback.php`: valida `state`, canjea el código, verifica la firma del `id_token` con el JWKS del emisor, `iss`, `aud`, `exp` y `nonce`, y exige `email_verified`. Busca el usuario con `auth_buscar_usuario_por_email()` (o por un `sub` guardado en una columna nueva) y, si existe, llama a `auth_iniciar_sesion()`. Si no existe, responde con un error genérico y lo audita.
5. **Proveedor en `auth_proveedor()`**: con `AUTH_PROVIDER=oidc`, `login.php` debe rechazar email y contraseña (`405` o un mensaje que indique usar el inicio de sesión institucional).
6. **Frontend**:
   - Un `adaptadorOidc` en `adaptador.ts`: `iniciarSesion` navega a `/api/oidc_login.php?next=…`, y `restaurarSesion` y `cerrarSesion` siguen usando `sesion.php` y `logout.php`.
   - `cambiarPassword` no aplica, porque la contraseña la gestiona el proveedor.
   - Con `VITE_AUTH_MODO=oidc` el botón "Ingresar con tu cuenta galileo." del login inicia el flujo.
7. **Cierre de sesión en el proveedor** (opcional): después de `auth_cerrar_sesion()`, redirigir al `end_session_endpoint` del emisor.
8. **Pruebas**:
   - En `tests/api.test.mjs`, un test con un proveedor de prueba que verifique que un usuario inexistente no entra, que uno existente obtiene su rol de la base y que `state` y `nonce` inválidos se rechazan.
   - Para desarrollo, un Keycloak local en un perfil de Docker.

## Qué no cambia

El orden de controles de cada endpoint, el límite de intentos (se aplica al formulario local), el CSRF por header, las cabeceras de seguridad, el cierre por inactividad y el login único entre Galisencia y Galiservas.
