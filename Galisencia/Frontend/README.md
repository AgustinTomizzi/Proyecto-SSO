# Galisencia — Frontend

React + TypeScript + Vite.

Para info general del proyecto (roles, estado de módulos, cómo contribuir), mirá el [README de la raíz](../../README.md) y el [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Levantar en local

La forma soportada es Docker Compose desde la raíz del repo: Galisencia queda en `http://localhost:3000/` detrás del proxy de entrada, que también sirve Galiservas en `/galiservas/` y la API en `/api/`.

Para desarrollar con recarga en caliente:

```bash
npm install
npm run dev
```

Vite corre en `http://localhost:5173` y reenvía `/api` a `http://localhost:80` (ver `vite.config.ts`). Necesitás un backend PHP escuchando ahí, o cambiar `VITE_API_URL` (ver `.env.example`).

Antes de subir cambios: `npm run lint` y `npm run build`.

## Estructura

```
src/
├── auth/         # Login, cambio obligatorio de contraseña, sesión (AuthContext, auth.service.ts)
├── components/
│   ├── layout/     # AppLayout: menú lateral por rol, banner "Sin conexión con el servidor"
│   ├── alumno/     # Mi asistencia
│   ├── asistencia/ # Tarjetas, filtros e indicadores de asistencia reutilizables
│   ├── preceptor/  # Registrar asistencia
│   ├── directivo/  # Panel institucional
│   ├── admin/      # Panel de administración y gestión de usuarios
│   ├── gestion/    # Gestión académica (alumnos, cursos)
│   ├── horarios/   # Grilla semanal: ver, editar y exportar (PDF y Excel)
│   ├── reportes/   # Reportes de asistencia
│   ├── auditoria/  # Consulta de auditoría
│   └── ui/         # Componentes genéricos (gráficos, diálogos, toasts, estados vacíos)
├── data/         # apiClient.ts + StoreContext.tsx (datos de la API), tipos y helpers
├── hooks/        # Hooks compartidos
├── styles/       # Tema y estilos globales
└── theme/        # Modo claro/oscuro
```

## Notas

- Los datos salen de la API a través de `data/apiClient.ts` y `data/StoreContext.tsx`. Con sesión iniciada no hay datos mock: si la API falla, se muestra el aviso "Sin conexión con el servidor" con el botón Reintentar.
- `data/mock.ts` solo aporta tipos, helpers y datos en memoria para cuando no hay sesión. No se guardan datos de alumnos en `localStorage`.
- El enlace a Galiservas usa `VITE_GALISERVAS_URL` (por defecto `/galiservas/`, mismo origen) y solo aparece si el rol tiene acceso.
- El menú de cada rol está definido en `NAV` de `components/layout/AppLayout.tsx`.
