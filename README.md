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

La base canónica incluye SSO/RBAC, Galisencia, Galiservas y auditoría. El esquema y el seed viven en `db/` y son la única fuente de verdad; se aplican en orden: `00-usuario-app.sh` → `01-schema.sql` → `02-seed.sql` → `03-migracion-rbac-auditoria.sql` → `04-horarios.sql` → `05-seguridad.sql` → `06-horarios-grilla.sql`.

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

`admin@...` es el superrol `Administrador`. Galiservas admite únicamente `Preceptor`, `Docente` y `Administrador`; Alumno, Directivo y Administrador Académico no ven el enlace ni pueden entrar por URL directa.

El catálogo demo de Galiservas incluye las aulas 208/209/210 y, en el Pañol, 30 notebooks, teclados, mouse, CPUs, proyectores, cámaras, micrófonos, parlantes y cables. Las reservas se confirman automáticamente si la suma de unidades solapadas no supera el stock.

## Inicio rápido con Docker

`docker-compose.yml` levanta MySQL `ProyectoEstela`, el backend PHP (Galileo_Auth), Galisencia en <http://localhost:3000> y Galiservas en <http://localhost:5174>. Las contraseñas salen de `.env`, que no se versiona:

```bash
cp .env.example .env   # y cambiar las contraseñas
docker compose up --build -d
```

```bash
docker compose down
```

El volumen conserva datos; `docker compose down -v` los elimina (pide confirmación antes de usarlo). El backend no publica puertos: la API se usa por `/api` de cada frontend. El enlace lateral "Galiservas" de Galisencia abre `http://localhost:5174` (configurable con `VITE_GALISERVAS_URL`). Detalles, variables y solución de problemas en [DOCKER_INSTRUCTIONS.md](DOCKER_INSTRUCTIONS.md).

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
npm run dev -- --port 5174
```

Galisencia corre en `:5173` y su Vite proxifica `/api` a `http://localhost:80`. Galiservas llama a `http://localhost:8080/api` salvo que definas `VITE_API_URL`; para eso levantá el backend con `docker compose --profile dev up --build -d`.

Antes de subir cambios: `npm run lint` y `npm run build` en ambos frontends, más `node tests/api.test.mjs`.

Galisencia usa `/api` por defecto. Con sesión iniciada nunca muestra datos inventados: si la API no responde, muestra el aviso "Sin conexión con el servidor" con un botón para reintentar.

Sin variables de entorno, `config/database.php` usa `DB_HOST=localhost`, `DB_NAME=ProyectoEstela`, `DB_USER=root` y `DB_PASSWORD` vacío, pensados solo para una instalación local de desarrollo. Docker usa el usuario de la aplicación definido en `.env`.

## Documentación

- [Base de datos y ER](docs/DATABASE.md)
- [API implementada y límites actuales](docs/API.md)
- [Mapa de navegación y guion de 8 minutos](docs/NAVEGACION.md)
- [Matriz exacta de roles y permisos](docs/ROLES_Y_PERMISOS.md)
- [Guía oral y preguntas](docs/PRESENTACION.md)
- [Docker: variables, puertos y problemas comunes](DOCKER_INSTRUCTIONS.md)
- [Pruebas de integración](tests/README.md)

## Límites conocidos relevantes

- El ciclo lectivo de asistencia se obtiene del año de la fecha; aún no se modelan períodos trimestrales independientes.
- La relación entre alumno y usuario continúa resolviéndose por email institucional, no mediante FK.
- Galiservas todavía tiene su propio formulario de login (el login único llega en la Fase 2).
- El Docente no tiene alcance por curso o materia: hasta la Fase 1 puede registrar asistencia y notas de cualquier alumno activo.

Para convenciones de colaboración, consultar [CONTRIBUTING.md](CONTRIBUTING.md).
