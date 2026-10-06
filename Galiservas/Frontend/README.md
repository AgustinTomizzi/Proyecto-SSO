# Galiservas — Frontend

React + TypeScript + Vite.

Para info general del proyecto y cómo contribuir, mirá el [README de la raíz](../../README.md) y el [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Levantar en local

La forma soportada es Docker Compose desde la raíz del repo: Galiservas queda en `http://localhost:3000/galiservas/` detrás del proxy de entrada (se compila con `base: '/galiservas/'`).

Para desarrollar con recarga en caliente:

```bash
npm ci
npm run dev
```

En dev la app queda en `http://localhost:5174/galiservas/` y Vite reenvía `/api` a `http://localhost:8080` (o a `VITE_PROXY_API`); ese puerto existe si levantás el stack con `docker compose --profile dev up`. Si no hay respuesta, la app muestra "Sin conexión" con un botón para reintentar.

Antes de subir cambios: `npm run lint` y `npm run build`.

## Estructura

```
src/
├── App.tsx    # Toda la UI: login, panel, Aulas, Pañol, reservas, reportes y administración de recursos
├── api.ts     # Cliente de la API compartida (sesión, recursos, reservas, reportes); no hay datos mock
├── types.ts   # Tipos de recursos, reservas, sesión y usuario
├── fecha.ts   # Fechas en zona America/Argentina/Buenos_Aires
└── main.tsx
```

## Acceso

- Solo entran los roles que tienen el sistema Galiservas en `rol_sistema` y el permiso `galiservas.acceder` (hoy Preceptor, Docente y Administrador). Alumno, Directivo y Administrador Académico no tienen acceso; la API lo vuelve a validar en cada request.
- Si la cuenta todavía tiene la contraseña inicial, la app pide cambiarla desde Galisencia (`VITE_GALISENCIA_URL`, por defecto `/`).
