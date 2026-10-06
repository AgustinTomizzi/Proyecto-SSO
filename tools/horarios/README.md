# Horarios reales del colegio

`2026/` tiene los 39 horarios publicados en <https://horarios.galileo.edu.ar> (aSc Horarios, generados el 11/03/2026), transcritos desde las imágenes a JSON con el formato de `TRANSCRIPCION.md`. Cada archivo anota en `dudas` lo que no se pudo leer con certeza o es raro en la fuente (aulas o docentes faltantes, dos docentes en un recuadro, erratas).

`db/10-horarios-reales.sql` se genera a partir de estos archivos:

```bash
node tools/horarios/generar_horarios.mjs tools/horarios/2026 db/10-horarios-reales.sql
```

El generador:

- normaliza los textos ("ì" → "í", espacios);
- crea materias, aulas y docentes. Los docentes son usuarios con rol Docente, contraseña inicial `demo1234`, `debe_cambiar_password = 1` y email ficticio `docente.<nombre>@galileo.edu.ar`;
- marca Playón, Campo y Patio como aulas compartidas y vincula 208, 209 y 210 con las aulas reservables de Galiservas;
- expande cada bloque a una fila por módulo;
- informa los choques de docente o aula que haya en la fuente.

Notas sobre la fuente:

- 5º 5ª Prog. está vacío.
- El aula 201 figura ocupada a la vez por 6º 4ª y 7º 3ª el jueves de 17:30 a 19:30.
- En cuatro recuadros figuran dos docentes ("A / B"); se toma el primero.
