import type { Reservation, ReservationInput, ReservationReport, Resource, Session, User } from './types'

const configuredUrl = import.meta.env.VITE_API_URL?.trim()
export const API_URL = (configuredUrl || 'http://localhost:8080/api').replace(/\/+$/, '')

type JsonRecord = Record<string, unknown>

export class ApiError extends Error {
  status: number
  connection: boolean

  constructor(message: string, status = 0, connection = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.connection = connection
  }
}

const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}

const text = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === 'string' || typeof item === 'number')
  return value === undefined ? '' : String(value)
}

const number = (fallback: number, ...values: unknown[]) => {
  const value = values.find((item) => item !== '' && item !== null && item !== undefined)
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function request(path: string, options: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, {
      ...options,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
  } catch {
    throw new ApiError('No se pudo conectar con Galileo Auth. Verificá que XAMPP y la API estén activos.', 0, true)
  }

  const raw = await response.text()
  let data: JsonRecord = {}
  try {
    data = raw ? record(JSON.parse(raw)) : {}
  } catch {
    throw new ApiError('La API devolvió una respuesta inválida. Revisá la ruta configurada.', response.status)
  }

  if (!response.ok || data.ok === false) {
    throw new ApiError(text(data.error, data.mensaje, data.message) || `Error del servidor (${response.status})`, response.status)
  }
  return data
}

function parseUser(value: unknown): User {
  const user = record(value)
  const fullName = [text(user.nombre, user.name), text(user.apellido, user.last_name)].filter(Boolean).join(' ')
  return {
    id: text(user.id, user.id_usuario, user.usuario_id),
    name: fullName || text(user.email, user.correo) || 'Usuario',
    email: text(user.email, user.correo),
    role: text(user.rol_backend, user.rol, user.role, record(user.rol).nombre) || 'usuario',
  }
}

function parsePermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'string' ? item : text(record(item).nombre, record(item).permiso)).filter(Boolean)
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(record(value)).filter(([, allowed]) => Boolean(allowed)).map(([permission]) => permission)
  }
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await request('login.php', { method: 'POST', body: JSON.stringify({ email, password }) })
  return { user: parseUser(data.usuario ?? data.user), permissions: parsePermissions(data.permisos ?? data.permissions), systems: parsePermissions(data.sistemas ?? data.systems) }
}

export async function restoreSession(): Promise<Session> {
  const data = await request('sesion.php')
  return { user: parseUser(data.usuario ?? data.user), permissions: parsePermissions(data.permisos ?? data.permissions), systems: parsePermissions(data.sistemas ?? data.systems) }
}

export async function logout() {
  await request('logout.php', { method: 'POST', body: '{}' })
}

