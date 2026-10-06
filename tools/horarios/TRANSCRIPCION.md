# Transcripción de horarios reales (aSc Horarios → JSON)

Carpeta de imágenes: este mismo directorio (`<curso>.jpg`, por ejemplo `1A.jpg`, `41.jpg`).
Salida: `../horarios-json/<curso>.json` (crear la carpeta si no existe). Un archivo por curso.

Cada imagen es la grilla semanal de un curso (Lunes a Viernes). Filas = módulos de 60 minutos:

| # | Módulo |
|---|---|
| 1 | 07:40 a 08:40 |
| 2 | 08:40 a 09:40 |
| 3 | 09:55 a 10:55 |
| 4 | 10:55 a 11:55 |
| — | CAMBIO DE TURNO (banda, no es clase) |
| 5 | 13:00 a 14:00 |
| 6 | 14:00 a 15:00 |
| 7 | 15:15 a 16:15 |
| 8 | 16:15 a 17:15 |
| 9 | 17:30 a 18:30 |
| 10 | 18:30 a 19:30 |
| 11 | 19:40 a 20:40 |
| 12 | 20:40 a 21:40 |

Cada clase es un recuadro con:
- **arriba a la derecha:** el aula (por ejemplo `AT5`, `TR2`, `11`, `204`, `F/Q`, `Playón`, `Campo`, `TE`, `ATN`);
- **al centro:** la materia (puede ocupar 2 o 3 renglones: unirlos con un espacio, por ejemplo "Lenguajes Tecnológicos");
- **abajo a la izquierda:** el docente (apellido o abreviatura tal cual, por ejemplo `GomezMe`, `Raffo, Y.`, `SantaCruz`). Puede faltar.

Un recuadro puede ocupar 1, 2 o más módulos seguidos (alto) y el ancho completo del día o **la mitad** del día (grupos que cursan en paralelo):
- ancho completo → `"grupo": 0`
- mitad izquierda → `"grupo": 1`
- mitad derecha → `"grupo": 2`

Si en una mitad hay clase y en la otra no, igual se registra con su grupo. Si un recuadro tiene una forma rara (no coincide exactamente con los módulos), aproximalo a los módulos que más ocupa y agregalo a `"dudas"`.

## Formato del archivo

```json
{
  "curso": "2C",
  "titulo": "2do. \"C\"",
  "clases": [
    {"dia": 1, "desde": "07:40", "hasta": "09:40", "grupo": 0, "materia": "Matemática", "aula": "11", "docente": "GomezMe"},
    {"dia": 1, "desde": "09:55", "hasta": "11:55", "grupo": 1, "materia": "Lenguajes Tecnológicos", "aula": "ATN", "docente": "DiDonato"},
    {"dia": 1, "desde": "09:55", "hasta": "11:55", "grupo": 2, "materia": "Procedimientos Técnicos", "aula": "TR1", "docente": "Barreiro"}
  ],
  "dudas": ["texto libre con lo que no se pudo leer con certeza (día, hora y qué)"]
}
```

Reglas:
- `dia`: 1 = Lunes … 5 = Viernes.
- `desde` y `hasta` usan SOLO los límites de la tabla de módulos (inicio de un módulo, fin de un módulo). Un bloque de 2 módulos de la mañana es `07:40`–`09:40`; si cruza el recreo, por ejemplo módulos 2 y 3, es `08:40`–`10:55`.
- Copiá textos exactamente como aparecen (tildes, mayúsculas, puntos, paréntesis). No inventes ni completes nombres. Si algo no se lee, poné tu mejor lectura y anotalo en `dudas`.
- `aula` o `docente` vacíos → `null`.
- No incluyas celdas vacías.
- Revisá cada día de arriba abajo para no saltear clases, y verificá al final que no queden dos clases del mismo grupo superpuestas en el mismo día.
- Para leer letra chica, podés recortar la imagen con PHP GD: `/c/xampp/php/php.exe -d extension=gd` con `imagecrop` y `imagepng` (guardá los recortes en esta misma carpeta, en `recortes/`), y abrir el recorte con la herramienta Read.
