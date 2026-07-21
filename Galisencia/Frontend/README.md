# Galisencia — Frontend

React + TypeScript + Vite.

Para info general del proyecto (roles, estado de módulos, cómo contribuir), mirá el [README de la raíz](../README.md) y el [CONTRIBUTING.md](../CONTRIBUTING.md).

## Levantar en local

```bash
npm install
npm run dev
```

## Estructura

```
src/
├── App.tsx
├── main.tsx
└── components/
    └── asistencia/       # Módulo 1: consulta de asistencia del alumno
        ├── AsistenciaDashboard.tsx
        ├── asistenciaCard.tsx
        ├── subjectFilter.tsx
        ├── HistoryTable.tsx
        ├── RealtimeIndicador.tsx
        ├── attendance.service.ts   # acá se reemplaza el mock por la API real
        └── attendance.types.ts
```

## Notas

- `attendance.service.ts` usa datos mock. Cuando el Backend tenga el endpoint de asistencia, reemplazar `obtenerRegistros` por el `fetch` real (queda marcado con un `TODO` en el archivo).
- Cada módulo nuevo va en su propia carpeta dentro de `components/`, siguiendo el mismo patrón que `asistencia/` (componentes + `.service.ts` + `.types.ts` + `.css`).
