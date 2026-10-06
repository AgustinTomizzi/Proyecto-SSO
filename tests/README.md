# Pruebas de integración

Estas pruebas validan autenticación, RBAC, alcance por curso, auditoría, reservas de Galiservas (con stock) y re-autenticación del preceptor contra el stack Docker real.

Los datos de demo (`12-actividad-demo.sql`) dependen de la fecha de creación de la base, por eso los tests comprueban propiedades (alcance, totales coherentes) en lugar de cantidades fijas de asistencias.

Usar una base exclusiva de prueba: `down -v` vuelve a aplicar el esquema, el seed y las migraciones de `db/`. El script restaura la asignación de curso que modifica, pero la auditoría es append-only.

Las cuentas demo arrancan con `debe_cambiar_password`: en el primer login el script cambia `demo1234` por `Integracion-2026!` (configurable con `TEST_PASSWORD`). Después de una corrida, esas cuentas ya no entran con `demo1234`.

```powershell
docker compose down -v
docker compose up --build -d
node tests/api.test.mjs
```

Por defecto usa `http://localhost:3000/api` (el proxy de entrada). Para otra URL:

```powershell
$env:API_URL = "http://localhost:8080/api"   # backend del perfil dev
node tests/api.test.mjs
```

No ejecutar `docker compose down -v` sobre una base que contenga datos que deban conservarse.

## PWA

`tests/pwa.test.mjs` abre Galisencia en Chrome headless con un perfil temporal y comprueba que el service worker se active y controle la página, que la caché tenga solo la aplicación (ninguna respuesta de `/api/`) y que la app cargue sin conexión. Necesita Chrome, Edge o Chromium (`CHROME_PATH` para indicar la ruta); si no los encuentra, avisa y termina sin fallar.

```powershell
$env:BASE_URL = "http://localhost:3000"
node tests/pwa.test.mjs
```
