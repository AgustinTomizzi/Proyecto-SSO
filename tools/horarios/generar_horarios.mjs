// Genera db/10-horarios-reales.sql a partir de los JSON transcritos.
// Uso: node generar_horarios.mjs <dir-json> <salida.sql>
import fs from "node:fs";
import path from "node:path";

const [dir, salida] = process.argv.slice(2);
const MODULOS = [
  ["07:40", "08:40"], ["08:40", "09:40"], ["09:55", "10:55"], ["10:55", "11:55"],
  ["13:00", "14:00"], ["14:00", "15:00"], ["15:15", "16:15"], ["16:15", "17:15"],
  ["17:30", "18:30"], ["18:30", "19:30"], ["19:40", "20:40"], ["20:40", "21:40"],
];
const DEMO_HASH = "$2y$10$xu8KOpcBqHX3AOKJ6tcLVeHQiq7SpujLIgYtY2E3TGp5zdjNKPDuy"; // demo1234
const AULAS_COMPARTIDAS = new Set(["Playón", "Campo", "Patio"]);
const AULAS_GALISERVAS = { "208": "Aula 208", "209": "Aula 209", "210": "Aula 210" };
const NO_DOCENTES = new Set(["3E", "65 P"]); // marcas del sistema, no docentes
const VIGENTE_DESDE = "2026-03-02";

const sql = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const limpiar = (t) => String(t).replace(/ì/g, "í").replace(/\s+/g, " ").trim();
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

const avisos = [];
const materias = new Set();
const aulas = new Set();
const docentes = new Map(); // etiqueta -> email
const filas = [];

for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const datos = JSON.parse(fs.readFileSync(path.join(dir, archivo), "utf8"));
  const codigo = path.basename(archivo, ".json");
  const anio = codigo[0];
  const division = codigo.slice(1);
  for (const c of datos.clases) {
    const desde = MODULOS.findIndex(([d]) => d === c.desde);
    const hasta = MODULOS.findIndex(([, h]) => h === c.hasta);
    if (desde < 0 || hasta < desde) {
      avisos.push(`${codigo}: horario fuera de módulos ${c.desde}-${c.hasta}`);
      continue;
    }
    const materia = limpiar(c.materia);
    materias.add(materia);
    const aula = c.aula ? limpiar(c.aula) : null;
    if (aula) aulas.add(aula);
    let docente = c.docente ? limpiar(c.docente) : null;
    if (docente && NO_DOCENTES.has(docente)) docente = null;
    if (docente && docente.includes("/")) {
      avisos.push(`${codigo} día ${c.dia} ${c.desde}: dos docentes "${docente}"; se toma el primero`);
      docente = limpiar(docente.split("/")[0]);
    }
    if (docente && !docentes.has(docente)) docentes.set(docente, `docente.${slug(docente)}@galileo.edu.ar`);
    for (let orden = desde + 1; orden <= hasta + 1; orden++) {
      filas.push({ codigo, anio, division, dia: c.dia, orden, grupo: c.grupo ?? 0, materia, aula, docente });
    }
  }
}

// Choques reales en los datos (docente o aula no compartida en dos lugares a la vez).
const ocupado = new Map();
for (const f of filas) {
  for (const [tipo, valor] of [["docente", f.docente], ["aula", f.aula && !AULAS_COMPARTIDAS.has(f.aula) ? f.aula : null]]) {
    if (!valor) continue;
    const clave = `${tipo}|${valor}|${f.dia}|${f.orden}`;
    const previo = ocupado.get(clave);
    if (previo && previo !== `${f.codigo}|${f.grupo}`) avisos.push(`choque de ${tipo} ${valor}: día ${f.dia} módulo ${f.orden} en ${previo.split("|")[0]} y ${f.codigo}`);
    else ocupado.set(clave, `${f.codigo}|${f.grupo}`);
  }
}
const emails = [...docentes.values()];
if (new Set(emails).size !== emails.length) avisos.push("emails de docentes repetidos tras normalizar");

const lineas = [];
lineas.push("-- 10-horarios-reales.sql");
lineas.push("-- Generado a partir de los horarios publicados en horarios.galileo.edu.ar");
lineas.push("-- (aSc Horarios, 11/03/2026). Idempotente: INSERT IGNORE sobre claves únicas.");
lineas.push("-- Los docentes se crean como usuarios con rol Docente, contraseña inicial");
lineas.push("-- demo1234 y debe_cambiar_password = 1 (emails ficticios de la demo).");
lineas.push("", "USE ProyectoEstela;", "SET NAMES utf8mb4;", "");
lineas.push("INSERT IGNORE INTO materias (nombre) VALUES");
lineas.push([...materias].sort().map((m) => `  (${sql(m)})`).join(",\n") + ";", "");
lineas.push("INSERT IGNORE INTO aulas (codigo, nombre, compartida, resource_id) VALUES");
lineas.push([...aulas].sort().map((a) => `  (${sql(a)}, ${sql(AULAS_GALISERVAS[a] ?? null)}, ${AULAS_COMPARTIDAS.has(a) ? 1 : 0}, ${AULAS_GALISERVAS[a] ? `(SELECT id_resource FROM resources WHERE name = ${sql(AULAS_GALISERVAS[a])} LIMIT 1)` : "NULL"})`).join(",\n") + ";", "");
lineas.push("INSERT IGNORE INTO usuarios (nombre, apellido, email, contrasena, rol_id, debe_cambiar_password) VALUES");
lineas.push([...docentes].sort().map(([etiqueta, email]) => `  (${sql(etiqueta)}, '', ${sql(email)}, '${DEMO_HASH}', (SELECT id_rol FROM roles WHERE nombre = 'Docente'), 1)`).join(",\n") + ";", "");
lineas.push("INSERT IGNORE INTO horario_clases (curso_id, dia_semana, franja_id, grupo, materia_id, docente_id, aula_id, vigente_desde) VALUES");
lineas.push(filas.map((f) => `  ((SELECT id_cursos FROM cursos WHERE anio = '${f.anio}' AND division = '${f.division}'), ${f.dia}, (SELECT id_franja FROM franjas_horarias WHERE orden = ${f.orden}), ${f.grupo}, (SELECT id_materia FROM materias WHERE nombre = ${sql(f.materia)}), ${f.docente ? `(SELECT id_usuario FROM usuarios WHERE email = ${sql(docentes.get(f.docente))})` : "NULL"}, ${f.aula ? `(SELECT id_aula FROM aulas WHERE codigo = ${sql(f.aula)})` : "NULL"}, '${VIGENTE_DESDE}')`).join(",\n") + ";");
fs.writeFileSync(salida, lineas.join("\n") + "\n");

console.log(`cursos: ${new Set(filas.map((f) => f.codigo)).size} | filas: ${filas.length} | materias: ${materias.size} | aulas: ${aulas.size} | docentes: ${docentes.size}`);
console.log(avisos.length ? avisos.join("\n") : "sin avisos");
