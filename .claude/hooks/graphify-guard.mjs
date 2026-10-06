// Ejecuta `graphify hook-guard <modo>` (hooks que instaló `graphify install
// --project`) buscando el ejecutable en el PATH o en ~/.local/bin, donde lo deja
// `uv tool install graphifyy`. Si graphify no está instalado, no hace nada: así
// el repo funciona igual en máquinas sin graphify.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const modo = process.argv[2] ?? "read";
let entrada = "";
for await (const parte of process.stdin) entrada += parte;

const nombre = process.platform === "win32" ? "graphify.exe" : "graphify";
const candidatos = [
  ...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, nombre)),
  path.join(os.homedir(), ".local", "bin", nombre),
];
const ejecutable = candidatos.find((ruta) => existsSync(ruta));
if (!ejecutable) process.exit(0);

const resultado = spawnSync(ejecutable, ["hook-guard", modo], { input: entrada, encoding: "utf8", cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
if (resultado.stdout) process.stdout.write(resultado.stdout);
if (resultado.stderr) process.stderr.write(resultado.stderr);
process.exit(resultado.status ?? 0);
