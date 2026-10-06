// Hook PostToolUse: lint rápido del archivo recién editado.
// - .ts/.tsx de un frontend: oxlint del propio frontend (milisegundos).
// - .php: php -l, si php está en el PATH (en Windows con XAMPP, agregalo).
// Si encuentra errores sale con código 2: Claude ve el resultado y lo corrige.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

let entrada = "";
for await (const parte of process.stdin) entrada += parte;
let datos;
try {
  datos = JSON.parse(entrada);
} catch {
  process.exit(0);
}
const archivo = String(datos.tool_input?.file_path ?? "");
if (!archivo || !existsSync(archivo)) process.exit(0);
const raiz = process.env.CLAUDE_PROJECT_DIR || datos.cwd || process.cwd();
const absoluto = path.resolve(raiz, archivo);
const relativo = path.relative(raiz, absoluto).split(path.sep).join("/");

const correr = (comando, args, cwd) => {
  try {
    execFileSync(comando, args, { cwd, stdio: "pipe", encoding: "utf8", shell: process.platform === "win32" });
    return null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    return `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error.message);
  }
};

let problema = null;
const frontend = /^(Galisencia|Galiservas)\/Frontend\//.exec(relativo);
if (frontend && /\.(ts|tsx)$/.test(relativo)) {
  const dir = path.join(raiz, frontend[1], "Frontend");
  const bin = path.join(dir, "node_modules", ".bin", process.platform === "win32" ? "oxlint.cmd" : "oxlint");
  if (existsSync(bin)) {
    const salida = correr(bin, [path.relative(dir, absoluto)], dir);
    // oxlint sale con 1 solo ante errores; los warnings no bloquean.
    if (salida && /\berror\b/i.test(salida)) problema = salida;
  }
} else if (/\.php$/.test(relativo)) {
  problema = correr("php", ["-l", absoluto], raiz);
}

if (problema) {
  process.stderr.write(`Lint de ${relativo}:\n${problema.slice(0, 4000)}\n`);
  process.exit(2);
}
process.exit(0);
