# Instrucciones Docker - Proyecto SSO

El stack levanta los cuatro servicios definidos en `docker-compose.yml`, todos en la red `galisencia-network`:

| Servicio | Build | Puertos | Rol |
|---|---|---|---|
| `mysql` | imagen `mysql:8.0` | interno | Base única `ProyectoEstela`, inicializada con `db/` en orden (00-usuario-app → 01-schema → 02-seed → 03 → 04 → 05) |
| `backend` | `Galisencia/Galileo_Auth` | interno | API JSON PHP + sesión compartida. Se conecta con el usuario `DB_APP_USER`, no con root |
| `backend-dev-port` | imagen `nginx:alpine` | `127.0.0.1:8080` | Solo con `--profile dev`: expone la API para desarrollo local |
| `frontend` | `Galisencia/Frontend` | `3000:80` | React de Galisencia servido por nginx (proxy `/api` → `backend`) |
| `galiservas` | `Galiservas/Frontend` | `5174:80` | React de Galiservas servido por nginx (proxy `/api` → `backend`) |

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

- Galisencia: <http://localhost:3000>
- Galiservas: <http://localhost:5174>
- API vía nginx de cada frontend: <http://localhost:3000/api> y <http://localhost:5174/api>
- Backend directo: <http://localhost:8080> solo con `--profile dev`

El enlace lateral "Galiservas" dentro de Galisencia usa `/galiservas/`. En dev con Vite puntual, se sobreescribe con `VITE_GALISERVAS_URL` (ver `Galisencia/Frontend/.env.example`).

## Variables de build de Galiservas

Se inyectan como `args` en el service `galiservas` del compose:

- `VITE_API_URL=/api` → la SPA llama a `/api/...` y nginx lo proxya a `backend:80`.
- `VITE_GALISENCIA_URL=http://localhost:3000` → botón "Volver a Galisencia".

## Solución de problemas

- **La UI abre pero no persiste nada:** puede estar usando el fallback mock de Galisencia. Verificar en la red o recargar después de escribir, y comprobar `docker compose ps` (los tres services deben estar `running`).
- **Cambios en el código no se reflejan:** reconstruir con `docker compose build` y reiniciar con `docker compose up -d`.
- **Base corrupta o con datos inválidos:** usar `down -v` para reaplicar el seed (destructivo).
- **Volumen creado antes de esta versión (el backend no conecta):** los scripts de `db/` solo corren al crear el volumen, así que falta el usuario de la app y la migración 05. Sin borrar datos:
  ```bash
  docker compose exec mysql bash /docker-entrypoint-initdb.d/00-usuario-app.sh
  docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < db/05-seguridad.sql
  ```
  El volumen tiene que haberse creado con la misma `MYSQL_ROOT_PASSWORD` que hay ahora en `.env`.

## Notas de seguridad

- No hay contraseñas en el repositorio: todas salen de `.env` (ver `.env.example`).
- El backend usa un usuario MySQL sin permisos de DDL; root queda solo para administrar.
- Las cuentas demo (`demo1234`) deben cambiar la contraseña en el primer ingreso.
- No exponer el puerto de MySQL externamente en producción.
- Considerar HTTPS/TLS para producción; con HTTPS, usar `APP_ENV=prod` y descomentar HSTS en los `nginx.conf`.