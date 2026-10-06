// Cola de asistencia sin conexión (PWA). Si al guardar falla la red, las marcas
// quedan acá y se reenvían solas al volver la conexión. Por privacidad solo se
// guardan ids, fecha y estado: ningún nombre, DNI ni email. Se borra al cerrar
// sesión. El servidor hace upsert por alumno, materia y fecha: reenviar es seguro.
import { apiSend } from "./apiClient";
import type { EstadoCargable } from "./types";

export interface MarcaPendiente {
  /** alumnoId|materiaId|fecha: una sola marca pendiente por clase (gana la última). */
  clave: string;
  alumnoId: string;
  materiaId: string;
  fecha: string;
  estado: EstadoCargable;
  /** Usuario que la tomó: otra sesión en el mismo teléfono no la envía. */
  usuarioId: string;
}

const BASE = "galisencia";
const TIENDA = "asistencia-pendiente";
const EVENTO = "galisencia:cola-asistencia";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TIENDA, { keyPath: "clave" });
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function conTienda<T>(modo: IDBTransactionMode, accion: (tienda: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(TIENDA, modo);
      const pedido = accion(tx.objectStore(TIENDA));
      tx.oncomplete = () => resolve(pedido ? pedido.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const avisar = () => window.dispatchEvent(new Event(EVENTO));

/** Error de red (sin conexión), no un rechazo de la API. */
export function esErrorDeRed(error: unknown): boolean {
  return !navigator.onLine || error instanceof TypeError;
}

export async function encolar(marcas: Omit<MarcaPendiente, "clave">[]): Promise<void> {
  await conTienda("readwrite", (tienda) => {
    for (const marca of marcas) tienda.put({ ...marca, clave: `${marca.alumnoId}|${marca.materiaId}|${marca.fecha}` });
  });
  avisar();
}

export async function pendientes(usuarioId: string): Promise<MarcaPendiente[]> {
  if (typeof indexedDB === "undefined") return [];
  const todas = (await conTienda<MarcaPendiente[]>("readonly", (tienda) => tienda.getAll() as IDBRequest<MarcaPendiente[]>)) ?? [];
  return todas.filter((marca) => marca.usuarioId === usuarioId);
}

async function quitar(clave: string): Promise<void> {
  await conTienda("readwrite", (tienda) => { tienda.delete(clave); });
}

/** Borra todo (al cerrar sesión). */
export async function vaciarCola(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await conTienda("readwrite", (tienda) => { tienda.clear(); });
  avisar();
}

export interface ResultadoSincronizacion {
  enviadas: number;
  rechazadas: { marca: MarcaPendiente; error: string }[];
  sinConexion: boolean;
}

let sincronizando: Promise<ResultadoSincronizacion> | null = null;

/**
 * Reenvía las marcas pendientes del usuario. Si vuelve a fallar la red, se
 * detiene y las deja. Si la API rechaza una (por ejemplo, ya no tiene ese
 * curso), la saca de la cola y la informa.
 */
export function sincronizar(usuarioId: string): Promise<ResultadoSincronizacion> {
  sincronizando ??= (async () => {
    const resultado: ResultadoSincronizacion = { enviadas: 0, rechazadas: [], sinConexion: false };
    try {
      for (const marca of await pendientes(usuarioId)) {
        try {
          await apiSend("/asistencias.php", "POST", { alumnoId: marca.alumnoId, materiaId: marca.materiaId, fecha: marca.fecha, estado: marca.estado });
          await quitar(marca.clave);
          resultado.enviadas++;
        } catch (error) {
          if (esErrorDeRed(error)) {
            resultado.sinConexion = true;
            break;
          }
          await quitar(marca.clave);
          resultado.rechazadas.push({ marca, error: error instanceof Error ? error.message : String(error) });
        }
      }
    } finally {
      sincronizando = null;
      avisar();
    }
    return resultado;
  })();
  return sincronizando;
}

/** Suscripción a cambios de la cola (para mostrar el contador). */
export function alCambiarCola(callback: () => void): () => void {
  window.addEventListener(EVENTO, callback);
  return () => window.removeEventListener(EVENTO, callback);
}
