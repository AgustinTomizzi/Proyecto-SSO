import { useEffect, useState } from 'react'
import { getReservationReport, getReservations } from '../api'
import { exportarReporteReservas, nombreCategoria } from '../exportarReporte'
import { hoyLocal } from '../fecha'
import type { ReservationReport } from '../types'
import { messageOf } from '../utils'
import { Icon } from './Icon'
import './reportes.css'

type Preset = 'mes' | '30' | 'ciclo' | 'otro'

// Fechas como YYYY-MM-DD; la aritmética va en UTC para no correr el día.
function sumarDias(iso: string, dias: number) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias))
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`
}
const diasEntre = (desde: string, hasta: string) => {
  const aUtc = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d) }
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000)
}
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/')
const MAX_DIAS_DETALLE = 92

function rangoDe(preset: Exclude<Preset, 'otro'>) {
  const hoy = hoyLocal()
  if (preset === '30') return { desde: sumarDias(hoy, -29), hasta: hoy }
  if (preset === 'ciclo') return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: `${hoy.slice(0, 4)}-12-31` }
  const inicio = `${hoy.slice(0, 7)}-01`
  const [anio, mes] = hoy.split('-').map(Number)
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return { desde: inicio, hasta: `${hoy.slice(0, 7)}-${String(ultimo).padStart(2, '0')}` }
}

function ReportBars({ rows }: { rows: { key: string, label: string, main: string, detail: string, value: number }[] }) {
  if (!rows.length) return <p className="cart-empty">No hay reservas en el período.</p>
  const max = Math.max(...rows.map((row) => row.value), 1)
  return <div className="report-bars">{rows.map((row) => <div className="report-bar" key={row.key}>
    <div className="report-bar__top"><span className="report-bar__label">{row.label}</span><b>{row.main}</b></div>
    <div className="report-bar__track"><span style={{ width: `${Math.round(row.value / max * 100)}%` }}/></div>
    <small>{row.detail}</small>
  </div>)}</div>
}

/** Reportes de reservas por período, con exportación a Excel e impresión. */
export function ReportesReservas({ onError }: { onError: (mensaje: string) => void }) {
  const [preset, setPreset] = useState<Preset>('mes')
  const [rango, setRango] = useState(() => rangoDe('mes'))
  const [intento, setIntento] = useState(0)
  const [exportando, setExportando] = useState(false)
  const rangoValido = Boolean(rango.desde && rango.hasta && rango.desde <= rango.hasta)
  const clave = `${rango.desde}|${rango.hasta}|${intento}`
  const [resultado, setResultado] = useState<{ clave: string, report: ReservationReport | null, error: string } | null>(null)

  useEffect(() => {
    if (!rangoValido) return
    let vigente = true
    getReservationReport({ from: rango.desde, to: rango.hasta })
      .then((report) => { if (vigente) setResultado({ clave, report, error: '' }) })
      .catch((error: unknown) => { if (vigente) setResultado({ clave, report: null, error: messageOf(error) }) })
    return () => { vigente = false }
  }, [rango.desde, rango.hasta, clave, rangoValido])

  const cargando = rangoValido && resultado?.clave !== clave
  const report = cargando ? null : resultado?.report ?? null
  const error = cargando ? '' : resultado?.error ?? ''
  const periodo = `${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}`
  const elegir = (valor: Preset) => { setPreset(valor); if (valor !== 'otro') setRango(rangoDe(valor)) }
  const totalReservas = report?.byCategory.reduce((suma, item) => suma + item.reservations, 0) ?? 0
  const totalUnidades = report?.byCategory.reduce((suma, item) => suma + item.units, 0) ?? 0

  const exportar = async () => {
    if (!report) return
    setExportando(true)
    try {
      // El detalle sale de reservas.php, que acepta rangos de hasta 93 días.
      const reservas = diasEntre(rango.desde, rango.hasta) <= MAX_DIAS_DETALLE ? await getReservations(undefined, { from: rango.desde, to: rango.hasta }) : null
      await exportarReporteReservas(report, periodo, reservas)
    } catch (motivo) {
      onError(`No se pudo exportar el reporte: ${messageOf(motivo)}`)
    } finally {
      setExportando(false)
    }
  }

  return <div className="reportes-reservas">
    <section className="card card-pad-lg reportes-filtros no-print">
      <div className="seg" role="group" aria-label="Período del reporte">
        {([['mes', 'Este mes'], ['30', 'Últimos 30 días'], ['ciclo', 'Ciclo lectivo'], ['otro', 'Otro período']] as const).map(([valor, texto]) =>
          <button key={valor} type="button" className={`seg__btn${preset === valor ? ' on' : ''}`} aria-pressed={preset === valor} onClick={() => elegir(valor)}>{texto}</button>)}
      </div>
      <div className="gform reportes-filtros__fechas">
        <label>Desde<input type="date" value={rango.desde} max={rango.hasta || undefined} onChange={(e) => { setPreset('otro'); setRango((actual) => ({ ...actual, desde: e.target.value })) }}/></label>
        <label>Hasta<input type="date" value={rango.hasta} min={rango.desde || undefined} onChange={(e) => { setPreset('otro'); setRango((actual) => ({ ...actual, hasta: e.target.value })) }}/></label>
        <div className="reportes-filtros__acciones">
          <button type="button" className="btn btn-ghost" onClick={() => window.print()} disabled={!report}><Icon name="printer"/>Imprimir / PDF</button>
          <button type="button" className="btn btn-primary" onClick={() => void exportar()} disabled={!report || exportando}><Icon name="download"/>{exportando ? 'Exportando...' : 'Excel'}</button>
        </div>
      </div>
      {!rangoValido && <div className="alert alert--error alert--compact" role="alert"><Icon name="alert"/><span>Elegí un período válido: la fecha de inicio no puede ser posterior a la de fin.</span></div>}
    </section>

    <div className="print-only reportes-print-head">
      <h1>Galiservas · Reporte de reservas</h1>
      <p>Período: {periodo}. Reservas confirmadas y finalizadas. {totalReservas} reservas, {totalUnidades} unidades.</p>
    </div>

    {error && <div className="app__offline" role="alert">
      <div><strong>No se pudo cargar el reporte</strong><span>{error}</span></div>
      <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
    </div>}
    {cargando && <div className="loading-line" role="status"><span className="spinner"/>Cargando reporte...</div>}
    {report && <>
      <div className="grid grid-3 stats-row no-print">
        <div className="stat"><div className="stat__icon"><Icon name="calendar"/></div><div className="stat__label">Reservas</div><div className="stat__value">{totalReservas}</div><div className="stat__hint">confirmadas y finalizadas</div></div>
        <div className="stat stat--success"><div className="stat__icon"><Icon name="layers"/></div><div className="stat__label">Unidades</div><div className="stat__value">{totalUnidades}</div><div className="stat__hint">equipos reservados</div></div>
        <div className="stat"><div className="stat__icon"><Icon name="clock"/></div><div className="stat__label">Período</div><div className="stat__value reportes-periodo">{diasEntre(rango.desde, rango.hasta) + 1} días</div><div className="stat__hint">{periodo}</div></div>
      </div>
      <div className="grid grid-3 reports-grid">
        <section className="card card-pad-lg"><p className="card-kicker">Por categoría</p><h3 className="card-title">Uso del inventario</h3>
          <ReportBars rows={report.byCategory.map((item) => ({ key: item.category, label: nombreCategoria(item.category), main: `${item.units} unidades`, detail: `${item.reservations} reservas`, value: item.units }))}/>
        </section>
        <section className="card card-pad-lg"><p className="card-kicker">Más utilizados</p><h3 className="card-title">Recursos</h3>
          <ReportBars rows={report.byResource.map((item) => ({ key: item.resourceId, label: item.resourceName, main: `${item.units} unidades`, detail: `${item.reservations} reservas`, value: item.units }))}/>
        </section>
        <section className="card card-pad-lg"><p className="card-kicker">Horarios</p><h3 className="card-title">Franjas más solicitadas</h3>
          <ReportBars rows={report.byHour.map((item) => ({ key: String(item.hour), label: `${String(item.hour).padStart(2, '0')}:00`, main: `${item.reservations} reservas`, detail: `${item.units} unidades`, value: item.reservations }))}/>
        </section>
      </div>
    </>}
  </div>
}
