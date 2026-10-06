# Cómo contribuir

Somos un equipo, así que nadie pushea directo a `main`. Todo cambio entra por Pull Request (PR) revisado por otra persona del equipo.

## 1. Antes de arrancar

```bash
git checkout main
git pull
```

Siempre arrancá una rama nueva desde `main` actualizado, para no arrastrar cambios viejos.

## 2. Convención de ramas

Nombrá la rama según lo que estés haciendo:

- `feature/nombre-corto` → funcionalidad nueva (ej: `feature/dashboard-preceptor`)
- `fix/nombre-corto` → arreglo de un bug (ej: `fix/filtro-materia`)
- `chore/nombre-corto` → tareas que no son feature ni fix (config, dependencias, docs)

El repo tiene tres partes: el frontend de Galisencia (`Galisencia/Frontend`), el frontend de Galiservas (`Galiservas/Frontend`) y la API compartida (`Galisencia/Galileo_Auth`). Sumale a la rama cuál toca, para que se entienda de un vistazo sin tener que abrirla:

- `feature/galisencia-dashboard-preceptor`
- `feature/galiservas-filtro-recursos`
- `fix/api-calculo-porcentaje`

Si la rama toca más de una parte a la vez, va sin prefijo: `feature/nuevo-campo-legajo`.

```bash
git checkout -b feature/galisencia-dashboard-preceptor
```

## 3. Mientras trabajás

Commiteá seguido y con mensajes claros de qué hiciste (no hace falta que sea perfecto, pero que se entienda):

```bash
git add .
git commit -m "agrega tabla de asistencia por curso"
```

Antes de subir, corré lint y build de los dos frontends y las pruebas de integración contra el stack Docker (ver [tests/README.md](./tests/README.md)):

```bash
cd Galisencia/Frontend && npm run lint && npm run build
cd ../../Galiservas/Frontend && npm run lint && npm run build
cd ../.. && node tests/api.test.mjs
```

Atajo con scripts (los mismos que usa Claude Code en `/cerrar-tarea`): verificación estática y tests contra un stack aislado (proyecto Docker `pruebas`, puerto 3100), que no toca tu stack principal:

```bash
bash .claude/skills/cerrar-tarea/scripts/verificar.sh
bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh up
bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh test
```

Si algo no lo pudiste correr, aclaralo en el PR.

## 4. Subir la rama y abrir el PR

```bash
git push -u origin feature/galisencia-dashboard-preceptor
```

Después andá a GitHub y abrí el Pull Request contra `main`. En la descripción contá:
- Qué hace el cambio
- Cómo probarlo (si aplica)
- Si toca algún módulo específico del [README](./README.md)

## 5. Revisión

- Necesitás **al menos una aprobación** de otro integrante antes de mergear.
- Si te piden cambios, hacé commits nuevos en la misma rama — se suman al PR solos, no hace falta abrir uno nuevo.
- El que abre el PR es quien lo mergea una vez aprobado (usando "Squash and merge" para mantener el historial de `main` limpio).

## 6. Después de mergear

Borrá la rama (GitHub te da la opción al mergear) y volvé a actualizar tu `main` local:

```bash
git checkout main
git pull
```

## Reglas rápidas

- Nunca pushear directo a `main`.
- Una rama = un cambio chico y enfocado. Evitá PRs gigantes que mezclan cinco cosas.
- Si dos personas van a tocar el mismo módulo, avisen en el grupo antes para no pisarse.

## Integración continua

Cada pull request corre `.github/workflows/ci.yml` (lint y build de ambos frontends, `php -l` y `tests/api.test.mjs` contra Docker). No se mergea con el CI en rojo.
