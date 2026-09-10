# Pruebas de integración

Estas pruebas validan autenticación, RBAC, alcance por curso, auditoría, reservas de Galiservas (con stock) y re-autenticación del preceptor contra el stack Docker real.

Usar una base exclusiva de prueba: `down -v` vuelve a aplicar el esquema, el seed y las migraciones 01-04. El script restaura la asignación de curso que modifica, pero la auditoría es append-only.

```powershell
docker compose down -v
docker compose up --build -d
$env:API_URL = "http://localhost:3000/api"
node tests/api.test.mjs
```

La URL puede cambiarse con `API_URL`, por ejemplo:

```powershell
$env:API_URL="http://localhost:3000/api"
node tests/api.test.mjs
```

No ejecutar `docker compose down -v` sobre una base que contenga datos que deban conservarse.
