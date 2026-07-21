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

Como el repo tiene dos sistemas (`Frontend/` y `Backend/`), sumale cuál de los dos toca la rama, para que se entienda de un vistazo sin tener que abrirla:

- `feature/frontend-dashboard-preceptor`
- `feature/backend-auth-jwt`
- `fix/backend-calculo-porcentaje`

Si la rama toca los dos sistemas a la vez, va sin prefijo: `feature/nuevo-campo-legajo`.

```bash
git checkout -b feature/frontend-dashboard-preceptor
```

## 3. Mientras trabajás

Commiteá seguido y con mensajes claros de qué hiciste (no hace falta que sea perfecto, pero que se entienda):

```bash
git add .
git commit -m "agrega tabla de asistencia por curso"
```

## 4. Subir la rama y abrir el PR

```bash
git push -u origin feature/dashboard-preceptor
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
