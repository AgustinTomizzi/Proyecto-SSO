# Proyecto SSO: Galisencia + Galiservas

Monorepo escolar con identidad y permisos compartidos para dos sistemas:

- **Galisencia:** gestión de alumnos, cursos, asistencia, notas, reportes y administración académica. Tiene frontend React y API PHP/MySQL en integración.
- **Galiservas:** reserva automática de aulas y equipos del Pañol con disponibilidad por fecha/horario, categorías y reportes de uso.

No confundir una demo visual o un contrato documentado con funcionalidad persistente ya verificada.

## Arquitectura

```text
Galisencia/Frontend       React 19 + TypeScript + Vite
Galiservas/Frontend       React 19 + TypeScript + Vite
Galisencia/Galileo_Auth   PHP + PDO + sesión + API JSON
db/                       MySQL ProyectoEstela (esquema y demo)
docs/                     arquitectura funcional y guía de exposición
tests/                    pruebas de integración contra el stack Docker
```

La base canónica incluye SSO/RBAC, Galisencia, Galiservas y auditoría. El esquema y el seed viven en `db/` y son la única fuente de verdad; se aplican en orden: `00-usuario-app.sh` → `01-schema.sql` → `02-seed.sql` → `03-migracion-rbac-auditoria.sql` → `04-horarios.sql` → `05-seguridad.sql` → `06-horarios-grilla.sql` → `07-materias-fk.sql` → `08-alcance-docente.sql` → `09-cursos-reales.sql` → `10-horarios-reales.sql` → `11-alumno-usuario.sql` → `12-actividad-demo.sql` (solo demo) → `13-sesiones.sql` → `14-suplencias.sql` → `15-ciclos-lectivos.sql`.

## Cuentas demo

Contraseña inicial común: `demo1234`. **Es solo para demostración:** todas las cuentas del seed quedan marcadas con `debe_cambiar_password`, así que el primer ingreso pide elegir una contraseña propia (Galisencia muestra la pantalla; Galiservas deriva a Galisencia). No usar estas cuentas ni esta contraseña en una instalación real.

| Email | Rol real del seed |
|---|---|
| `alumno@galileo.edu.ar` | Alumno |
| `preceptor@galileo.edu.ar` | Preceptor |
| `directivo@galileo.edu.ar` | Directivo |
| `academica@galileo.edu.ar` | Administrador Academico |
| `docente@galileo.edu.ar` | Docente |
| `admin@galileo.edu.ar` | Administrador |

Además, cada alumno demo tiene su propia cuenta (su email, misma contraseña inicial) y cada docente de los horarios reales una cuenta `docente.<nombre>@galileo.edu.ar`.

`admin@...` es el superrol `Administrador`. Galiservas admite únicamente `Preceptor`, `Docente` y `Administrador`; Alumno, Directivo y Administrador Académico no ven el enlace ni pueden entrar por URL directa.

El catálogo demo de Galiservas incluye las aulas 208/209/210 y, en el Pañol, 30 notebooks, teclados, mouse, CPUs, proyectores, cámaras, micrófonos, parlantes y cables. Las reservas se confirman automáticamente si la suma de unidades solapadas no supera el stock.

## Inicio rápido con Docker

`docker-compose.yml` levanta MySQL `ProyectoEstela`, el backend PHP (Galileo_Auth), y un proxy nginx que es el único punto de entrada: Galisencia en <http://localhost:3000/>, Galiservas en <http://localhost:3000/galiservas/> y la API en <http://localhost:3000/api/>. Al ser el mismo origen, las dos apps comparten la sesión sin CORS. Las contraseñas salen de `.env`, que no se versiona:

```bash
cp .env.example .env   # y cambiar las contraseñas
docker compose up --build -d
```

```bash
docker compose down
```

El volumen conserva datos; `docker compose down -v` los elimina (pide confirmación antes de usarlo). Solo el proxy publica puertos (`PROXY_PUERTO`, 3000 por defecto); para HTTPS ver [DOCKER_INSTRUCTIONS.md](DOCKER_INSTRUCTIONS.md). Los enlaces entre apps son relativos (`/galiservas/` y `/`). Detalles, variables y solución de problemas en [DOCKER_INSTRUCTIONS.md](DOCKER_INSTRUCTIONS.md).

Pruebas de integración (con el stack levantado sobre una base recién creada):

```bash
node tests/api.test.mjs
```

## Desarrollo local

```bash
cd Galisencia/Frontend
npm ci
npm run dev
```

```bash
cd Galiservas/Frontend
npm ci
npm run dev
```

Galisencia corre en `:5173` y Galiservas en `:5174/galiservas/`. Los dos Vite reenvían `/api` a `http://localhost:8080` (o a `VITE_PROXY_API`): levantá el backend con `docker compose --profile dev up --build -d`. En desarrollo los enlaces entre apps se configuran con `VITE_GALISERVAS_URL` y `VITE_GALISENCIA_URL` (ver los `.env.example` de cada frontend).

Antes de subir cambios: `npm run lint` y `npm run build` en ambos frontends, más `node tests/api.test.mjs`.

La integración continua (`.github/workflows/ci.yml`) corre lo mismo en cada push a `main` y en cada pull request: lint y build de los dos frontends, `php -l` del backend y los tests de integración contra el stack Docker levantado con un `.env` de contraseñas aleatorias.

Galisencia usa `/api` por defecto. Con sesión iniciada nunca muestra datos inventados: si la API no responde, muestra el aviso "Sin conexión con el servidor" con un botón para reintentar.

Sin variables de entorno, `config/database.php` usa `DB_HOST=localhost`, `DB_NAME=ProyectoEstela`, `DB_USER=root` y `DB_PASSWORD` vacío, pensados solo para una instalación local de desarrollo. Docker usa el usuario de la aplicación definido en `.env`.

## Documentación

- [Base de datos y ER](docs/DATABASE.md)
- [API implementada y límites actuales](docs/API.md)
- [Mapa de navegación y guion de 8 minutos](docs/NAVEGACION.md)
- [Matriz exacta de roles y permisos](docs/ROLES_Y_PERMISOS.md)
- [Autenticación intercambiable y cómo pasar a OIDC](docs/AUTENTICACION.md)
- [Guía oral y preguntas](docs/PRESENTACION.md)
- [Docker: variables, puertos y problemas comunes](DOCKER_INSTRUCTIONS.md)
- [Pruebas de integración](tests/README.md)

## Límites conocidos relevantes

- El ciclo lectivo de asistencia se obtiene del año de la fecha; aún no se modelan períodos trimestrales independientes.

Para convenciones de colaboración, consultar [CONTRIBUTING.md](CONTRIBUTING.md).
