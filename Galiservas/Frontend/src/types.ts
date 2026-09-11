export type Page = 'dashboard' | 'aulas' | 'panol' | 'reservations' | 'reports' | 'mine' | 'new'

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

export interface ReservationReport {
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
}

export interface ReservationInput {
  resourceId: string
  date: string
  start: string
  end: string
  quantity: number
  reason: string
}
