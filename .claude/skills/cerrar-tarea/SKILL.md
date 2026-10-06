---
name: cerrar-tarea
description: Cierra una tarea de PLAN_CAMBIOS.md según CLAUDE.md — lint y build de los dos frontends, php -l, stack de pruebas aislado con tests de integración, chequeo de documentación y commit chico en español. Usar al terminar cada tarea, antes de commitear.
disable-model-invocation: true
---

# Cerrar una tarea

Seguí estos pasos en orden. Si alguno no se puede ejecutar, decilo explícitamente en el resumen (CLAUDE.md lo exige).

## 1. Verificación estática

```bash
bash .claude/skills/cerrar-tarea/scripts/verificar.sh
```

Tiene que terminar con `exit=0` en lint y build de Galisencia y Galiservas y `[php -l] ok`. Los warnings de oxlint que ya existían no cuentan; uno nuevo en un archivo tocado, sí.

## 2. Tests de integración (stack aislado)

El stack de pruebas usa el proyecto Docker `pruebas` (proxy en `:3100`, Mailpit en `:8125`) y **no toca el stack principal** (`galileo`, puerto 3000). Su base se recrea en cada `up`.

```bash
bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh up
bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh test
```

Tiene que terminar con la línea `OK: autenticacion, RBAC, ...`. Si cambió solo un servicio, se puede reconstruir solo ese:
`bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh dc up -d --build --no-deps --wait backend`.

Nunca correr `docker compose down -v` sobre el stack principal sin confirmación del usuario (el hook de `.claude/hooks/proteger.mjs` lo bloquea).

## 3. Si hay UI: probarla en el navegador

Contra `http://localhost:3100` con los usuarios del seed (la contraseña de prueba que dejan los tests está en `tests/api.test.mjs`, `PASSWORD_PRUEBA`). Revisar modo claro y oscuro y ancho de celular, sin cambiar el diseño de Galisencia.

## 4. Documentación (regla 8)

Según lo que cambió:

- Endpoint nuevo o cambiado → `docs/API.md`.
- Permiso nuevo o alcance → `docs/ROLES_Y_PERMISOS.md`.
- Tabla, columna o migración → `docs/DATABASE.md` (lista numerada, "la próxima es `NN-...`" y la sección de la tabla), y la cadena de migraciones en `README.md` y `DOCKER_INSTRUCTIONS.md`.
- Pantalla o flujo → `docs/NAVEGACION.md`.
- Variable de entorno → `.env.example` y `DOCKER_INSTRUCTIONS.md`.

El agente `sincronizador-docs` puede revisar el diff contra la documentación.

## 5. Commit

Solo los archivos de la tarea (`git add <rutas>`, nunca `git add -A` a ciegas). Mensaje en español rioplatense con el número de tarea:

```
feat(api): <qué> (3.x)

- detalle 1
- detalle 2
```

## 6. Resumen al usuario

Qué se hizo, resultados de cada verificación (con números) y qué quedó sin ejecutar o pendiente.
