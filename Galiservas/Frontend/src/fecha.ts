// Zona horaria única del sistema (PHP, MySQL y frontend). No usar
// toISOString() para fechas "de hoy": devuelve la fecha en UTC, que desde las
// 21:00 de Argentina ya es el día siguiente.
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function partes(ahora: Date) {
  return Object.fromEntries(formato.formatToParts(ahora).map((parte) => [parte.type, parte.value]))
}

/** Fecha de hoy en Argentina como YYYY-MM-DD. Llamarla en cada uso, no al cargar el módulo. */
export function hoyLocal(ahora = new Date()): string {
  const p = partes(ahora)
  return `${p.year}-${p.month}-${p.day}`
}

/** Hora actual en Argentina como HH:MM. */
export function horaLocal(ahora = new Date()): string {
  const p = partes(ahora)
  return `${p.hour}:${p.minute}`
}
