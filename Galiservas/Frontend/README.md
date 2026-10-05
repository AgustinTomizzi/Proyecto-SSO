# Galiservas — Frontend

React + TypeScript + Vite.

Para info general del proyecto y cómo contribuir, mirá el [README de la raíz](../../README.md) y el [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Levantar en local

La forma soportada es Docker Compose desde la raíz del repo: Galiservas queda en `http://localhost:5174` y nginx reenvía `/api` al backend.

Para desarrollar con recarga en caliente:

```bash
npm install
npm run dev
```

En dev, la app llama a `VITE_API_URL` o, si no está definida, a `http://localhost:8080/api` (ver `src/api.ts`). Ese puerto solo existe si levantás el stack con `docker compose --profile dev up`; con `APP_ENV=dev` el backend acepta CORS desde `localhost`. Si no hay respuesta, la app muestra "Sin conexión" con un botón para reintentar.

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
- Si la cuenta todavía tiene la contraseña inicial, la app pide cambiarla desde Galisencia (`VITE_GALISENCIA_URL`, por defecto `http://localhost:3000`).
