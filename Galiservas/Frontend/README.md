# Galiservas — Frontend

React + TypeScript + Vite.

Para info general del proyecto y cómo contribuir, mirá el [README de la raíz](../README.md) y el [CONTRIBUTING.md](../CONTRIBUTING.md).

## Levantar en local

```bash
npm install
npm run dev
```

## Estructura sugerida

Seguí el mismo patrón que usamos en Galisencia: cada módulo/pantalla va en su propia carpeta dentro de `src/components/`, con sus archivos `.tsx` (componentes), `.service.ts` (llamadas a datos, mock por ahora), `.types.ts` (tipos) y `.css` juntos. Ejemplo para cuando arranquen el módulo de aulas:

```
src/components/aulas/
├── AulasDashboard.tsx
├── aulas.service.ts
├── aulas.types.ts
└── aulas.css
```
