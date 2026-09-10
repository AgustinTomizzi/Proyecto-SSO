# Pruebas de integración

Estas pruebas validan autenticación, RBAC, alcance por curso y auditoría contra el stack Docker real.

Usar una base exclusiva de prueba: el script restaura la asignación de curso que modifica, pero la auditoría es append-only.

```powershell
docker compose down -v
docker compose up --build -d
node tests/api.test.mjs
```

La URL puede cambiarse con `API_URL`, por ejemplo:

```powershell
$env:API_URL="http://localhost:3000/api"
node tests/api.test.mjs
```

No ejecutar `docker compose down -v` sobre una base que contenga datos que deban conservarse.
