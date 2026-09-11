# Instrucciones Docker - Proyecto SSO

El stack levanta los cuatro servicios definidos en `docker-compose.yml`, todos en la red `galisencia-network`:

| Servicio | Build | Puertos | Rol |
|---|---|---|---|
| `mysql` | imagen `mysql:8.0` | interno | Base única `ProyectoEstela`, inicializada con `db/` (01-schema → 02-seed → 03) |
| `backend` | `Galisencia/Galileo_Auth` | `8080:80` | API JSON PHP + páginas PHP + sesión compartida |
| `frontend` | `Galisencia/Frontend` | `3000:80` | React de Galisencia servido por nginx (proxy `/api` → `backend`) |
| `galiservas` | `Galiservas/Frontend` | `5174:80` | React de Galiservas servido por nginx (proxy `/api` → `backend`) |

## Uso

### Construir y ejecutar todo el stack
```bash
docker compose up --build -d
```

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
- Backend/API PHP: <http://localhost:8080>

El enlace lateral "Galiservas" dentro de Galisencia usa `/galiservas/`. En dev con Vite puntual, se sobreescribe con `VITE_GALISERVAS_URL` (ver `Galisencia/Frontend/.env.example`).

## Variables de build de Galiservas

Se inyectan como `args` en el service `galiservas` del compose:

- `VITE_API_URL=/api` → la SPA llama a `/api/...` y nginx lo proxya a `backend:80`.
- `VITE_GALISENCIA_URL=http://localhost:3000` → botón "Volver a Galisencia".

## Solución de problemas

- **La UI abre pero no persiste nada:** puede estar usando el fallback mock de Galisencia. Verificar en la red o recargar después de escribir, y comprobar `docker compose ps` (los tres services deben estar `running`).
- **Cambios en el código no se reflejan:** reconstruir con `docker compose build` y reiniciar con `docker compose up -d`.
- **Base corrupta o con datos inválidos:** usar `down -v` para reaplicar el seed (destructivo).

## Notas de seguridad

- Las credenciales de `docker-compose.yml` son solo para desarrollo.
- No exponer el puerto de MySQL externamente en producción.
- Considerar HTTPS/TLS para producción.