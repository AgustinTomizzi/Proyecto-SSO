import type { Session } from './types'

export const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
export const GALISENCIA_URL = import.meta.env.VITE_GALISENCIA_URL || '/'
export const canAccessGaliservas = (session: Session) => session.permissions.some((permission) => normalize(permission) === 'galiservas.acceder')
  && session.systems.some((system) => normalize(system) === 'galiservas')
