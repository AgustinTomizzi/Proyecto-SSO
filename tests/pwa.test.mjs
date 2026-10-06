// Prueba de la PWA de Galisencia en Chrome headless (perfil temporal):
// - el service worker se registra y controla la página;
// - la caché tiene solo la app (nunca respuestas de /api/, que son datos personales);
// - sin conexión, la app abre igual.
// Uso: BASE_URL=http://localhost:3000 node tests/pwa.test.mjs
// Necesita Chrome o Chromium (CHROME_PATH para indicar la ruta); si no lo
// encuentra, avisa y termina sin fallar.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const candidatos = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const CHROME = candidatos.find((ruta) => existsSync(ruta));
if (!CHROME) {
  console.log("PWA: NO SE EJECUTÓ (no se encontró Chrome; definí CHROME_PATH).");
  process.exit(0);
}

const PUERTO = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(path.join(os.tmpdir(), "galisencia-pwa-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, "--no-first-run", "--no-sandbox", "about:blank"], { stdio: "ignore" });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let destino;
  for (let i = 0; i < 60 && !destino; i++) {
    await esperar(250);
    try { destino = (await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()).find((t) => t.type === "page"); } catch { /* arrancando */ }
  }
  assert.ok(destino, "Chrome no abrió el puerto de depuración");
  const ws = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pendientes = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); } });
  const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; pendientes.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluar = async (expresion) => (await cdp("Runtime.evaluate", { expression: expresion, awaitPromise: true, returnByValue: true })).result?.result?.value;

  await cdp("Page.enable");
  await cdp("Network.enable");
  await cdp("Page.navigate", { url: `${BASE}/login` });
  await esperar(4000);
  assert.equal(await evaluar("navigator.serviceWorker.ready.then(r => r.active && r.active.state)"), "activated", "el service worker se activa");
  await esperar(1000);
  assert.equal(await evaluar("!!navigator.serviceWorker.controller"), true, "el service worker controla la página");

  const manifest = await evaluar(`fetch('/manifest.webmanifest').then(async r => ({ tipo: r.headers.get('content-type'), datos: await r.json() }))`);
  assert.match(manifest.tipo, /application\/manifest\+json/);
  assert.equal(manifest.datos.display, "standalone");
  assert.ok(manifest.datos.icons.some((i) => i.purpose === "maskable"), "ícono maskable");

  // Una consulta a la API con el SW activo no debe quedar en caché.
  await evaluar("fetch('/api/sesion.php').catch(() => null)");
  await esperar(500);
  const urls = await evaluar(`(async () => { const urls = []; for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) urls.push(new URL(req.url).pathname); return urls; })()`);
  assert.ok(urls.includes("/index.html"), "la app quedó en caché");
  assert.ok(!urls.some((u) => u.startsWith("/api/")), "ninguna respuesta de la API en caché");

  await cdp("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp("Page.navigate", { url: `${BASE}/preceptor` });
  await esperar(3000);
  const sinRed = await evaluar("({ titulo: document.title, hijos: document.getElementById('root')?.children.length ?? 0 })");
  assert.equal(sinRed.titulo, "Galisencia · Asistencia", "sin conexión carga la app");
  assert.ok(sinRed.hijos > 0, "sin conexión la app se renderiza");
  ws.close();
  console.log("PWA OK: service worker activo, caché solo de la app y carga sin conexión.");
} finally {
  chrome.kill();
  await esperar(500);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* Chrome puede tardar en soltar el perfil */ }
}
