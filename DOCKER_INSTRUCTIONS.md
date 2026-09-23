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
## Actualización de retiros e incidentes

En una instalación nueva, el archivo `db/04-retiros-incidentes.sql` se aplica al crear el volumen de MySQL. Si ya usás Docker con datos, **conservá el volumen** y aplicá la migración una vez:

```bash
docker compose up --build -d
docker compose exec -T mysql mysql -u root -prootpassword ProyectoEstela < db/04-retiros-incidentes.sql
```

Si usás PowerShell en Windows, el mismo paso se hace así (desde la carpeta del proyecto):

```powershell
docker compose up --build -d
Get-Content -Raw .\db\04-retiros-incidentes.sql | docker compose exec -T mysql mysql -u root -prootpassword ProyectoEstela
```

En Galiservas (`http://localhost:5174`), un Administrador registra el retiro desde **Reservas**: cantidad entregada y, si falta alguna, el motivo. En **Reportes** se puede elegir un mes para comparar solicitado, entregado y faltantes registrados. Las reservas sin retiro siguen pendientes de entrega; no se contabilizan como faltantes. Cada usuario puede informar fallas de equipos relacionados con sus propias reservas en **Problemas con PC**; un Administrador puede informar fallas sin reserva y registrar la resolución. El inventario actual es la capacidad del recurso, no un histórico mensual. Las solicitudes rechazadas por falta de capacidad antes de crear la reserva todavía no quedan registradas como demanda.
