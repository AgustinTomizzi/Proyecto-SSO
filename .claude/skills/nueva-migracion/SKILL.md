---
name: nueva-migracion
description: Crea la próxima migración SQL numerada e idempotente en db/ y actualiza 01-schema.sql, 02-seed.sql y la documentación (regla 7 de CLAUDE.md). Usar para cualquier cambio de esquema, permiso o dato canónico.
disable-model-invocation: true
argument-hint: "<nombre-corto> (por ejemplo: retiros-incidentes)"
---

# Nueva migración

Los archivos de `db/` se aplican en orden numérico en el primer arranque del volumen. Las migraciones ya commiteadas **no se editan** (el hook `.claude/hooks/proteger.mjs` lo bloquea): todo cambio va en un archivo nuevo.

## 1. Número

```bash
ls db | sort | tail -3
```

Usá el siguiente número libre de dos dígitos y el nombre del argumento: `db/NN-<nombre>.sql`. `docs/DATABASE.md` dice cuál es la próxima ("la próxima es `NN-...`").

## 2. Contenido

Partí de [plantilla.sql](plantilla.sql). Reglas:

- Todo idempotente: `CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`, `MODIFY` de ENUM (es idempotente) y, para `ADD COLUMN`, `ADD INDEX` o `ADD CONSTRAINT`, el procedimiento que consulta `information_schema` (MySQL 8 no tiene `ADD COLUMN IF NOT EXISTS`).
- Comentarios sin tildes en el SQL (como las migraciones existentes); las descripciones de permisos también.
- FK hacia `usuarios` con `ON DELETE SET NULL` para autoría (`creado_por`) y `CASCADE` para datos que pertenecen al usuario.
- Permisos nuevos: `INSERT IGNORE INTO permisos` + `rol_permiso` por nombre de rol (`'Preceptor'`, `'Docente'`, `'Directivo'`, `'Administrador Academico'`, `'Administrador'`, `'Alumno'`). El Administrador recibe todos los permisos en el seed, pero en la migración hay que asignárselo explícitamente.
- Nunca datos sensibles en semillas (DNI reales, contraseñas en claro).

## 3. Esquema canónico (regla 7)

- Copiá las tablas nuevas o los cambios de columnas a `db/01-schema.sql` (con `CREATE TABLE`, sin `IF NOT EXISTS`), respetando el orden de las FK.
- Permisos nuevos: agregalos a la lista de `INSERT INTO permisos` de `db/02-seed.sql` y a la lista del rol correspondiente.

## 4. Probar dos veces

La migración tiene que poder correr sobre una base nueva y sobre una que ya la tiene:

```bash
bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh up
bash .claude/skills/cerrar-tarea/scripts/stack-pruebas.sh dc exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < db/NN-<nombre>.sql
```

La segunda ejecución no debe dar errores.

## 5. Documentación

- `docs/DATABASE.md`: ítem nuevo en la lista numerada, "la próxima es `NN+1-...`" y sección de la tabla (campos, tipos, claves y significado).
- `README.md` y `DOCKER_INSTRUCTIONS.md`: sumá el archivo a la cadena de migraciones.
- `docs/ROLES_Y_PERMISOS.md` si hay permisos nuevos.

Para aplicar la migración al stack principal sin borrar datos (`DOCKER_INSTRUCTIONS.md`, "Volumen existente y migraciones nuevas"):

```bash
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < db/NN-<nombre>.sql
```
