export type Page = 'dashboard' | 'aulas' | 'panol' | 'calendar' | 'reservations' | 'rules' | 'resources' | 'reports' | 'mine' | 'new'

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
  mustChangePassword: boolean
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
  category: Resource['category'] | ''
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

export type ConfigValue = string | number | boolean

export interface ConfigField {
  clave: string
  tipo: 'bool' | 'int' | 'hora'
  defecto: ConfigValue
  etiqueta: string
  min?: number
  max?: number
}

export interface InstitutionConfig {
  valores: Record<string, ConfigValue>
  esquema: ConfigField[]
  franjasReserva: { desde: string, hasta: string }[]
  puedeEditar: boolean
}
