# Instrucciones Docker - Proyecto SSO

`docker-compose.yml` define cinco servicios en la red `galisencia-network`. Por defecto levanta cuatro; `backend-dev-port` solo con `--profile dev`:

| Servicio | Build | Puertos | Rol |
|---|---|---|---|
| `mysql` | imagen `mysql:8.0` | interno | Base única `ProyectoEstela`, inicializada con `db/` en orden (00-usuario-app → 01-schema → 02-seed → 03 → … → 21) |
| `backend` | `Galisencia/Galileo_Auth` | interno | API JSON PHP. Se conecta con el usuario `DB_APP_USER`, no con root. Sesiones en MySQL (`SESSION_STORE=db`), así que admite varias réplicas |
| `notificador` | `Galisencia/Galileo_Auth` (misma imagen) | interno | Worker de notificaciones por email: corre `cli/enviar_notificaciones.php --loop` y envía la cola por SMTP (`SMTP_*` en `.env`) |
| `mailpit` | imagen `axllent/mailpit` | `127.0.0.1:${MAILPIT_PUERTO:-8025}` | Solo desarrollo: buzón de prueba donde llegan los mails del notificador; no salen a Internet |
| `oidc-prueba` | imagen `node:22-alpine` + `tools/oidc-prueba` | `127.0.0.1:${OIDC_PRUEBA_PUERTO:-9100}` | Solo con `--profile oidc-prueba`: proveedor OIDC de prueba para el ingreso institucional sin Internet (ver `docs/AUTENTICACION.md`) |
| `backup` | imagen `mysql:8.0` + `deploy/backup/respaldar.sh` | interno | Backup diario de la base (`BACKUP_HORA`) en `BACKUP_DIR`: 14 diarios y 6 mensuales |
| `backend-dev-port` | imagen `nginx:alpine` | `127.0.0.1:8080` | Solo con `--profile dev`: expone la API para desarrollo local |
| `frontend` | `Galisencia/Frontend` | interno | React de Galisencia servido por nginx |
| `galiservas` | `Galiservas/Frontend` | interno | React de Galiservas (base `/galiservas/`) servido por nginx |
| `proxy` | imagen `nginx:alpine` + `proxy/` | `${PROXY_PUERTO:-3000}` (y `${PROXY_PUERTO_HTTPS:-3443}`) | Único punto de entrada: `/` → Galisencia, `/galiservas/` → Galiservas, `/api/` → backend |

## Uso

### Credenciales (una sola vez)
```bash
cp .env.example .env
```
Editar `.env` y poner contraseñas largas en `MYSQL_ROOT_PASSWORD` y `DB_APP_PASSWORD`. Si falta alguna, `docker compose` se niega a arrancar. `.env` está en `.gitignore`.

Otras variables opcionales de `.env`: `APP_ENV` (`dev` por defecto; `prod` marca la cookie como `Secure` y requiere HTTPS), `CORS_ALLOWED_ORIGINS` (orígenes permitidos en producción) y `SESSION_TIMEOUT_MINUTES` (inactividad, 30 por defecto).

### Construir y ejecutar todo el stack
```bash
docker compose up --build -d
```

### Exponer la API en el puerto 8080 (solo desarrollo)
```bash
docker compose --profile dev up --build -d
```
Publica la API en `http://127.0.0.1:8080/api`, que es el valor por defecto de Galiservas con `npm run dev`. Sin el profile, el backend no publica ningún puerto.

### Verificar servicios
```bash
docker compose ps
```

### Ver logs
```bash
docker compose logs -f backend
```

### Detener
```bash
docker compose down
```

### Reiniciar la base (borra datos del volumen y reaplica esquema + seed)
```bash
docker compose down -v
docker compose up --build -d
```

> No ejecutar `docker compose down -v` sobre una base que contenga datos que deban conservarse.

## URLs

- Galisencia: <http://localhost:3000/>
- Galiservas: <http://localhost:3000/galiservas/>
- API: <http://localhost:3000/api/>
- Backend directo: <http://localhost:8080> solo con `--profile dev`
- Mails de prueba (Mailpit): <http://localhost:8025>

Las dos apps están en el mismo origen, así que comparten la cookie de sesión. El enlace lateral "Galiservas" abre `/galiservas/` y "Volver a Galisencia" abre `/`.

## Varias réplicas del backend

Las sesiones se guardan en MySQL (tabla `sesiones`), no en el disco del contenedor, así que el backend se puede escalar sin perder la sesión:

```bash
docker compose up -d --scale backend=2
```

El proxy reparte los pedidos entre las réplicas y vuelve a resolver sus IPs solo.

## Ingreso institucional (OIDC)

Las credenciales de Google o Microsoft van en `.env` (`OIDC_*`, ver `.env.example` y `docs/AUTENTICACION.md`), junto con `APP_URL`, la URL pública con la que se registra el redirect_uri. La librería OIDC se instala con Composer al construir la imagen del backend (etapa `dependencias`), así que `vendor/` no se versiona.

Para probar sin credenciales reales, usar el proveedor de prueba: en `.env` poner `OIDC_PRUEBA_ISSUER=http://oidc-prueba:9100`, `OIDC_PRUEBA_CLIENT_ID=galileo-pruebas` y `OIDC_PRUEBA_CLIENT_SECRET` con cualquier valor, y levantar con `docker compose --profile oidc-prueba up -d`. Nunca en producción: el backend lo ignora con `APP_ENV=prod`.

## Backups

