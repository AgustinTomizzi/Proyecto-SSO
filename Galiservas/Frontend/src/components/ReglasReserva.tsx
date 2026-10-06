import { useState, type FormEvent } from 'react'
import type { ConfigValue, InstitutionConfig } from '../types'
import { Icon } from './Icon'
import './reglas.css'

const TURNOS = [['manana', 'Mañana'], ['tarde', 'Tarde'], ['vespertino', 'Vespertino']] as const
const LIMITES = [
  ['reservas.duracion_maxima_min', 'Duración máxima', 'minutos por reserva'],
  ['reservas.anticipacion_minima_horas', 'Anticipación mínima', 'horas (0 = sin mínimo)'],
  ['reservas.anticipacion_maxima_dias', 'Anticipación máxima', 'días (0 = sin límite)'],
] as const

/** Edición de las reglas institucionales de reserva (permiso config.gestionar). */
export function ReglasReserva({ config, busy, onSave, onReset }: {
  config: InstitutionConfig
  busy: boolean
  onSave: (valores: InstitutionConfig['valores']) => Promise<string>
  onReset: (claves: string[]) => Promise<string>
}) {
  const [form, setForm] = useState<Record<string, ConfigValue>>(() => ({ ...config.valores }))
  const [error, setError] = useState('')
  const esquema = new Map(config.esquema.map((campo) => [campo.clave, campo]))
  const set = (clave: string, valor: ConfigValue) => { setForm((actual) => ({ ...actual, [clave]: valor })); setError('') }
  const cambios = Object.fromEntries(Object.entries(form).filter(([clave, valor]) => config.valores[clave] !== valor))

  const validar = () => {
    if (!TURNOS.some(([turno]) => form[`reservas.${turno}_habilitado`])) return 'Tiene que haber al menos un turno habilitado.'
    for (const [turno, nombre] of TURNOS) {
      if (form[`reservas.${turno}_habilitado`] && String(form[`reservas.${turno}_desde`]) >= String(form[`reservas.${turno}_hasta`])) return `El turno ${nombre} tiene que abrir antes de cerrar.`
    }
    for (const [clave, nombre] of LIMITES) {
      const campo = esquema.get(clave)
      const valor = Number(form[clave])
      if (!Number.isInteger(valor) || (campo?.min !== undefined && valor < campo.min) || (campo?.max !== undefined && valor > campo.max)) return `${nombre}: tiene que ser un entero entre ${campo?.min} y ${campo?.max}.`
    }
    return ''
  }
  const guardar = async (event: FormEvent) => {
    event.preventDefault()
    const problema = validar()
    if (problema) return setError(problema)
    if (!Object.keys(cambios).length) return setError('No hay cambios para guardar.')
    setError(await onSave(cambios))
  }
  // Solo las claves de reservas: la configuración también tiene las reglas de asistencia de Galisencia.
  const camposReserva = config.esquema.filter((campo) => campo.clave.startsWith('reservas.'))
  const restablecer = async () => {
    const error = await onReset(camposReserva.map((campo) => campo.clave))
    setError(error)
    if (!error) setForm((actual) => ({ ...actual, ...Object.fromEntries(camposReserva.map((campo) => [campo.clave, campo.defecto])) }))
  }

  return <form className="gform reglas" onSubmit={(event) => void guardar(event)} noValidate>
    {error && <div className="alert alert--error" role="alert"><Icon name="alert"/><span>{error}</span></div>}
    <fieldset className="reglas__grupo">
      <legend>Turnos en que se puede reservar</legend>
      {TURNOS.map(([turno, nombre]) => {
        const habilitado = Boolean(form[`reservas.${turno}_habilitado`])
        return <div className={`reglas__turno${habilitado ? '' : ' off'}`} key={turno}>
          <label className="reglas__check"><input type="checkbox" checked={habilitado} onChange={(e) => set(`reservas.${turno}_habilitado`, e.target.checked)} disabled={busy}/>{nombre}</label>
          <label>Abre<input type="time" value={String(form[`reservas.${turno}_desde`])} onChange={(e) => set(`reservas.${turno}_desde`, e.target.value)} disabled={busy || !habilitado}/></label>
          <label>Cierra<input type="time" value={String(form[`reservas.${turno}_hasta`])} onChange={(e) => set(`reservas.${turno}_hasta`, e.target.value)} disabled={busy || !habilitado}/></label>
        </div>
      })}
      <p className="hint">Horario efectivo hoy: {config.franjasReserva.map((f) => `${f.desde} a ${f.hasta}`).join(' y ')}. Los turnos que se tocan se unen.</p>
    </fieldset>
    <fieldset className="reglas__grupo">
      <legend>Límites</legend>
      <div className="field-grid field-grid--3">
        {LIMITES.map(([clave, nombre, ayuda]) => {
          const campo = esquema.get(clave)
          return <label key={clave}>{nombre}<input type="number" min={campo?.min} max={campo?.max} value={String(form[clave])} onChange={(e) => set(clave, e.target.value === '' ? '' : Number(e.target.value))} disabled={busy}/><small>{ayuda}</small></label>
        })}
      </div>
      <p className="hint">La anticipación no se aplica a quien administra reservas. Las reglas se validan al crear una reserva y al cambiarle la fecha o el horario.</p>
    </fieldset>
    <div className="form-actions">
      <button type="button" className="btn btn-ghost" onClick={() => void restablecer()} disabled={busy}>Restablecer valores por defecto</button>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando...' : 'Guardar reglas'}</button>
    </div>
  </form>
}
