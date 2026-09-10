# Proyecto SSO

Monorepo de los sistemas escolares **Galisencia** (asistencia y gestión académica) y **Galiservas** (reserva de aulas), con una sesión compartida.

## Arquitectura activa

```text
db/                              # Esquema, seed y migraciones MySQL
Galisencia/
├── Frontend/                    # React + TypeScript + Vite
│   └── public/galiservas/       # Galiservas: reserva de aulas con stock
└── Galileo_Auth/                # Backend PHP activo
    ├── api/                     # Endpoints JSON (incluye recursos y reservas)
    ├── config/                  # Conexión PDO
    └── includes/                # Auth, RBAC, scope, re-auth y auditoría
docker-compose.yml               # MySQL + backend + frontend/nginx
tests/                           # Pruebas de integración de la API
```

El frontend se sirve en `http://localhost:3000` (o el puerto definido en `FRONTEND_PORT`). Nginx reenvía `/api/*` al backend PHP dentro de la red Docker. Galiservas se sirve en `/galiservas/` como estático integrado y usa la misma sesión SSO.

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

El login es único (email + contraseña); el rol y el acceso a cada sistema los resuelve el backend.

Para reinicializar completamente la base de desarrollo (re-ejecuta esquema, seed y migraciones 01-04):

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

## Galiservas

- Acceso con rol Preceptor, Docente o Administrador (Alumno y Directivo ven un aviso de "Sin acceso").
- Aulas **208, 209 y 210** (30/28/25 computadoras) y pañol (notebooks, teclados, mouse, CPUs, proyectores, cámaras, micrófonos, parlantes).
- Franjas horarias fijas (08-10, 10-12, 13-15, 15-17, 17-19, 19-21). La disponibilidad por franja se calcula contra las reservas existentes (`recurso + fecha + horario`) y no se permite reservar más del stock disponible.
- Las reservas se auditan (`reservas.crear`) y quedan registradas con su autor.

## Roles y alcance

- **Alumno**: consulta únicamente su asistencia y sus notas.
- **Preceptor**: gestiona alumnos y asistencias solamente de sus cursos asignados. Editar o dar de baja un alumno exige reingresar la contraseña.
- **Directivo**: consulta estadísticas institucionales completas.
- **Administrador**: gestiona alumnos, cursos, usuarios, roles y auditoría.

El control se aplica en la API mediante RBAC y reglas de alcance; no depende de ocultar botones en el frontend.

## Historial y filtros

- Asistencia consultable por año (incluye "Todos los años"), con resumen por materia y alumnos en riesgo (menos del 75%).
- El panel de Directivo admite filtrar "Libres / en riesgo" por curso y materia.

## Estado de módulos

| Módulo | Estado |
|---|---|
| Login y sesión SSO | Hecho |
| Gestión de alumnos y asistencias | Hecho |
| Alcance por curso del preceptor | Hecho |
| Re-autenticación del preceptor (baja / cambio de curso) | Hecho |
| Reportes institucionales y por preceptor | Hecho |
| Filtros por año y materia en asistencias y reportes | Hecho |
| Gestión de usuarios y roles | Hecho |
| Asignación curso-preceptor | Hecho |
| Auditoría | Hecho |
| Galiservas: reserva de aulas y pañol con stock | Hecho |

## Pruebas

Con el stack Docker activo y una base exclusiva de prueba:

```bash
docker compose down -v            # base fresca (aplica migraciones 01-04)
docker compose up --build -d
$env:API_URL = "http://localhost:3000/api"; node tests/api.test.mjs
```

Ver [tests/README.md](./tests/README.md) para detalles.

## Cómo contribuir

Antes de modificar código, leer [CONTRIBUTING.md](./CONTRIBUTING.md).
