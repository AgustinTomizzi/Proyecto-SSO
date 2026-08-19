# Galisencia

Sistema de gestión de asistencia escolar: permite a alumnos, preceptores, directivos y administradores académicos registrar, consultar y hacer seguimiento de la asistencia de forma centralizada.

Forma parte de **Proyecto-SSO**: un único inicio de sesión (SSO) da acceso tanto a Galisencia como a Galiservas.

## Estructura del repo

Este es un monorepo con dos carpetas principales:

```
galisencia/
├── Frontend/    # React + TypeScript + Vite
└── Backend/     # PHP (login SSO + conexión a la BD del colegio)
```

## Cómo levantar el proyecto

### Frontend

```bash
cd Galisencia/Frontend
npm install
npm run dev
```

El frontend funciona con **datos de prueba (mock)** por defecto, así la demo nunca se rompe. Si el backend está desplegado, copiá `.env.example` a `.env` y seteá `VITE_API_URL` a la URL real del backend.

### Backend

```bash
cd Galisencia/Backend
# El login SSO expone api/login.php (JSON) y usa config/conexion.php
```

La conexión apunta a la BD remota del colegio (`ProyectoEstela`). Para usarla:
1. Ejecutá `sql/ProyectoEstela_usuarios.sql` en phpMyAdmin (`server.galileo.edu.ar:81`).
2. Ajustá usuario/clave/host en `login-php/config/conexion.php` si cambian.

## Roles del sistema

- **Alumno**: consulta su porcentaje y su historial de asistencia.
- **Preceptor**: registra presentes/ausentes de sus cursos asignados.
- **Directivo**: ve estadísticas institucionales y alumnos en riesgo.
- **Administrador Académico**: gestiona cambios de curso, altas y bajas de alumnos.

## Estado de los módulos

| Módulo | Descripción | Estado |
|---|---|---|
| Login SSO | Inicio de sesión único (compartido con Galiservas) | ✅ Hecho |
| 1 | Consulta de asistencia del alumno | ✅ Hecho |
| 2 | Gestión de asistencias (preceptor) | ✅ Hecho |
| 3 | Seguimiento institucional (directivo) | ✅ Hecho |
| 4 | Gestión académica de alumnos | ✅ Hecho |
| 7 | Reportes y estadísticas | ✅ Hecho |
| 5 | Gestión de usuarios y roles | 🔧 Backend (expuesto 28/ago) |
| 6 | Historial y auditoría | ⬜ Pendiente |

## Cómo contribuir

Antes de tocar código, leé [CONTRIBUTING.md](./CONTRIBUTING.md) — tiene la convención de ramas y el flujo de Pull Requests que vamos a usar en el equipo.

## Estado conocido (integración backend Docker)

La app quedó integrada con un backend PHP puro + MySQL única (`ProyectoEstela`), levantada con
`docker compose up --build` (ver `db/`, `Galisencia/Galileo_Auth/`, `docker-compose.yml`).

- Usuarios demo (password `demo1234`): `admin@galileo.edu.ar`, `preceptor@galileo.edu.ar`,
  `directivo@galileo.edu.ar`, `alumno@galileo.edu.ar`.
- El login emite una sola cookie de sesión; el `StoreContext` carga los datos del backend
  (role-aware: el alumno ve solo sus asistencias).
- **Pendiente de verificar en navegador**: las vistas de admin/alumno muestran el badge
  "Backend" pero no renderizan aún los datos del backend (posible desajuste de forma de datos
  entre la API y los componentes). Se continúa en `feat/galisencia-backend`.
