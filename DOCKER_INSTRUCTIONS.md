# Instrucciones Docker - Proyecto SSO

`docker-compose.yml` define cinco servicios en la red `galisencia-network`. Por defecto levanta cuatro; `backend-dev-port` solo con `--profile dev`:

| Servicio | Build | Puertos | Rol |
|---|---|---|---|
| `mysql` | imagen `mysql:8.0` | interno | Base única `ProyectoEstela`, inicializada con `db/` en orden (00-usuario-app → 01-schema → 02-seed → 03 → … → 17) |
| `backend` | `Galisencia/Galileo_Auth` | interno | API JSON PHP. Se conecta con el usuario `DB_APP_USER`, no con root. Sesiones en MySQL (`SESSION_STORE=db`), así que admite varias réplicas |
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

Las dos apps están en el mismo origen, así que comparten la cookie de sesión. El enlace lateral "Galiservas" abre `/galiservas/` y "Volver a Galisencia" abre `/`.

## Varias réplicas del backend

Las sesiones se guardan en MySQL (tabla `sesiones`), no en el disco del contenedor, así que el backend se puede escalar sin perder la sesión:

```bash
docker compose up -d --scale backend=2
```

El proxy reparte los pedidos entre las réplicas y vuelve a resolver sus IPs solo.

## HTTPS

1. Copiar el certificado y la clave como `fullchain.pem` y `privkey.pem` en una carpeta (por defecto `proxy/certs/`, que no se versiona) o indicar otra con `TLS_CERT_DIR`.
2. En `.env`: `PROXY_MODO=https`, `PROXY_PUERTO=80`, `PROXY_PUERTO_HTTPS=443` y `APP_ENV=prod` (cookie `Secure`).
3. `docker compose up -d proxy backend`.

El proxy redirige HTTP a HTTPS y agrega HSTS (`proxy/https.conf`). La redirección asume el puerto 443 estándar.

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

## Notas de seguridad

- No hay contraseñas en el repositorio: todas salen de `.env` (ver `.env.example`).
- El backend usa un usuario MySQL sin permisos de DDL; root queda solo para administrar.
- Las cuentas demo (`demo1234`) deben cambiar la contraseña en el primer ingreso.
- No exponer el puerto de MySQL externamente en producción.
- Considerar HTTPS/TLS para producción; con HTTPS, usar `APP_ENV=prod` y descomentar HSTS en los `nginx.conf`.