const knownCapacity: Record<string, number> = {
  'aula 210': 6, 'aula 209': 5, 'aula 208': 5, notebooks: 30,
  camaras: 6, microfonos: 8, parlantes: 8, cables: 30,
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function parseResourceType(value: string, name: string): Resource['type'] {
  const type = normalize(`${value} ${name}`)
  if (/(notebook|portatil|laptop|panol)/.test(type)) return 'notebook'
  if (/camara/.test(type)) return 'camara'
  if (/microfono/.test(type)) return 'microfono'
  if (/(parlante|altavoz)/.test(type)) return 'parlante'
  if (/cable/.test(type)) return 'cable'
  if (/teclado/.test(type)) return 'teclado'
  if (/mouse/.test(type)) return 'mouse'
  if (/cpu/.test(type)) return 'cpu'
  if (/proyector/.test(type)) return 'proyector'
  if (/(desktop|pc|aula|laboratorio)/.test(type)) return 'desktop_pc'
  return 'otro'
}

function parseResource(value: unknown): Resource {
  const item = record(value)
  const name = text(item.nombre, item.name, item.recurso)
  const key = normalize(name)
  const capacity = number(knownCapacity[key] ?? 0, item.capacidad, item.capacity, item.cantidad_total, item.total)
  return {
    id: text(item.id, item.id_recurso, item.recurso_id),
    name,
    type: parseResourceType(text(item.type, item.tipo), name),
    category: normalize(text(item.category, item.categoria)) === 'audiovisual' ? 'audiovisual' : 'hardware_pc',
    location: text(item.location, item.ubicacion),
    description: text(item.description, item.descripcion),
    capacity,
    reserved: number(0, item.reserved, item.reservados),
    available: number(capacity, item.disponibles, item.available, item.disponibilidad, item.cantidad_disponible),
    active: item.activo !== false && item.active !== false && item.estado !== 'inactivo',
  }
}

export async function getResources(filters: { date?: string, start?: string, end?: string, location?: string, category?: Resource['category'] } = {}): Promise<Resource[]> {
  const query = new URLSearchParams()
  if (filters.date) query.set('fecha', filters.date)
  if (filters.start) query.set('hora_inicio', filters.start)
  if (filters.end) query.set('hora_fin', filters.end)
  if (filters.location) query.set('ubicacion', filters.location)
  if (filters.category) query.set('categoria', filters.category)
  const data = await request(`recursos.php${query.size ? `?${query}` : ''}`)
  const list = data.recursos ?? data.resources ?? data.data
  return Array.isArray(list) ? list.map(parseResource).filter((item) => item.id && item.name) : []
}

export async function getReservationReport(): Promise<ReservationReport> {
  const data = await request('reportes_reservas.php')
  const report = record(data.report)
  const rows = (value: unknown) => Array.isArray(value) ? value.map(record) : []
  return {
    byResource: rows(report.byResource).map((item) => ({ resourceId: text(item.resourceId), resourceName: text(item.resourceName), category: normalize(text(item.category)) === 'audiovisual' ? 'audiovisual' : 'hardware_pc', reservations: number(0, item.reservations), units: number(0, item.units) })),
    byCategory: rows(report.byCategory).map((item) => ({ category: normalize(text(item.category)) === 'audiovisual' ? 'audiovisual' : 'hardware_pc', reservations: number(0, item.reservations), units: number(0, item.units) })),
    byHour: rows(report.byHour).map((item) => ({ hour: number(0, item.hour), reservations: number(0, item.reservations), units: number(0, item.units) })),
  }
}

function parseReservation(value: unknown): Reservation {
  const item = record(value)
  const resource = record(item.recurso ?? item.resource)
  const user = record(item.usuario ?? item.user)
  return {
    id: text(item.id, item.id_reserva, item.reserva_id),
    resourceId: text(item.recurso_id, item.id_recurso, resource.id, resource.id_recurso),
    resourceName: text(item.recurso_nombre, item.nombre_recurso, resource.nombre, resource.name),
    userId: text(item.usuario_id, item.id_usuario, user.id, user.id_usuario),
    userName: text(item.usuario_nombre, item.nombre_usuario, user.nombre, user.name, item.email),
    date: text(item.fecha, item.date).slice(0, 10),
    start: text(item.hora_inicio, item.inicio, item.start).slice(0, 5),
    end: text(item.hora_fin, item.fin, item.end).slice(0, 5),
    quantity: number(1, item.cantidad, item.quantity, item.equipos),
    reason: text(item.motivo, item.razon, item.reason),
    status: text(item.estado, item.status) || 'pendiente',
  }
}

export async function getReservations(scope?: 'mine'): Promise<Reservation[]> {
  const data = await request(`reservas.php${scope ? '?mias=1' : ''}`)
  const list = data.reservas ?? data.reservations ?? data.data
  return Array.isArray(list) ? list.map(parseReservation).filter((item) => item.id) : []
}

function reservationBody(input: ReservationInput) {
  return {
    recurso_id: input.resourceId,
    fecha: input.date,
    hora_inicio: input.start,
    hora_fin: input.end,
    cantidad: input.quantity,
    motivo: input.reason,
  }
}

export async function createReservation(input: ReservationInput) {
  return request('reservas.php', { method: 'POST', body: JSON.stringify(reservationBody(input)) })
}

export async function updateReservation(id: string, input: ReservationInput) {
  return request('reservas.php', { method: 'PUT', body: JSON.stringify({ id, id_reserva: id, ...reservationBody(input) }) })
}

export async function setReservationStatus(id: string, status: string) {
  return request('reservas.php', { method: 'PUT', body: JSON.stringify({ id, id_reserva: id, estado: status }) })
}

export async function cancelReservation(id: string) {
  try {
    return await setReservationStatus(id, 'cancelada')
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405].includes(error.status)) throw error
    return request(`reservas.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
}
