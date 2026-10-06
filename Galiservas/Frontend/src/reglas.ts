import { hoyLocal, horaLocal } from './fecha'
import type { InstitutionConfig } from './types'

// Espejo en el cliente de las reglas institucionales de reserva. La validación
// que vale es la del servidor (reservas.php); esto solo avisa antes de enviar.

const minutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * 60 + (m || 0) }

function sumarDias(iso: string, dias: number) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias))
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`
}

const numero = (config: InstitutionConfig, clave: string) => Number(config.valores[clave] ?? 0)

/** Última fecha reservable (YYYY-MM-DD) o undefined si no hay límite o quien reserva administra. */
export function fechaMaxima(config: InstitutionConfig | null, admin: boolean) {
  const dias = config ? numero(config, 'reservas.anticipacion_maxima_dias') : 0
  return !config || admin || dias <= 0 ? undefined : sumarDias(hoyLocal(), dias)
}

export function resumenReglas(config: InstitutionConfig | null, admin: boolean) {
  if (!config) return ''
  const partes = [`Horario: ${config.franjasReserva.map((f) => `${f.desde} a ${f.hasta}`).join(' y ')}`]
  const duracion = numero(config, 'reservas.duracion_maxima_min')
  partes.push(`máximo ${duracion % 60 === 0 ? `${duracion / 60} h` : `${duracion} min`} por reserva`)
  if (!admin) {
    const minima = numero(config, 'reservas.anticipacion_minima_horas')
    const maxima = numero(config, 'reservas.anticipacion_maxima_dias')
    if (minima > 0) partes.push(`con ${minima} h de anticipación`)
    if (maxima > 0) partes.push(`hasta ${maxima} días antes`)
  }
  return `${partes.join(' · ')}.`
}

/** Mensaje de error si la reserva no cumple las reglas, o '' si las cumple. */
export function errorReglas(config: InstitutionConfig | null, admin: boolean, fecha: string, inicio: string, fin: string) {
  if (!config || !fecha || !inicio || !fin || inicio >= fin) return ''
  if (!config.franjasReserva.some((f) => inicio >= f.desde && fin <= f.hasta)) {
    return `La reserva tiene que quedar dentro del horario habilitado (${config.franjasReserva.map((f) => `${f.desde} a ${f.hasta}`).join(' y ')}).`
  }
  const duracion = numero(config, 'reservas.duracion_maxima_min')
  if (minutos(fin) - minutos(inicio) > duracion) return `La reserva no puede durar más de ${duracion} minutos.`
  if (admin) return ''
  const minima = numero(config, 'reservas.anticipacion_minima_horas')
  if (minima > 0) {
    const hoy = hoyLocal()
    const faltanMin = (Date.UTC(...fechaPartes(fecha)) - Date.UTC(...fechaPartes(hoy))) / 60000 + minutos(inicio) - minutos(horaLocal())
    if (faltanMin < minima * 60) return `Las reservas se hacen con al menos ${minima} horas de anticipación.`
  }
  const maxima = fechaMaxima(config, admin)
  if (maxima && fecha > maxima) return `Las reservas se hacen con hasta ${numero(config, 'reservas.anticipacion_maxima_dias')} días de anticipación.`
  return ''
}

function fechaPartes(iso: string): [number, number, number] {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return [anio, mes - 1, dia]
}
