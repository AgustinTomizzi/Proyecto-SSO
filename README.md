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
USB-Setup/                ejecución portátil Windows/XAMPP
```

La base canónica incluye SSO/RBAC, Galisencia, Galiservas y auditoría. Los SQL dentro de carpetas `Backend` son prototipos históricos y no deben sustituir `db/01-schema.sql`.

## Cuentas demo

Contraseña común: `demo1234`.

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

## Inicio rápido USB/XAMPP (recomendado para aula)

El paquete se prepara, no se descarga automáticamente. Layout soportado:

```text
X:\nodejs\
X:\xampp\htdocs\Proyecto-SSO\
```

1. En casa y con Internet: `USB-Setup\PREPARAR_USB.bat`.
2. Para iniciar sin borrar datos: `USB-Setup\INICIAR_DEMO.bat`.
3. Para diagnosticar: `USB-Setup\VERIFICAR.bat`.
4. Solo para restaurar el seed, con confirmación destructiva: `USB-Setup\REINICIAR_BASE_DEMO.bat`.

URLs del kit:

- Galisencia: <http://localhost:5173>
- Galiservas independiente: <http://localhost:5174>
- Galileo Auth/PHP: <http://localhost/Proyecto-SSO/Galisencia/Galileo_Auth>
- API: <http://localhost/Proyecto-SSO/Galisencia/Galileo_Auth/api>

Pasos completos y problemas de puertos: [USB-Setup/INSTRUCCIONES.md](USB-Setup/INSTRUCCIONES.md).

## Docker

La configuración vigente de `docker-compose.yml` levanta MySQL `ProyectoEstela`, backend PHP Galisencia y frontend Galisencia en <http://localhost:3000>:

```bash
docker compose up --build
```

```bash
docker compose down
```

El volumen conserva datos; `docker compose down -v` los elimina. Docker no levanta el frontend Galiservas. `DOCKER_INSTRUCTIONS.md` contiene información histórica que puede no coincidir con el compose actual; para la presentación usar este README y revisar directamente `docker-compose.yml`.

## Desarrollo local

```bash
cd Galisencia/Frontend
npm ci
npm run dev
```

```bash
cd Galiservas/Frontend
npm install
npm run dev -- --port 5174
```

Galisencia usa `/api` por defecto y dispone de fallback mock cuando el backend no responde. Que la UI abra no demuestra persistencia: comprobar el modo y recargar después de escribir.

Valores PHP por defecto compatibles con XAMPP: `DB_HOST=localhost`, `DB_NAME=ProyectoEstela`, `DB_USER=root`, `DB_PASSWORD` vacío. Docker los reemplaza con variables de entorno.

## Documentación

- [Base de datos y ER](docs/DATABASE.md)
- [API implementada y límites actuales](docs/API.md)
- [Mapa de navegación y guion de 8 minutos](docs/NAVEGACION.md)
- [Matriz exacta de roles y permisos](docs/ROLES_Y_PERMISOS.md)
- [Guía oral y preguntas](docs/PRESENTACION.md)
- [Kit USB paso a paso](USB-Setup/INSTRUCCIONES.md)

## Límites conocidos relevantes

- El ciclo lectivo de asistencia se obtiene del año de la fecha; aún no se modelan períodos trimestrales independientes.
- La relación entre alumno y usuario continúa resolviéndose por email institucional, no mediante FK.
- Docker levanta Galisencia y la API, pero Galiservas se ejecuta de forma independiente en `:5174`.

Para convenciones de colaboración, consultar [CONTRIBUTING.md](CONTRIBUTING.md).
