import type { Session } from './types'

export const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
export const GALISENCIA_URL = import.meta.env.VITE_GALISENCIA_URL || '/'
export const canAccessGaliservas = (session: Session) => session.permissions.some((permission) => normalize(permission) === 'galiservas.acceder')
  && session.systems.some((system) => normalize(system) === 'galiservas')

// ---- Login único con Galisencia (mismo origen detrás del proxy) ----

const CANAL_SESION = 'galileo-sesion'

/** URL del login de Galisencia con el regreso a la página actual (?next=). */
export function urlLoginGalisencia(): string {
  const galisencia = new URL(GALISENCIA_URL, window.location.href)
  const destino = galisencia.origin === window.location.origin ? window.location.pathname + window.location.search : window.location.href
  const base = galisencia.href.endsWith('/') ? galisencia.href : `${galisencia.href}/`
  return `${base}login?next=${encodeURIComponent(destino)}`
}

export function avisarCierreSesion() {
  try {
    const canal = new BroadcastChannel(CANAL_SESION)
    canal.postMessage({ tipo: 'logout' })
    canal.close()
  } catch {
    /* navegador sin BroadcastChannel */
  }
}

export function escucharCierreSesion(alCerrar: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const canal = new BroadcastChannel(CANAL_SESION)
  canal.onmessage = (evento: MessageEvent<{ tipo?: string }>) => { if (evento.data?.tipo === 'logout') alCerrar() }
  return () => canal.close()
}
