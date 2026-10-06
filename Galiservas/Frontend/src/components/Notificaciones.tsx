import { useEffect, useState } from 'react'
import { getNotifications, updateNotificationPreferences, type NotificationsData } from '../api'
import { messageOf } from '../utils'
import { Icon } from './Icon'
import './notificaciones.css'

const ESTADOS: Record<string, { label: string, cls: string }> = {
  pendiente: { label: 'Programada', cls: 'badge badge-warning' },
  enviada: { label: 'Enviada', cls: 'badge badge-success' },
  error: { label: 'No se pudo enviar', cls: 'badge badge-danger' },
  cancelada: { label: 'Cancelada', cls: 'badge badge-neutral' },
}

const fechaHora = (valor: string | null) => {
  if (!valor) return '—'
  const [fecha, hora = ''] = valor.split(' ')
  return `${fecha.split('-').reverse().join('/')} ${hora.slice(0, 5)}`.trim()
}

/** Preferencias de notificaciones por email e historial propio. */
export function Notificaciones({ onToast }: { onToast: (mensaje: string) => void }) {
  const [datos, setDatos] = useState<NotificationsData | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    getNotifications()
      .then((respuesta) => { if (vigente) { setDatos(respuesta); setError('') } })
      .catch((motivo: unknown) => { if (vigente) setError(messageOf(motivo)) })
    return () => { vigente = false }
  }, [intento])

  const cambiar = async (tipo: string, habilitada: boolean) => {
    setGuardando(tipo)
    try {
      const preferencias = await updateNotificationPreferences({ [tipo]: habilitada })
      setDatos((actual) => actual ? { ...actual, preferencias } : actual)
      // Apagar los recordatorios quita los programados: se recarga el historial.
      if (!habilitada) setIntento((n) => n + 1)
      onToast(habilitada ? 'Aviso activado. Rige para las reservas que crees o cambies desde ahora.' : 'Aviso desactivado.')
    } catch (motivo) {
      onToast(`Error: ${messageOf(motivo)}`)
    } finally {
      setGuardando('')
    }
  }

  if (error) return <div className="app__offline" role="alert">
    <div><strong>No se pudieron cargar tus notificaciones</strong><span>{error}</span></div>
    <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
  </div>
  if (!datos) return <div className="loading-line" role="status"><span className="spinner"/>Cargando notificaciones...</div>

  return <div className="notificaciones grid grid-2">
    <section className="card card-pad-lg">
      <p className="card-kicker">Por email</p>
      <h3 className="card-title">Qué avisos recibir</h3>
      <p className="notificaciones__ayuda">Te escribimos a la dirección de tu cuenta. Los cambios se guardan al instante.</p>
      <ul className="notificaciones__prefs">
        {datos.preferencias.map((pref) => <li key={pref.tipo}>
          <label className="notificaciones__switch">
            <input type="checkbox" checked={pref.habilitada} disabled={guardando === pref.tipo} onChange={(e) => void cambiar(pref.tipo, e.target.checked)}/>
            <span>{pref.etiqueta}</span>
          </label>
        </li>)}
      </ul>
    </section>
    <section className="card card-pad-lg">
      <p className="card-kicker">Historial</p>
      <h3 className="card-title">Últimos avisos</h3>
      {datos.notificaciones.length === 0
        ? <p className="cart-empty">Todavía no hay avisos. Te escribimos cuando crees, cambies o canceles una reserva.</p>
        : <ul className="notificaciones__lista">
          {datos.notificaciones.map((n) => <li key={n.id}>
            <span className="notificaciones__icono"><Icon name={n.tipo === 'reserva_recordatorio' ? 'clock' : 'bell'}/></span>
            <span className="notificaciones__texto"><b>{n.asunto}</b><small>{n.estado === 'pendiente' ? `Se envía el ${fechaHora(n.programadaPara)}` : n.estado === 'enviada' ? `Enviado el ${fechaHora(n.enviadaEn)}` : `Creado el ${fechaHora(n.creadaEn)}`}</small></span>
            <span className={ESTADOS[n.estado]?.cls ?? 'badge'}>{ESTADOS[n.estado]?.label ?? n.estado}</span>
          </li>)}
        </ul>}
    </section>
  </div>
}
