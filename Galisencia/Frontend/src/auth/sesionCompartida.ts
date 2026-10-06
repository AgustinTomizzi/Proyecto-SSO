// Login único entre Galisencia y Galiservas (mismo origen detrás del proxy).
// Galiservas manda a /login?next=<destino>; después del login (y del cambio
// de contraseña, si corresponde) se vuelve al destino. El cierre de sesión se
// avisa a la otra app con BroadcastChannel.

const CANAL = "galileo-sesion";
const CLAVE_DESTINO = "galileo.destino";

const GALISERVAS_URL: string = (import.meta as any).env?.VITE_GALISERVAS_URL ?? "/galiservas/";

/**
 * Solo acepta rutas del mismo origen ("/galiservas/…", nunca "//otro") o, en
 * desarrollo, la URL configurada de Galiservas. Evita redirecciones abiertas.
 */
export function destinoSeguro(valor: string | null): string | null {
  if (!valor) return null;
  if (valor.startsWith("/") && !valor.startsWith("//") && !valor.startsWith("/\\")) return valor;
  try {
    const destino = new URL(valor);
    const galiservas = new URL(GALISERVAS_URL, window.location.href);
    if (destino.origin === galiservas.origin && destino.pathname.startsWith(galiservas.pathname)) return destino.href;
  } catch {
    /* no es una URL válida */
  }
  return null;
}

export function guardarDestino(destino: string): void {
  try {
    sessionStorage.setItem(CLAVE_DESTINO, destino);
  } catch {
    /* noop */
  }
}

/** Devuelve el destino pendiente (validado) y lo borra. */
export function tomarDestino(): string | null {
  try {
    const destino = sessionStorage.getItem(CLAVE_DESTINO);
    sessionStorage.removeItem(CLAVE_DESTINO);
    return destinoSeguro(destino);
  } catch {
    return null;
  }
}

export function avisarCierreSesion(): void {
  try {
    const canal = new BroadcastChannel(CANAL);
    canal.postMessage({ tipo: "logout" });
    canal.close();
  } catch {
    /* navegador sin BroadcastChannel */
  }
}

export function escucharCierreSesion(alCerrar: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const canal = new BroadcastChannel(CANAL);
  canal.onmessage = (evento: MessageEvent<{ tipo?: string }>) => {
    if (evento.data?.tipo === "logout") alCerrar();
  };
  return () => canal.close();
}
