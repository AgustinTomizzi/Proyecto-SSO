# Docker - Proyecto SSO

## Servicios

`docker-compose.yml` levanta tres servicios activos:

| Servicio | Implementación | Acceso |
|---|---|---|
| `mysql` | MySQL 8, base `ProyectoEstela` | Solo red interna |
| `backend` | PHP 8.2 + Apache (`Galisencia/Galileo_Auth`) | Solo red interna |
| `frontend` | React compilado + nginx | `http://localhost:3000` |

Nginx sirve la aplicación y proxea `/api/` hacia `backend:80/api/`.

## Levantar el stack

```bash
docker compose up --build -d
docker compose ps
```

Abrir `http://localhost:3000`. El puerto puede cambiarse con `FRONTEND_PORT`, por ejemplo:

```powershell
$env:FRONTEND_PORT="3001"
docker compose -p galisencia-prueba up --build -d
```

La primera creación del volumen ejecuta, en orden:

```text
db/01-schema.sql
db/02-seed.sql
db/03-migracion-rbac-auditoria.sql
```

## Logs

```bash
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f mysql
```

## Reconstruir

```bash
docker compose up --build -d
```

## Detener

```bash
docker compose down
```

## Reinicializar la base de desarrollo

```bash
docker compose down -v
docker compose up --build -d
```

El flag `-v` elimina el volumen MySQL y todos sus datos. Solo debe usarse sobre entornos descartables.

## Pruebas de integración

```bash
node tests/api.test.mjs
```

La URL por defecto es `http://localhost:3000/api`. Puede cambiarse con `API_URL`.

## Solución de problemas

### El frontend no responde

1. Comprobar que el puerto `3000` esté libre.
2. Ejecutar `docker compose ps`.
3. Revisar `docker compose logs frontend`.

### El backend no está saludable

1. Revisar `docker compose logs backend`.
2. Confirmar que MySQL esté saludable con `docker compose ps mysql`.
3. Verificar las variables `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `docker-compose.yml`.

### Faltan tablas, columnas o permisos

Las migraciones de `/docker-entrypoint-initdb.d` solo se ejecutan al crear un volumen vacío. En desarrollo descartable, reinicializar con `docker compose down -v`.

## Seguridad

Las credenciales incluidas son únicamente para desarrollo. En producción deben reemplazarse por secretos, habilitar HTTPS y evitar exponer MySQL públicamente.