- **Qué hace:** el servicio `backup` hace todos los días, a las `BACKUP_HORA` (03:00), un `mysqldump` consistente (`--single-transaction`) comprimido en `BACKUP_DIR/diario` (`./backups`).
- **Cuántos conserva:** `BACKUP_DIAS` diarios (14) y `BACKUP_MESES` mensuales (6), en `mensual/`, copiados el día 1.
- **Al arrancar:** si todavía no hay ninguno, hace uno.
- **Estado:** el resultado queda en `BACKUP_DIR/estado.json` y se ve en "Estado del sistema".

Respaldo manual:

```bash
docker compose exec backup sh /respaldar.sh --ahora
```

Restaurar (reemplaza la base; antes guarda un respaldo de seguridad en `backups/seguridad/` y pide escribir `RESTAURAR`):

```bash
bash deploy/backup/restaurar.sh backups/diario/galileo-20261007-030000.sql.gz
docker compose restart backend notificador
```

Los backups quedan en el mismo equipo que la base. Copiarlos a otro lugar (otra PC, un disco, la nube) de vez en cuando protege ante la pérdida del equipo.

## Monitoreo

- **"Estado del sistema" (Administrador):** muestra el último backup, la base, el disco, la cola de emails, las sesiones activas y la retención, con alertas.
- **Monitor externo:** `GET /api/salud.php` responde `200` o `503`. Para recibir un aviso si el sitio se cae, configurar un monitor gratuito (por ejemplo UptimeRobot, tipo HTTP(s), cada 5 minutos) apuntando a `https://<dominio>/api/salud.php`.
- **Logs:** acotados a 10 MB × 3 por servicio (`x-logging`). Se ven con `docker compose logs -f <servicio>`.

## Retención de datos

El servicio `notificador` aplica una vez por día los plazos de retención (`retencion.*` en `config_institucion`). Para correrla a mano: `docker compose exec backend php /var/www/html/cli/retencion.php`. Detalle en `docs/PROTECCION_DE_DATOS.md`.

## HTTPS

1. Copiar el certificado y la clave como `fullchain.pem` y `privkey.pem` en una carpeta (por defecto `proxy/certs/`, que no se versiona) o indicar otra con `TLS_CERT_DIR`.
2. En `.env`: `PROXY_MODO=https`, `PROXY_PUERTO=80`, `PROXY_PUERTO_HTTPS=443` y `APP_ENV=prod` (cookie `Secure`).
3. `docker compose up -d proxy backend`.

El proxy redirige HTTP a HTTPS y agrega HSTS (`proxy/https.conf`). La redirección asume el puerto 443 estándar.

La PWA (instalar Galisencia en el celular y su modo sin conexión) necesita HTTPS: los navegadores solo registran service workers en HTTPS o en `localhost`.

## Zona horaria

Todo el sistema usa `America/Argentina/Buenos_Aires`: PHP (`date.timezone` en `docker/php-seguridad.ini` y `config/database.php`), MySQL (`TZ` y `--default-time-zone=-03:00`, más `SET time_zone` en cada conexión) y los frontends (`hoyLocal()` en `Galisencia/Frontend/src/data/fecha.ts` y `Galiservas/Frontend/src/fecha.ts`). Así "hoy" es la fecha argentina aunque en UTC ya sea el día siguiente (desde las 21:00).

## Variables de build de Galiservas

Se inyectan como `args` en el service `galiservas` del compose:

- `VITE_API_URL=/api` → la SPA llama a `/api/...` en el mismo origen y el proxy lo envía a `backend:80`.
- `VITE_GALISENCIA_URL=/` → "Volver a Galisencia".

## Solución de problemas

- **Aparece "Sin conexión con el servidor":** el frontend no llega a la API. Comprobar `docker compose ps` (`mysql`, `backend`, `frontend`, `galiservas` y `proxy` deben estar `running`/`healthy`) y `docker compose logs backend`.
- **Cambios en el código no se reflejan:** reconstruir con `docker compose build` y reiniciar con `docker compose up -d`.
- **Base corrupta o con datos inválidos:** usar `down -v` para reaplicar el seed (destructivo).
- **Volumen creado antes de esta versión (el backend no conecta):** los scripts de `db/` solo corren al crear el volumen, así que falta el usuario de la app, la migración 05 y, si el volumen es anterior a los horarios, también la 04. Sin borrar datos:
  ```bash
  docker compose exec mysql bash /docker-entrypoint-initdb.d/00-usuario-app.sh
  docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < db/04-horarios.sql
  docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < db/05-seguridad.sql
  ```
  El volumen tiene que haberse creado con la misma `MYSQL_ROOT_PASSWORD` que hay ahora en `.env`.
- **Volumen existente y migraciones nuevas:** las migraciones de `db/` son idempotentes; para sumar las nuevas a una base que ya tiene datos, aplicarlas en orden (por ejemplo de la 13 a la 21):
  ```bash
  for f in db/{1[3-9],2[01]}-*.sql; do docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < "$f"; done
  ```
- **No llegan los mails:** `docker compose logs notificador`. Con `SMTP_HOST` vacío el envío está deshabilitado y las notificaciones quedan en la cola; el Administrador ve el estado en `GET /api/notificaciones.php?cola=1`.

## Notas de seguridad

- No hay contraseñas en el repositorio: todas salen de `.env` (ver `.env.example`).
- El backend usa un usuario MySQL sin permisos de DDL; root queda solo para administrar.
- Apache solo sirve `/api`: `includes/`, `config/` y `cli/` responden `403` aunque se llegue directo al backend (`docker/apache-seguridad.conf`). El worker además se niega a correr fuera de la línea de comandos.
- Las cuentas demo (`demo1234`) deben cambiar la contraseña en el primer ingreso.
- No exponer el puerto de MySQL externamente en producción.
- Considerar HTTPS/TLS para producción; con HTTPS, usar `APP_ENV=prod` y descomentar HSTS en los `nginx.conf`.