export type Page = 'dashboard' | 'aulas' | 'panol' | 'reservations' | 'resources' | 'reports' | 'mine' | 'new' | 'incidents'

export interface User {
  id: string
  name: string
  email: string
  role: string
}

export interface Session {
  user: User
  permissions: string[]
  systems: string[]
}

export interface Resource {
  id: string
  name: string
  type: 'desktop_pc' | 'notebook' | 'teclado' | 'mouse' | 'cpu' | 'proyector' | 'camara' | 'microfono' | 'parlante' | 'cable' | 'otro'
  category: 'hardware_pc' | 'audiovisual'
  location: string
  description: string
  capacity: number
  reserved: number
  available: number
  active: boolean
}

export interface MonthlyResource {
  resourceId: string
  resourceName: string
  category: Resource['category']
  capacity: number
  reservations: number
  requested: number
  processed: number
  delivered: number
  shortage: number
}
export interface Shortage { reservationId: string, date: string, resourceName: string, requested: number, delivered: number, reason: string }
export interface Incident {
  id: string
  resourceId: string
  resourceName: string
  reservationId: string
  equipmentIdentifier: string
  description: string
  status: 'abierto' | 'resuelto'
  resolution: string
  reporterName: string
  reportedAt: string
}

export interface ReservationReport {
  month: string
  monthly: MonthlyResource[]
  shortages: Shortage[]
  byResource: { resourceId: string, resourceName: string, category: Resource['category'], reservations: number, units: number }[]
  byCategory: { category: Resource['category'], reservations: number, units: number }[]
  byHour: { hour: number, reservations: number, units: number }[]
}

export interface Reservation {
  id: string
  resourceId: string
  resourceName: string
  userId: string
  userName: string
  date: string
  start: string
  end: string
  quantity: number
  reason: string
  status: string
  deliveredQuantity: number | null
  shortageReason: string
  deliveryObservation: string
  deliveredAt: string
}

export interface ReservationInput {
  resourceId: string
  date: string
  start: string
  end: string
  quantity: number
  reason: string
}

export interface ResourceInput {
  name: string
  type: Resource['type']
  category: Resource['category']
  location: string
  description: string
  capacity: number
  active: boolean
  available: boolean
}
