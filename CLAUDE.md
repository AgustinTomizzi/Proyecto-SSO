# Proyecto-SSO (Galisencia + Galiservas)

Monorepo escolar con dos SPA React y una API PHP/MySQL compartida (login y RBAC únicos).
Idioma de la UI, mensajes de error y docs: español rioplatense.

## Estructura
- `Galisencia/Frontend`: React 19 + TypeScript + Vite (dev 5173, Docker 3000)
- `Galiservas/Frontend`: React 19 + TypeScript + Vite (dev y Docker 5174)
- `Galisencia/Galileo_Auth`: PHP 8.2 + PDO. API JSON en `api/*.php`; helpers en `includes/` (auth, permisos, auditoria); `config/database.php`
- `db/`: SQL en orden numérico. Docker los aplica solos en `initdb`
- `tests/api.test.mjs`: pruebas de integración contra el stack Docker
- `docs/`: documentación. Debe quedar siempre sincronizada con el código

## Comandos
```
docker compose up --build -d
API_URL=http://localhost:3000/api node tests/api.test.mjs      # PowerShell: $env:API_URL="http://localhost:3000/api"
cd Galisencia/Frontend && npm ci && npm run lint && npm run build
cd Galiservas/Frontend && npm ci && npm run lint && npm run build
```
`docker compose down -v` BORRA la base: pedir confirmación antes de correrlo.

## Reglas no negociables
1. **Autorización solo en el backend.** Orden obligatorio en cada endpoint (ver `docs/ROLES_Y_PERMISOS.md`): sesión (401) → permiso (403) → alcance (curso/propio/institucional) → validación → transacción si hay concurrencia → auditoría → respuesta JSON consistente.
2. El **rol y los permisos se leen de la base en cada request**. Nunca decidir alcance con `$_SESSION["rol"]` sin refrescar.
3. Consultas siempre con prepared statements. Nunca mostrar errores PDO ni hashes al cliente.
4. Cero secretos en el repo. Todo va por variables de entorno y `.env.example`.
5. La auditoría no guarda datos sensibles innecesarios (DNI, contraseñas, direcciones).
6. Zona horaria única: `America/Argentina/Buenos_Aires` (PHP, MySQL y frontend). No usar `toISOString()` para fechas "de hoy".
7. Cambios de esquema: archivo SQL nuevo, numerado, idempotente. Si cambia el esquema canónico, actualizar también `01-schema.sql` y `02-seed.sql`.
8. Toda funcionalidad nueva lleva: test en `tests/api.test.mjs`, actualización de `docs/API.md` y, si toca permisos, de `docs/ROLES_Y_PERMISOS.md`.
9. No depender de datos mock cuando hay sesión activa: si la API falla, avisar al usuario.

## Forma de trabajar
- Una tarea a la vez, siguiendo `PLAN_CAMBIOS.md`. Commits chicos con mensajes claros.
- Antes de borrar un archivo, buscar referencias con `grep -r`.
- Después de cada tarea: lint, build de ambos frontends y tests de integración. Si algo no se pudo ejecutar, decirlo explícitamente.
- No inventar endpoints ni columnas: leer primero el código y `db/`.
