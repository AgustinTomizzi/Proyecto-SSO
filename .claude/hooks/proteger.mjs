// Hook PreToolUse: hace cumplir reglas de CLAUDE.md antes de ejecutar.
// - docker compose down -v (borra la base) solo con un proyecto de pruebas
//   explícito (-p distinto del stack principal "galileo").
// - No se edita .env (secretos; la plantilla es .env.example).
// - No se editan migraciones ya commiteadas (regla 7: cada cambio va en un SQL
//   nuevo). 01-schema.sql y 02-seed.sql sí se actualizan.
// Sale con código 2 y un mensaje en stderr para bloquear.
import { execFileSync } from "node:child_process";
import path from "node:path";

const bloquear = (mensaje) => {
  process.stderr.write(`${mensaje}\n`);
  process.exit(2);
};

let entrada = "";
for await (const parte of process.stdin) entrada += parte;
let datos;
try {
  datos = JSON.parse(entrada);
} catch {
  process.exit(0);
}
const herramienta = datos.tool_name ?? "";
const input = datos.tool_input ?? {};
const raiz = process.env.CLAUDE_PROJECT_DIR || datos.cwd || process.cwd();

if (herramienta === "Bash" || herramienta === "PowerShell") {
  const comando = String(input.command ?? "");
  for (const tramo of comando.split(/&&|\|\||;|\n/)) {
    if (!/docker[\s-]+compose\b[\s\S]*\bdown\b/.test(tramo)) continue;
    if (!/(\s-v\b|\s--volumes\b)/.test(tramo)) continue;
    const proyecto = /(?:\s-p\s+|\s--project-name[\s=]+)([\w.-]+)/.exec(tramo)?.[1];
    if (!proyecto || proyecto === "galileo") {
      bloquear("Bloqueado por .claude/hooks/proteger.mjs: `docker compose down -v` borra la base. CLAUDE.md pide confirmación del usuario; para el stack de pruebas usá un proyecto explícito (-p fase0).");
    }
  }
  process.exit(0);
}

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(herramienta)) {
  const archivo = String(input.file_path ?? input.notebook_path ?? "");
  if (!archivo) process.exit(0);
  const relativo = path.relative(raiz, path.resolve(raiz, archivo)).split(path.sep).join("/");
  if (/(^|\/)\.env$/.test(relativo)) {
    bloquear("Bloqueado: .env tiene secretos y no se edita desde Claude. Cambiá .env.example (plantilla) y avisale al usuario qué variable agregar.");
  }
  const migracion = /^db\/(\d{2})[\w.-]*\.(sql|sh)$/.exec(relativo);
  if (migracion && !["01", "02"].includes(migracion[1])) {
    let commiteada = false;
    try {
      execFileSync("git", ["ls-files", "--error-unmatch", relativo], { cwd: raiz, stdio: "ignore" });
      commiteada = true;
    } catch {
      commiteada = false;
    }
    if (commiteada) {
      bloquear(`Bloqueado: ${relativo} ya está commiteada. Regla 7 de CLAUDE.md: los cambios de esquema van en un SQL nuevo, numerado e idempotente (skill /nueva-migracion), y se reflejan en 01-schema.sql y 02-seed.sql.`);
    }
  }
}
process.exit(0);
