// Exportación del reporte de reservas a Excel. exceljs se carga bajo demanda
// para no engordar el bundle inicial.
import type { Workbook, Worksheet } from 'exceljs'
import type { Reservation, ReservationReport, Resource } from './types'

const FUENTE = 'Arial'
const ENCABEZADO = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0F2FE' } }

export const nombreCategoria = (category: Resource['category'] | '') => category === 'audiovisual' ? 'Audiovisuales' : category === 'hardware_pc' ? 'Hardware de PC' : '—'

async function crearLibro(): Promise<Workbook> {
  const mod = await import('exceljs')
  // Según el empaquetado, la clase llega como export nombrado o dentro de default.
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Galiservas'
  libro.created = new Date()
  return libro
}

function tabla(hoja: Worksheet, titulo: string, subtitulo: string, columnas: { titulo: string, ancho: number }[], filas: (string | number)[][]) {
  hoja.columns = columnas.map((columna) => ({ width: columna.ancho }))
  hoja.addRow([titulo]).font = { name: FUENTE, size: 13, bold: true }
  hoja.addRow([subtitulo]).font = { name: FUENTE, size: 10, italic: true }
  hoja.addRow([])
  const cabecera = hoja.addRow(columnas.map((columna) => columna.titulo))
  cabecera.eachCell((celda) => { celda.font = { name: FUENTE, bold: true }; celda.fill = ENCABEZADO })
  filas.forEach((fila) => { hoja.addRow(fila).font = { name: FUENTE } })
  if (!filas.length) hoja.addRow(['Sin datos en el período.']).font = { name: FUENTE, italic: true }
  hoja.views = [{ state: 'frozen', ySplit: 4 }]
}

/**
 * Libro con el resumen por categoría, recurso y hora y, si se pasan, el
 * detalle de las reservas del período.
 */
export async function exportarReporteReservas(report: ReservationReport, periodo: string, reservas: Reservation[] | null) {
  const libro = await crearLibro()
  const subtitulo = `Período: ${periodo}. Reservas confirmadas y finalizadas.`
  tabla(libro.addWorksheet('Por categoría'), 'Uso por categoría', subtitulo,
    [{ titulo: 'Categoría', ancho: 24 }, { titulo: 'Reservas', ancho: 12 }, { titulo: 'Unidades', ancho: 12 }],
    report.byCategory.map((item) => [nombreCategoria(item.category), item.reservations, item.units]))
  tabla(libro.addWorksheet('Por recurso'), 'Recursos más utilizados', subtitulo,
    [{ titulo: 'Recurso', ancho: 30 }, { titulo: 'Categoría', ancho: 18 }, { titulo: 'Reservas', ancho: 12 }, { titulo: 'Unidades', ancho: 12 }],
    report.byResource.map((item) => [item.resourceName, nombreCategoria(item.category), item.reservations, item.units]))
  tabla(libro.addWorksheet('Por hora'), 'Franjas más solicitadas', subtitulo,
    [{ titulo: 'Hora de inicio', ancho: 16 }, { titulo: 'Reservas', ancho: 12 }, { titulo: 'Unidades', ancho: 12 }],
    [...report.byHour].sort((a, b) => a.hour - b.hour).map((item) => [`${String(item.hour).padStart(2, '0')}:00`, item.reservations, item.units]))
  const detalle = libro.addWorksheet('Reservas')
  if (reservas) {
    tabla(detalle, 'Detalle de reservas', `Período: ${periodo}. Todos los estados.`,
      [{ titulo: 'Fecha', ancho: 12 }, { titulo: 'Inicio', ancho: 8 }, { titulo: 'Fin', ancho: 8 }, { titulo: 'Recurso', ancho: 28 }, { titulo: 'Categoría', ancho: 16 }, { titulo: 'Cantidad', ancho: 10 }, { titulo: 'Reservó', ancho: 24 }, { titulo: 'Motivo', ancho: 40 }, { titulo: 'Estado', ancho: 12 }],
      [...reservas].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
        .map((item) => [item.date.split('-').reverse().join('/'), item.start, item.end, item.resourceName, nombreCategoria(item.category), item.quantity, item.userName, item.reason, item.status]))
  } else {
    detalle.addRow(['El detalle se incluye para períodos de hasta 93 días.']).font = { name: FUENTE, italic: true }
  }

  const buffer = await libro.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `reporte-reservas-${periodo.replace(/[^\d]+/g, '-').replace(/^-|-$/g, '')}.xlsx`
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
