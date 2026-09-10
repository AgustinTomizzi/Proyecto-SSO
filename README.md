# Proyecto SSO

Monorepo de los sistemas escolares **Galisencia** (asistencia y gestión académica) y **Galiservas** (reserva de aulas), con una sesión compartida.

## Arquitectura activa

```text
db/                              # Esquema, seed y migraciones MySQL
Galisencia/
├── Frontend/                    # React + TypeScript + Vite
│   └── public/galiservas/       # Prototipo integrado de Galiservas
└── Galileo_Auth/                # Backend PHP activo
    ├── api/                     # Endpoints JSON
    ├── config/                  # Conexión PDO
    └── includes/                # Auth, RBAC, scope y auditoría
docker-compose.yml               # MySQL + backend + frontend/nginx
tests/                           # Pruebas de integración de la API
```

El frontend se sirve en `http://localhost:3000`. Nginx reenvía `/api/*` al backend PHP dentro de la red Docker.

## Inicio rápido

```bash
docker compose up --build -d
```

Usuarios demo (contraseña `demo1234`):

| Rol | Email |
|---|---|
| Administrador | `admin@galileo.edu.ar` |
| Preceptor | `preceptor@galileo.edu.ar` |
| Directivo | `directivo@galileo.edu.ar` |
| Alumno | `alumno@galileo.edu.ar` |

Para reinicializar completamente la base de desarrollo:

```bash
docker compose down -v
docker compose up --build -d
```

`down -v` elimina todos los datos del volumen MySQL. No usarlo sobre datos que deban conservarse.

## Desarrollo frontend

```bash
cd Galisencia/Frontend
npm install
npm run dev
```

En desarrollo, `VITE_API_URL` permite cambiar la URL del backend. Sin backend disponible, el login puede usar datos mock para la demo.

## Roles y alcance

- **Alumno**: consulta únicamente su asistencia y sus notas.
- **Preceptor**: gestiona alumnos y asistencias solamente de sus cursos asignados.
- **Directivo**: consulta estadísticas institucionales completas.
- **Administrador**: gestiona alumnos, cursos, usuarios, roles y auditoría.

El control se aplica en la API mediante RBAC y reglas de alcance; no depende de ocultar botones en el frontend.

## Estado de módulos

| Módulo | Estado |
|---|---|
| Login y sesión SSO | Hecho |
| Gestión de alumnos y asistencias | Hecho |
| Alcance por curso del preceptor | Hecho |
| Reportes institucionales y por preceptor | Hecho |
| Gestión de usuarios y roles | Hecho |
| Asignación curso-preceptor | Hecho |
| Auditoría | Hecho |
| Prototipo Galiservas integrado | Hecho |

## Pruebas

Con el stack Docker activo y una base exclusiva de prueba:

```bash
node tests/api.test.mjs
```

Ver [tests/README.md](./tests/README.md) para detalles.

## Cómo contribuir

Antes de modificar código, leer [CONTRIBUTING.md](./CONTRIBUTING.md).
