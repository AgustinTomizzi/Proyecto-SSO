// Service worker de Galisencia (PWA). Solo guarda la aplicación (HTML, JS, CSS,
// íconos): NUNCA respuestas de /api/, que son datos personales de menores y no
// deben quedar en el teléfono. La asistencia que no se pudo enviar la guarda la
// app (IndexedDB, solo ids) y la reenvía al volver la conexión.

const VERSION = "galisencia-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/icono-192.png", "/icono-512.png", "/logogalisenciasinfondo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== VERSION).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Solo el mismo origen, y nunca la API ni Galiservas (tiene su propia app).
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/galiservas")) return;

  // Navegación: primero la red (versión nueva); sin conexión, la app guardada.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put("/index.html", copia));
          return respuesta;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Archivos del build (/assets/ tienen hash en el nombre): de la caché si están.
  if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((guardada) => guardada || fetch(request).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      }))
    );
  }
});
