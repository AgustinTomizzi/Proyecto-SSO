import { useEffect, useState } from 'react'
import { getReservations } from '../api'
import { hoyLocal } from '../fecha'
import type { Reservation, Resource } from '../types'
import { messageOf, normalize } from '../utils'
import { Icon } from './Icon'
import './calendario.css'

type Vista = 'dia' | 'semana' | 'mes'
type Categoria = 'all' | Resource['category']

// Las fechas del calendario son cadenas YYYY-MM-DD; la aritmética se hace en
// UTC para que el día no se corra con la zona horaria del navegador.
const DIA_MS = 86_400_000
const HORA_DESDE = 7
const HORA_HASTA = 22
const PX_POR_HORA = 46
const CHIPS_POR_DIA = 3

function aFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}
function aIso(fecha: Date) {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`
}
const sumarDias = (iso: string, dias: number) => aIso(new Date(aFecha(iso).getTime() + dias * DIA_MS))
const lunesDe = (iso: string) => sumarDias(iso, -((aFecha(iso).getUTCDay() + 6) % 7))
const primeroDelMes = (iso: string, meses = 0) => {
  const fecha = aFecha(iso)
  return aIso(new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1)))
}
const diasDesde = (desde: string, cantidad: number) => Array.from({ length: cantidad }, (_, i) => sumarDias(desde, i))
const minutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * 60 + (m || 0) }

const formatear = (opciones: Intl.DateTimeFormatOptions) => {
  const formato = new Intl.DateTimeFormat('es-AR', { ...opciones, timeZone: 'UTC' })
  return (iso: string) => formato.format(aFecha(iso))
}
const fmtMes = formatear({ month: 'long', year: 'numeric' })
const fmtDiaLargo = formatear({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtDiaCorto = formatear({ day: 'numeric', month: 'short' })
const fmtSemana = formatear({ weekday: 'short' })
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function rango(vista: Vista, referencia: string) {
  if (vista === 'dia') return { desde: referencia, hasta: referencia }
  if (vista === 'semana') { const lunes = lunesDe(referencia); return { desde: lunes, hasta: sumarDias(lunes, 6) } }
  const inicio = lunesDe(primeroDelMes(referencia))
  return { desde: inicio, hasta: sumarDias(inicio, 41) }
}

function titulo(vista: Vista, referencia: string) {
  if (vista === 'dia') return fmtDiaLargo(referencia)
  if (vista === 'mes') return fmtMes(referencia)
  const lunes = lunesDe(referencia)
  return `Semana del ${fmtDiaCorto(lunes)} al ${fmtDiaCorto(sumarDias(lunes, 6))}`
}

function mover(vista: Vista, referencia: string, sentido: 1 | -1) {
  if (vista === 'dia') return sumarDias(referencia, sentido)
  if (vista === 'semana') return sumarDias(referencia, 7 * sentido)
  return primeroDelMes(referencia, sentido)
}

const cancelada = (reserva: Reservation) => ['cancelada', 'rechazada'].includes(normalize(reserva.status))

/** Ubica las reservas de un día en carriles para que las superpuestas no se tapen. */
function ubicar(reservas: Reservation[]) {
  const orden = [...reservas].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  const ubicadas: { reserva: Reservation, carril: number, carriles: number }[] = []
  let grupo: typeof ubicadas = []
  let finGrupo = ''
  let finCarriles: string[] = []
  const cerrarGrupo = () => { grupo.forEach((item) => { item.carriles = finCarriles.length }); ubicadas.push(...grupo); grupo = []; finCarriles = [] }
  for (const reserva of orden) {
    if (grupo.length && reserva.start >= finGrupo) cerrarGrupo()
    let carril = finCarriles.findIndex((fin) => fin <= reserva.start)
    if (carril === -1) { carril = finCarriles.length; finCarriles.push(reserva.end) } else finCarriles[carril] = reserva.end
    grupo.push({ reserva, carril, carriles: 1 })
    finGrupo = grupo.length === 1 || reserva.end > finGrupo ? reserva.end : finGrupo
  }
  cerrarGrupo()
  return ubicadas
}

function Evento({ reserva, seleccionada, onSeleccionar, compacto = false }: { reserva: Reservation, seleccionada: boolean, onSeleccionar: () => void, compacto?: boolean }) {
  const clase = `cal-evento cal-evento--${reserva.category || 'otro'}${cancelada(reserva) ? ' cal-evento--cancelada' : ''}${seleccionada ? ' on' : ''}`
  return <button type="button" className={clase} onClick={onSeleccionar} aria-pressed={seleccionada}
    aria-label={`${reserva.resourceName}, ${reserva.start} a ${reserva.end}, ${reserva.quantity} ${reserva.quantity === 1 ? 'unidad' : 'unidades'}, ${reserva.status}`}>
    <span className="cal-evento__hora">{reserva.start}{compacto ? '' : `–${reserva.end}`}</span>
    <span className="cal-evento__nombre">{reserva.resourceName}{reserva.quantity > 1 ? ` ×${reserva.quantity}` : ''}</span>
  </button>
}

function GrillaHoras({ dias, porDia, hoy, seleccionId, onSeleccionar, onAbrirDia }: {
  dias: string[], porDia: Map<string, Reservation[]>, hoy: string, seleccionId: string, onSeleccionar: (id: string) => void, onAbrirDia: (dia: string) => void,
}) {
  // La grilla va de 07 a 22 y se estira si alguna reserva visible queda afuera.
  const visibles = dias.flatMap((dia) => porDia.get(dia) ?? [])
  const desdeHora = Math.min(HORA_DESDE, ...visibles.map((reserva) => Math.floor(minutos(reserva.start) / 60)))
  const hastaHora = Math.min(24, Math.max(HORA_HASTA, ...visibles.map((reserva) => Math.ceil(minutos(reserva.end) / 60))))
  const horas = Array.from({ length: hastaHora - desdeHora }, (_, i) => desdeHora + i)
  const alto = (hastaHora - desdeHora) * PX_POR_HORA
  return <div className="cal-horas-wrap">
    <div className={`cal-horas${dias.length === 1 ? ' cal-horas--dia' : ''}`} style={{ gridTemplateColumns: `56px repeat(${dias.length}, minmax(0, 1fr))` }}>
      <div className="cal-horas__esquina"/>
      {dias.map((dia, i) => <button type="button" key={dia} className={`cal-horas__cabecera${dia === hoy ? ' hoy' : ''}`} onClick={() => onAbrirDia(dia)} disabled={dias.length === 1}>
        <small>{dias.length === 1 ? fmtSemana(dia) : DIAS_SEMANA[i]}</small><b>{aFecha(dia).getUTCDate()}</b>
      </button>)}
      <div className="cal-horas__regla" style={{ height: alto }}>
        {horas.map((hora) => <span key={hora} style={{ top: (hora - desdeHora) * PX_POR_HORA }}>{String(hora).padStart(2, '0')}:00</span>)}
      </div>
      {dias.map((dia) => <div key={dia} className={`cal-horas__columna${dia === hoy ? ' hoy' : ''}`} style={{ height: alto, backgroundSize: `100% ${PX_POR_HORA}px` }}>
        {ubicar(porDia.get(dia) ?? []).map(({ reserva, carril, carriles }) => {
          const inicio = minutos(reserva.start)
          const fin = Math.min(Math.max(minutos(reserva.end), inicio + 15), hastaHora * 60)
          return <div key={reserva.id} className="cal-horas__slot" style={{
            top: ((inicio - desdeHora * 60) / 60) * PX_POR_HORA,
            height: Math.max(((fin - inicio) / 60) * PX_POR_HORA - 2, 20),
            left: `calc(${(carril / carriles) * 100}% + 2px)`,
            width: `calc(${100 / carriles}% - 4px)`,
          }}>
            <Evento reserva={reserva} seleccionada={reserva.id === seleccionId} onSeleccionar={() => onSeleccionar(reserva.id)}/>
          </div>
        })}
      </div>)}
    </div>
  </div>
}

function GrillaMes({ referencia, dias, porDia, hoy, seleccionId, onSeleccionar, onAbrirDia }: {
  referencia: string, dias: string[], porDia: Map<string, Reservation[]>, hoy: string, seleccionId: string, onSeleccionar: (id: string) => void, onAbrirDia: (dia: string) => void,
}) {
  const mes = aFecha(referencia).getUTCMonth()
  return <div className="cal-mes" role="grid" aria-label={fmtMes(referencia)}>
    {DIAS_SEMANA.map((dia) => <div key={dia} className="cal-mes__dia-semana" role="columnheader">{dia}</div>)}
    {dias.map((dia) => {
      const reservas = [...(porDia.get(dia) ?? [])].sort((a, b) => a.start.localeCompare(b.start))
      const fuera = aFecha(dia).getUTCMonth() !== mes
      return <div key={dia} role="gridcell" className={`cal-mes__celda${fuera ? ' fuera' : ''}${dia === hoy ? ' hoy' : ''}`}>
        <button type="button" className="cal-mes__numero" onClick={() => onAbrirDia(dia)} aria-label={`Ver ${fmtDiaLargo(dia)}`}>{aFecha(dia).getUTCDate()}</button>
        {reservas.slice(0, CHIPS_POR_DIA).map((reserva) => <Evento key={reserva.id} reserva={reserva} compacto seleccionada={reserva.id === seleccionId} onSeleccionar={() => onSeleccionar(reserva.id)}/>)}
        {reservas.length > CHIPS_POR_DIA && <button type="button" className="cal-mes__mas" onClick={() => onAbrirDia(dia)}>+{reservas.length - CHIPS_POR_DIA} más</button>}
      </div>
    })}
  </div>
}

export function Calendario({ scope, admin, userId, version, puedeModificar, onEditar, onCancelar }: {
  scope?: 'mine'
  admin: boolean
  userId: string
  /** Cambia cuando App recarga las reservas (después de crear, editar o cancelar). */
  version: unknown
  puedeModificar: (reserva: Reservation) => boolean
  onEditar: (reserva: Reservation) => void
  onCancelar: (reserva: Reservation) => void
}) {
  const hoy = hoyLocal()
  const [vista, setVista] = useState<Vista>('semana')
  const [referencia, setReferencia] = useState(hoy)
  const [categoria, setCategoria] = useState<Categoria>('all')
  const [verCanceladas, setVerCanceladas] = useState(false)
  const [seleccionId, setSeleccionId] = useState('')
  const [intento, setIntento] = useState(0)
  const { desde, hasta } = rango(vista, referencia)
  const clave = [scope ?? '', desde, hasta, categoria, intento].join('|')
  const [resultado, setResultado] = useState<{ clave: string, reservas: Reservation[], error: string } | null>(null)

  useEffect(() => {
    let vigente = true
    getReservations(scope, { from: desde, to: hasta, category: categoria === 'all' ? undefined : categoria })
      .then((reservas) => { if (vigente) setResultado({ clave, reservas, error: '' }) })
      .catch((error: unknown) => { if (vigente) setResultado({ clave, reservas: [], error: messageOf(error) }) })
    return () => { vigente = false }
  }, [scope, desde, hasta, categoria, clave, version])

  const cargando = resultado?.clave !== clave
  const error = cargando ? '' : resultado.error
  const reservas = (cargando ? [] : resultado.reservas).filter((reserva) => verCanceladas || !cancelada(reserva))
  const porDia = new Map<string, Reservation[]>()
  reservas.forEach((reserva) => porDia.set(reserva.date, [...(porDia.get(reserva.date) ?? []), reserva]))
  const seleccionada = reservas.find((reserva) => reserva.id === seleccionId) ?? null
  const dias = vista === 'dia' ? [referencia] : vista === 'semana' ? diasDesde(desde, 7) : diasDesde(desde, 42)
  const abrirDia = (dia: string) => { setVista('dia'); setReferencia(dia) }
  const editable = seleccionada && (admin || !seleccionada.userId || seleccionada.userId === userId) && puedeModificar(seleccionada)

  return <div className="calendario">
    <div className="cal-barra">
      <div className="cal-barra__nav">
        <button type="button" className="icon-btn" onClick={() => setReferencia(mover(vista, referencia, -1))} aria-label="Período anterior"><Icon name="chevron-left"/></button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReferencia(hoy)}>Hoy</button>
        <button type="button" className="icon-btn" onClick={() => setReferencia(mover(vista, referencia, 1))} aria-label="Período siguiente"><Icon name="chevron-right"/></button>
        <h2 className="cal-barra__titulo" aria-live="polite">{titulo(vista, referencia)}</h2>
      </div>
      <div className="seg cal-barra__seg" role="group" aria-label="Vista del calendario">
        {([['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']] as const).map(([valor, texto]) =>
          <button key={valor} type="button" className={`seg__btn${vista === valor ? ' on' : ''}`} aria-pressed={vista === valor} onClick={() => setVista(valor)}>{texto}</button>)}
      </div>
    </div>
    <div className="cal-filtros">
      <div className="seg" role="group" aria-label="Filtrar por categoría">
        {([['all', 'Todas'], ['hardware_pc', 'Hardware de PC'], ['audiovisual', 'Audiovisuales']] as const).map(([valor, texto]) =>
          <button key={valor} type="button" className={`seg__btn${categoria === valor ? ' on' : ''}`} aria-pressed={categoria === valor} onClick={() => setCategoria(valor)}>
            {valor !== 'all' && <span className={`cal-punto cal-punto--${valor}`} aria-hidden="true"/>}{texto}
          </button>)}
      </div>
      <label className="cal-check"><input type="checkbox" checked={verCanceladas} onChange={(event) => setVerCanceladas(event.target.checked)}/>Mostrar canceladas</label>
    </div>

    {error && <div className="app__offline cal-error" role="alert">
      <div><strong>No se pudieron cargar las reservas del calendario</strong><span>{error}</span></div>
      <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
    </div>}

    <section className={`card cal-cuerpo${cargando ? ' cargando' : ''}`} aria-busy={cargando}>
      {vista === 'mes'
        ? <GrillaMes referencia={referencia} dias={dias} porDia={porDia} hoy={hoy} seleccionId={seleccionId} onSeleccionar={setSeleccionId} onAbrirDia={abrirDia}/>
        : <GrillaHoras dias={dias} porDia={porDia} hoy={hoy} seleccionId={seleccionId} onSeleccionar={setSeleccionId} onAbrirDia={abrirDia}/>}
      {!cargando && !error && !reservas.length && <p className="cal-vacio">{admin ? 'No hay reservas en este período.' : 'No tenés reservas en este período.'}</p>}
    </section>

    {seleccionada && <section className="card card-pad-lg cal-detalle" aria-label="Detalle de la reserva">
      <div className="cal-detalle__head">
        <div>
          <p className="card-kicker">{fmtDiaLargo(seleccionada.date)} · {seleccionada.start} a {seleccionada.end}</p>
          <h3 className="card-title">{seleccionada.resourceName}</h3>
        </div>
        <button type="button" className="icon-btn" onClick={() => setSeleccionId('')} aria-label="Cerrar detalle"><Icon name="close"/></button>
      </div>
      <dl className="cal-detalle__datos">
        <div><dt>Cantidad</dt><dd>{seleccionada.quantity}</dd></div>
        <div><dt>Estado</dt><dd>{seleccionada.status.charAt(0).toUpperCase() + seleccionada.status.slice(1)}</dd></div>
        {admin && <div><dt>Reservó</dt><dd>{seleccionada.userName || '—'}</dd></div>}
        <div><dt>Motivo</dt><dd>{seleccionada.reason || '—'}</dd></div>
      </dl>
      {editable && <div className="cal-detalle__acciones">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEditar(seleccionada)}>Editar</button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onCancelar(seleccionada)}>Cancelar reserva</button>
      </div>}
    </section>}
  </div>
}
