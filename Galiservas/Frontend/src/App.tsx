import { useEffect, useEffectEvent, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError, cancelReservation, createIncident, createReservation, createResource, getIncidents, getReservationReport, getReservations, getResources, login, recordDelivery, resolveIncident,
  logout, restoreSession, setReservationStatus, updateReservation, updateResource,
} from './api'
import type { Page, Reservation, ReservationInput, ReservationReport, Incident, Resource, ResourceInput, Session } from './types'
import './App.css'

const today = new Date().toISOString().slice(0, 10)
const emptyForm: ReservationInput = { resourceId: '', date: today, start: '08:00', end: '09:00', quantity: 1, reason: '' }

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
const GALISENCIA_URL = import.meta.env.VITE_GALISENCIA_URL || 'http://localhost:3000'
const canAccessGaliservas = (session: Session) => session.permissions.some((permission) => normalize(permission) === 'galiservas.acceder')
  && session.systems.some((system) => normalize(system) === 'galiservas')
const canAdmin = (session: Session) => {
  const role = normalize(session.user.role)
  const permissions = session.permissions.map(normalize)
  return ['admin', 'administrador'].includes(role)
    || permissions.some((permission) => /(administr|gestionar.*reserva|reservas.*gestionar|reserva.*estado)/.test(permission))
}
const canChange = (reservation: Reservation) => !['cancelada', 'rechazada', 'finalizada'].includes(normalize(reservation.status))

type IconName = 'grid' | 'calendar' | 'user' | 'plus' | 'logout' | 'monitor' | 'box' | 'clock' | 'menu' | 'close' | 'laptop' | 'camera' | 'mic' | 'speaker' | 'cable' | 'chevron' | 'layers'

function Icon({ name }: { name: IconName }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 4h5v16h-5"/></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    box: <><path d="M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10"/></>,
    laptop: <><rect x="4" y="4" width="16" height="11" rx="1"/><path d="M2 19h20M6 15l-2 4M18 15l2 4"/></>,
    camera: <><path d="M7 7l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9H2V9a2 2 0 0 1 2-2h3z"/><circle cx="12" cy="12.5" r="3.5"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
    speaker: <><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="7" r="1.5"/></>,
    cable: <><path d="M7 4v5a5 5 0 0 0 10 0V6M5 2h4v3H5zM15 3h4v3h-4zM12 14v7"/><circle cx="12" cy="21" r="1"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, menu: <path d="M4 7h16M4 12h16M4 17h16"/>, close: <path d="M6 6l12 12M18 6L6 18"/>,
    chevron: <path d="M6 9l6 6 6-6"/>,
    layers: <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function Login({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) return setError('Ingresá tu correo institucional y contraseña.')
    setBusy(true); setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setBusy(false); return setError('Ingresá un correo institucional válido.') }
    try {
      const current = await login(email.trim(), password)
      if (!canAccessGaliservas(current)) throw new Error('Tu rol no tiene acceso a Galiservas. Solo pueden ingresar Preceptores, Docentes y Administradores.')
      onSuccess(current)
    }
    catch (reason) { setError(messageOf(reason)) }
    finally { setBusy(false) }
  }

  return <main className="login-page">
    <section className="login-identity" aria-label="Identidad institucional">
      <img className="system-logo login-logo" src="/logo-galiservas.png" alt="Logotipo de Galiservas" />
      <div className="identity-copy">
        <p className="eyebrow light">E.E.S.T. N°5 · General San Martín</p>
        <h1>Recursos técnicos,<br/><em>bien coordinados.</em></h1>
        <p>Reservas de aulas y equipos para una escuela en movimiento.</p>
      </div>
      <div className="circuit-lines" aria-hidden="true"><i/><i/><i/></div>
      <p className="login-foot">GALILEO GALILEI <span>·</span> ESCUELA TÉCNICA</p>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="mobile-brand"><img className="system-logo mobile-logo" src="/logo-galiservas.png" alt=""/><b>GALISERVAS</b></div>
        <p className="eyebrow">ACCESO INSTITUCIONAL</p>
        <h2>Bienvenido</h2>
        <p className="muted">Usá las credenciales de tu cuenta Galileo.</p>
        {error && <div className="alert error" role="alert">{error}</div>}
        <label>Correo institucional<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@galileo.edu.ar" autoComplete="email" disabled={busy}/></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" disabled={busy}/></label>
        <button className="button primary wide" disabled={busy}>{busy ? <><span className="spinner"/>Ingresando...</> : 'Ingresar al sistema'}</button>
        <p className="auth-note"><span className="status-dot"/> Acceso protegido por Galileo Auth</p>
      </form>
    </section>
  </main>
}

function ReservationForm({ resources, initial, preferredResourceId, busy, onSubmit, onClose }: {
  resources: Resource[], initial?: Reservation, preferredResourceId?: string, busy: boolean, onSubmit: (input: ReservationInput) => void, onClose?: () => void
}) {
  const [form, setForm] = useState<ReservationInput>(() => {
    if (initial) return { resourceId: initial.resourceId, date: initial.date, start: initial.start, end: initial.end, quantity: initial.quantity, reason: initial.reason }
    const initialResourceId = preferredResourceId || resources[0]?.id || ''
    const initialResource = resources.find((resource) => resource.id === initialResourceId)
    return { ...emptyForm, resourceId: initialResourceId, quantity: initialResource?.type === 'desktop_pc' ? initialResource.capacity : emptyForm.quantity }
  })
  const [error, setError] = useState('')
  const selected = resources.find((resource) => resource.id === form.resourceId)
  const isRoom = selected?.type === 'desktop_pc'
  const [slotAvailable, setSlotAvailable] = useState<number | null>(selected?.available ?? null)
  const checkingAvailability = slotAvailable === null && Boolean(form.resourceId && form.date && form.start && form.end && form.start < form.end)
  const change = (key: keyof ReservationInput, value: string | number) => {
    if (['resourceId', 'date', 'start', 'end'].includes(key)) {
      setSlotAvailable(null)
    }
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'resourceId') {
        const nextResource = resources.find((resource) => resource.id === value)
        if (nextResource?.type === 'desktop_pc') next.quantity = nextResource.capacity
      }
      return next
    })
  }
  useEffect(() => {
    if (!form.resourceId || !form.date || !form.start || !form.end || form.start >= form.end) {
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      void getResources({ date: form.date, start: form.start, end: form.end }).then((items) => {
        if (!active) return
        const resource = items.find((item) => item.id === form.resourceId)
        const ownQuantity = initial && initial.resourceId === form.resourceId && initial.date === form.date && initial.start === form.start && initial.end === form.end ? initial.quantity : 0
        setSlotAvailable(resource ? Math.min(resource.capacity, resource.available + ownQuantity) : 0)
      }).catch((reason) => {
        if (active) setError(messageOf(reason))
      })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [form.resourceId, form.date, form.start, form.end, initial])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.resourceId) return setError('Seleccioná un recurso disponible.')
    if (!selected?.active) return setError('El recurso seleccionado no está disponible.')
    if (!form.date || !form.start || !form.end) return setError('Completá la fecha y el horario de la reserva.')
    if (form.date < today) return setError('La fecha no puede ser anterior a hoy.')
    if (form.start >= form.end) return setError('La hora de fin debe ser posterior al inicio.')
    const maximum = slotAvailable ?? selected.capacity
    const quantity = isRoom ? selected.capacity : form.quantity
    if (isRoom) {
      if (maximum < selected.capacity) return setError('Esta aula ya tiene equipos reservados en ese horario. Elegí otro horario o aula.')
    } else if (quantity < 1 || quantity > maximum) {
      return setError(`La cantidad debe estar entre 1 y ${maximum} para esa franja.`)
    }
    if (form.reason.trim().length < 5) return setError('Explicá el motivo de la reserva (mínimo 5 caracteres).')
    setError(''); onSubmit({ ...form, quantity, reason: form.reason.trim() })
  }
  return <form className="reservation-form" onSubmit={submit} noValidate>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="field-grid">
      <label className="span-2">Recurso<select value={form.resourceId} onChange={(e) => change('resourceId', e.target.value)} disabled={busy}>
        <option value="">Seleccionar recurso</option>{resources.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.capacity} equipos</option>)}
      </select></label>
      <label className={isRoom ? 'span-2' : undefined}>Fecha<input type="date" min={today} value={form.date} onChange={(e) => change('date', e.target.value)} disabled={busy}/>{isRoom && <small>{checkingAvailability ? 'Consultando disponibilidad...' : (slotAvailable ?? selected?.capacity ?? 0) >= (selected?.capacity ?? 0) ? `Aula completa disponible (${selected?.capacity} equipos)` : `Solo disponible parcialmente para ese horario`}</small>}</label>
      {!isRoom && <label>Cantidad<input type="number" min="1" max={slotAvailable ?? selected?.capacity ?? 1} value={form.quantity} onChange={(e) => change('quantity', Number(e.target.value))} disabled={busy || checkingAvailability}/><small>{checkingAvailability ? 'Consultando disponibilidad...' : `Disponibles en esa franja: ${slotAvailable ?? selected?.capacity ?? 0}`}</small></label>}
      <label>Hora de inicio<input type="time" value={form.start} onChange={(e) => change('start', e.target.value)} disabled={busy}/></label>
      <label>Hora de fin<input type="time" value={form.end} onChange={(e) => change('end', e.target.value)} disabled={busy}/></label>
      <label className="span-2">Motivo<textarea rows={4} maxLength={300} value={form.reason} onChange={(e) => change('reason', e.target.value)} placeholder="Ej.: Práctica de programación de 4° año" disabled={busy}/><small>{form.reason.length}/300</small></label>
    </div>
    <div className="form-actions">{onClose && <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>}<button className="button primary" disabled={busy}>{busy ? 'Guardando...' : initial ? 'Guardar cambios' : 'Confirmar reserva'}</button></div>
  </form>
}

type CartItem = { resourceId: string, resourceName: string, quantity: number, capacity: number, available: number, isRoom: boolean }

function NewReservationForm({ resources, preferredResourceId, busy, onSubmit }: {
  resources: Resource[], preferredResourceId?: string, busy: boolean,
  onSubmit: (shared: { date: string, start: string, end: string, reason: string }, items: { resourceId: string, quantity: number }[]) => Promise<{ failures: { resourceId: string, message: string }[] }>,
}) {
  const activeResources = resources.filter((item) => item.active)
  const [shared, setShared] = useState({ date: today, start: '08:00', end: '09:00', reason: '' })
  const [cart, setCart] = useState<CartItem[]>([])
  const [pendingResourceId, setPendingResourceId] = useState(preferredResourceId || activeResources[0]?.id || '')
  const [pendingQuantity, setPendingQuantity] = useState(1)
  const [slotAvailable, setSlotAvailable] = useState<number | null>(null)
  const [addError, setAddError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const availableOptions = activeResources.filter((item) => !cart.some((entry) => entry.resourceId === item.id))
  const pendingResource = activeResources.find((item) => item.id === pendingResourceId)
  const isRoom = pendingResource?.type === 'desktop_pc'
  const checkingAvailability = slotAvailable === null && Boolean(pendingResourceId && shared.date && shared.start && shared.end && shared.start < shared.end)

  useEffect(() => {
    if (!pendingResourceId || !shared.date || !shared.start || !shared.end || shared.start >= shared.end) return
    let active = true
    const timer = window.setTimeout(() => {
      void getResources({ date: shared.date, start: shared.start, end: shared.end }).then((items) => {
        if (!active) return
        const resource = items.find((item) => item.id === pendingResourceId)
        setSlotAvailable(resource ? resource.available : 0)
      }).catch((reason) => { if (active) setAddError(messageOf(reason)) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [pendingResourceId, shared.date, shared.start, shared.end])

  const changeShared = (key: keyof typeof shared, value: string) => {
    const hadItems = cart.length > 0
    setShared((current) => ({ ...current, [key]: value }))
    if (key === 'reason') return
    setSlotAvailable(null)
    setAddError('')
    setCart([])
    setFormError(hadItems ? 'Cambiaste la fecha u horario: volvé a agregar los recursos para este nuevo horario.' : '')
  }

  const changePendingResource = (id: string) => {
    setPendingResourceId(id)
    setSlotAvailable(null)
    setAddError('')
    const resource = activeResources.find((item) => item.id === id)
    setPendingQuantity(resource?.type === 'desktop_pc' ? resource.capacity : 1)
  }

  const addToCart = () => {
    if (!pendingResource) return setAddError('Seleccioná un recurso.')
    const maximum = slotAvailable ?? pendingResource.capacity
    const quantity = isRoom ? pendingResource.capacity : pendingQuantity
    if (isRoom) {
      if (maximum < pendingResource.capacity) return setAddError('Esta aula ya tiene equipos reservados en ese horario. Elegí otro horario.')
    } else if (quantity < 1 || quantity > maximum) {
      return setAddError(`La cantidad debe estar entre 1 y ${maximum} para esa franja.`)
    }
    const nextCart = [...cart, { resourceId: pendingResource.id, resourceName: pendingResource.name, quantity, capacity: pendingResource.capacity, available: maximum, isRoom }]
    setCart(nextCart)
    setAddError('')
    const nextOptions = activeResources.filter((item) => !nextCart.some((entry) => entry.resourceId === item.id))
    changePendingResource(nextOptions[0]?.id || '')
  }

  const removeFromCart = (resourceId: string) => setCart((current) => current.filter((item) => item.resourceId !== resourceId))
  const updateCartQuantity = (resourceId: string, quantity: number) => setCart((current) => current.map((item) => item.resourceId === resourceId ? { ...item, quantity: Math.min(Math.max(quantity, 1), item.available) } : item))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!shared.date || !shared.start || !shared.end) return setFormError('Completá la fecha y el horario de la reserva.')
    if (shared.date < today) return setFormError('La fecha no puede ser anterior a hoy.')
    if (shared.start >= shared.end) return setFormError('La hora de fin debe ser posterior al inicio.')
    if (shared.reason.trim().length < 5) return setFormError('Explicá el motivo de la reserva (mínimo 5 caracteres).')
    if (cart.length === 0) return setFormError('Agregá al menos un recurso a la reserva.')
    setSubmitting(true)
    const result = await onSubmit({ ...shared, reason: shared.reason.trim() }, cart.map((item) => ({ resourceId: item.resourceId, quantity: item.quantity })))
    setSubmitting(false)
    if (result.failures.length > 0) {
      setFormError(result.failures.map((failure) => `${cart.find((item) => item.resourceId === failure.resourceId)?.resourceName || failure.resourceId}: ${failure.message}`).join(' · '))
      setCart((current) => current.filter((item) => result.failures.some((failure) => failure.resourceId === item.resourceId)))
    }
  }

  const disabled = submitting || busy

  return <form className="reservation-form cart-form" onSubmit={(e) => void submit(e)} noValidate>
    {formError && <div className="alert error" role="alert">{formError}</div>}
    <div className="field-grid">
      <label>Fecha<input type="date" min={today} value={shared.date} onChange={(e) => changeShared('date', e.target.value)} disabled={disabled}/></label>
      <label>Hora de inicio<input type="time" value={shared.start} onChange={(e) => changeShared('start', e.target.value)} disabled={disabled}/></label>
      <label>Hora de fin<input type="time" value={shared.end} onChange={(e) => changeShared('end', e.target.value)} disabled={disabled}/></label>
      <label className="span-2">Motivo<textarea rows={3} maxLength={300} value={shared.reason} onChange={(e) => changeShared('reason', e.target.value)} placeholder="Ej.: Práctica de programación de 4° año" disabled={disabled}/><small>{shared.reason.length}/300</small></label>
    </div>

    <div className="cart-add-card">
      <p className="eyebrow">SUMÁ RECURSOS A ESTA RESERVA</p>
      <div className="cart-add-row">
        <label>Recurso<select value={pendingResourceId} onChange={(e) => changePendingResource(e.target.value)} disabled={disabled || availableOptions.length === 0}>
          {availableOptions.length === 0 && <option value="">No quedan más recursos para agregar</option>}
          {availableOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.capacity} equipos</option>)}
        </select></label>
        {pendingResourceId && !isRoom && <label className="cart-qty">Cantidad<input type="number" min="1" max={slotAvailable ?? pendingResource?.capacity ?? 1} value={pendingQuantity} onChange={(e) => setPendingQuantity(Number(e.target.value))} disabled={disabled || checkingAvailability}/></label>}
        <button type="button" className="button ghost" onClick={addToCart} disabled={disabled || !pendingResourceId || checkingAvailability}><Icon name="plus"/> Agregar</button>
      </div>
      {pendingResourceId && <p className="hint">{checkingAvailability ? 'Consultando disponibilidad...' : isRoom ? ((slotAvailable ?? pendingResource?.capacity ?? 0) >= (pendingResource?.capacity ?? 0) ? `Aula completa disponible (${pendingResource?.capacity} equipos)` : 'Esta aula ya tiene equipos reservados en ese horario.') : `Disponibles en esa franja: ${slotAvailable ?? pendingResource?.capacity ?? 0}`}</p>}
      {addError && <div className="alert error compact" role="alert">{addError}</div>}
    </div>

    <div className="cart-list">
      {cart.length === 0 ? <p className="cart-empty">Todavía no agregaste ningún recurso a esta reserva.</p> : cart.map((item) => <div className="cart-row" key={item.resourceId}>
        <span className="cart-row-name">{item.resourceName}</span>
        {item.isRoom ? <span className="cart-row-qty">Aula completa · {item.capacity} equipos</span> : <input type="number" min="1" max={item.available} value={item.quantity} onChange={(e) => updateCartQuantity(item.resourceId, Number(e.target.value))} disabled={disabled}/>}
        <button type="button" className="icon-button" onClick={() => removeFromCart(item.resourceId)} aria-label={`Quitar ${item.resourceName}`} disabled={disabled}><Icon name="close"/></button>
      </div>)}
    </div>

    <div className="form-actions">
      <button className="button primary" disabled={disabled}>{disabled ? 'Guardando...' : `Confirmar reserva${cart.length ? ` (${cart.length})` : ''}`}</button>
    </div>
  </form>
}

function ResourceCard({ resource, onReserve }: { resource: Resource, onReserve: () => void }) {
  const percentage = resource.capacity ? Math.min(100, Math.max(0, resource.available / resource.capacity * 100)) : 0
  const presentation: Record<Resource['type'], { label: string, icon: IconName }> = {
    desktop_pc: { label: 'LABORATORIO', icon: 'monitor' },
    notebook: { label: 'NOTEBOOKS', icon: 'laptop' },
    teclado: { label: 'TECLADOS', icon: 'box' },
    mouse: { label: 'MOUSE', icon: 'box' },
    cpu: { label: 'CPUs', icon: 'monitor' },
    proyector: { label: 'PROYECTORES', icon: 'speaker' },
    camara: { label: 'CÁMARAS', icon: 'camera' },
    microfono: { label: 'MICRÓFONOS', icon: 'mic' },
    parlante: { label: 'PARLANTES', icon: 'speaker' },
    cable: { label: 'CABLES', icon: 'cable' },
    otro: { label: 'EQUIPAMIENTO', icon: 'box' },
  }
  const display = presentation[resource.type]
  return <article className="resource-card">
    <div className={`resource-icon ${resource.type}`}><Icon name={display.icon}/></div>
    <div className="resource-heading"><div><p className="resource-type">{display.label}</p><h3>{resource.name}</h3></div><span className={`availability ${resource.available ? '' : 'full'}`}>{resource.available ? 'Disponible' : 'Sin disponibilidad'}</span></div>
    <div className="meter"><span style={{ width: `${percentage}%` }}/></div>
    <div className="capacity"><b>{resource.available}</b><span> disponibles de {resource.capacity}</span></div>
    <button className="text-button" onClick={onReserve} disabled={!resource.active || resource.available < 1}>Reservar recurso <span>→</span></button>
  </article>
}

type ReservationGroup = { key: string, start: string, end: string, reason: string, userName: string, items: Reservation[] }

function groupReservations(list: Reservation[]): ReservationGroup[] {
  const map = new Map<string, ReservationGroup>()
  list.forEach((item) => {
    const key = [item.start, item.end, item.userId || item.userName, item.reason].join('|')
    const existing = map.get(key)
    if (existing) existing.items.push(item)
    else map.set(key, { key, start: item.start, end: item.end, reason: item.reason, userName: item.userName, items: [item] })
  })
  return [...map.values()]
}

function ReservationsList({ reservations, admin, userId, busyId, onEdit, onCancel, onStatus, onDelivery }: {
  reservations: Reservation[], admin: boolean, userId: string, busyId: string, onEdit: (r: Reservation) => void,
  onCancel: (r: Reservation) => void, onStatus: (r: Reservation, status: string) => void, onDelivery: (r: Reservation) => void,
}) {
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({})
  const groups = reservations.reduce<Record<string, Reservation[]>>((all, item) => ((all[item.date || 'Sin fecha'] ??= []).push(item), all), {})
  if (!reservations.length) return <div className="empty"><div className="empty-icon"><Icon name="calendar"/></div><h3>No hay reservas para mostrar</h3><p>Las reservas nuevas aparecerán organizadas por día.</p></div>
  const sortedDates = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  return <div className="day-groups">{sortedDates.map(([date, items], index) => {
    const isOpen = openDates[date] ?? index === 0
    const groupedItems = groupReservations(items).sort((a, b) => a.start.localeCompare(b.start))
    return <section className={`day-group ${isOpen ? 'open' : ''}`} key={date}>
      <button type="button" className="day-group-header" onClick={() => setOpenDates((current) => ({ ...current, [date]: !isOpen }))} aria-expanded={isOpen}>
        <time dateTime={date}>{formatDate(date)}</time>
        <span>{items.length} {items.length === 1 ? 'reserva' : 'reservas'}</span>
        <Icon name="chevron"/>
      </button>
      {isOpen && <div className="reservation-list">{groupedItems.map((group) => {
        const own = group.items.every((item) => !item.userId || item.userId === userId)
        const single = group.items.length === 1 ? group.items[0] : null
        return <article className="reservation-row" key={group.key}>
          <div className="time-block"><b>{group.start}</b><span>{group.end}</span></div>
          <div className="reservation-info">
            <div>
              <h3>{single ? (single.resourceName || `Recurso #${single.resourceId}`) : `${group.items.length} recursos reservados`}</h3>
              {single && <span className={`badge status-${normalize(single.status)}`}>{single.status}</span>}
            </div>
            <p>{group.reason || 'Sin motivo especificado'}</p>
            {!single && <div className="grouped-items">{group.items.map((item) => <div className="grouped-item" key={item.id}>
              <span className="grouped-item-name">{item.resourceName || `Recurso #${item.resourceId}`}</span>
              <span className="grouped-item-qty">{item.quantity} {item.quantity === 1 ? 'equipo' : 'equipos'}{item.deliveredQuantity !== null ? ` · Entregados: ${item.deliveredQuantity}` : ''}</span>
              <span className={`badge status-${normalize(item.status)}`}>{item.status}</span>
              {(admin || (!item.userId || item.userId === userId)) && canChange(item) && <div className="row-actions mini">
                {item.deliveredQuantity === null && (!item.userId || item.userId === userId) && <button className="button mini ghost" onClick={() => onEdit(item)} disabled={busyId === item.id}>Editar</button>}
                {admin && item.deliveredQuantity === null && <button className="button mini ghost" onClick={() => onDelivery(item)} disabled={busyId === item.id}>Registrar retiro</button>}
                {admin && item.deliveredQuantity !== null && normalize(item.status) !== 'finalizada' && <button className="button mini ghost" onClick={() => onStatus(item, 'finalizada')} disabled={busyId === item.id}>Finalizar</button>}
                {item.deliveredQuantity === null && <button className="button mini danger" onClick={() => onCancel(item)} disabled={busyId === item.id}>Cancelar</button>}
              </div>}
            </div>)}</div>}
            <small>{single ? `${single.quantity} ${single.quantity === 1 ? 'equipo' : 'equipos'}` : ''}{single && single.deliveredQuantity !== null ? ` · Entregados: ${single.deliveredQuantity}/${single.quantity}` : ''}{admin && group.userName ? `${single ? ' · ' : ''}${group.userName}` : ''}</small>
          </div>
          {single && (admin || own) && canChange(single) && <div className="row-actions">
            {own && single.deliveredQuantity === null && <button className="button mini ghost" onClick={() => onEdit(single)} disabled={busyId === single.id}>Editar</button>}
            {admin && single.deliveredQuantity === null && <button className="button mini ghost" onClick={() => onDelivery(single)} disabled={busyId === single.id}>Registrar retiro</button>}
            {admin && single.deliveredQuantity !== null && normalize(single.status) !== 'finalizada' && <button className="button mini ghost" onClick={() => onStatus(single, 'finalizada')} disabled={busyId === single.id}>Finalizar</button>}
            {(own || admin) && single.deliveredQuantity === null && <button className="button mini danger" onClick={() => onCancel(single)} disabled={busyId === single.id}>Cancelar</button>}
          </div>}
        </article>
      })}</div>}
    </section>
  })}</div>
}

const PISOS = ['Planta Baja', 'Piso 1', 'Piso 2', 'Piso 3']
const emptyResourceForm = { name: '', category: 'hardware_pc' as Resource['category'], capacity: 1, location: PISOS[0], description: '' }

function guessResourceType(name: string): Resource['type'] {
  const value = normalize(name)
  if (/(notebook|portatil|laptop)/.test(value)) return 'notebook'
  if (/camara/.test(value)) return 'camara'
  if (/microfono/.test(value)) return 'microfono'
  if (/(parlante|altavoz)/.test(value)) return 'parlante'
  if (/cable/.test(value)) return 'cable'
  if (/teclado/.test(value)) return 'teclado'
  if (/mouse/.test(value)) return 'mouse'
  if (/cpu/.test(value)) return 'cpu'
  if (/proyector/.test(value)) return 'proyector'
  return 'otro'
}

function ResourcesAdmin({ resources, reservations, busyId, onCreate, onAddQuantity }: {
  resources: Resource[], reservations: Reservation[], busyId: string,
  onCreate: (input: ResourceInput) => Promise<boolean>,
  onAddQuantity: (resource: Resource, extra: number, busyKey?: string) => Promise<boolean>,
}) {
  const busy = busyId === 'resource-form'
  const [kind, setKind] = useState<'aula' | 'objeto'>('aula')
  const [form, setForm] = useState(emptyResourceForm)
  const [error, setError] = useState('')
  const [matchedResource, setMatchedResource] = useState<Resource | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const change = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }))
  const changeKind = (next: 'aula' | 'objeto') => {
    setKind(next)
    setForm((current) => ({ ...current, name: '', category: next === 'aula' ? 'hardware_pc' : current.category, location: next === 'aula' ? PISOS[0] : 'Pañol' }))
  }
  const changeName = (value: string) => { change('name', kind === 'aula' ? value.replace(/\D/g, '') : value); setMatchedResource(null); setShowSuggestions(true) }
  const pickSuggestion = (resource: Resource) => {
    setMatchedResource(resource)
    setShowSuggestions(false)
    setForm((current) => ({ ...current, name: resource.name, capacity: 1 }))
  }
  const clearMatch = () => { setMatchedResource(null); setForm((current) => ({ ...current, name: '' })) }

  const suggestions = form.name.trim().length > 0 && !matchedResource
    ? resources.filter((item) => normalize(item.name).includes(normalize(form.name.trim()))).slice(0, 6)
    : []

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (matchedResource) {
      if (form.capacity < 1 || form.capacity > 10000) return setError('La cantidad a agregar debe ser un número entre 1 y 10000.')
      setError('')
      const success = await onAddQuantity(matchedResource, form.capacity, 'resource-form')
      if (success) { setForm(emptyResourceForm); setMatchedResource(null); setKind('aula') }
      return
    }
    const name = form.name.trim()
    if (!name) return setError(kind === 'aula' ? 'Ingresá el número del aula (por ej. "205").' : 'Ingresá el nombre del recurso.')
    if (form.capacity < 1 || form.capacity > 10000) return setError(kind === 'aula' ? 'La cantidad de computadoras debe ser un número entre 1 y 10000.' : 'La cantidad debe ser un número entre 1 y 10000.')
    setError('')
    const success = await onCreate({
      name: kind === 'aula' ? `Aula ${name}` : name, type: kind === 'aula' ? 'desktop_pc' : guessResourceType(name), category: form.category,
      location: kind === 'aula' ? form.location : 'Pañol', description: form.description.trim(), capacity: form.capacity, active: true, available: true,
    })
    if (success) setForm({ ...emptyResourceForm, location: kind === 'aula' ? PISOS[0] : 'Pañol' })
  }

  return <div className="resources-admin">
    <section className="form-card">
      <div className="form-card-head"><div className="step-number">01</div><div><h2>Nuevo recurso</h2><p>Sumá una nueva aula u objeto al catálogo, o cantidad a uno que ya existe.</p></div></div>
      <form className="reservation-form" onSubmit={(e) => void submit(e)} noValidate>
        {error && <div className="alert error" role="alert">{error}</div>}
        {!matchedResource && <div className="kind-toggle" role="group" aria-label="Tipo de recurso">
          <button type="button" className={kind === 'aula' ? 'active' : ''} onClick={() => changeKind('aula')} disabled={busy}>Aula</button>
          <button type="button" className={kind === 'objeto' ? 'active' : ''} onClick={() => changeKind('objeto')} disabled={busy}>Objeto del Pañol</button>
        </div>}
        <div className="field-grid">
          <label className="span-2 name-field">{kind === 'aula' ? 'Número de aula' : 'Nombre del recurso'}
            <input type="text" inputMode={kind === 'aula' ? 'numeric' : 'text'} value={form.name} onChange={(e) => changeName(e.target.value)} onFocus={() => setShowSuggestions(true)} onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)} placeholder={kind === 'aula' ? 'Ej.: 205' : 'Ej.: Proyector portátil'} disabled={busy || Boolean(matchedResource)}/>
            {showSuggestions && suggestions.length > 0 && <div className="name-suggestions">
              {suggestions.map((item) => <button type="button" key={item.id} onMouseDown={() => pickSuggestion(item)}>
                <span>{item.name}</span><small>Ya hay {item.capacity} {item.capacity === 1 ? 'unidad' : 'unidades'} · {item.location}</small>
              </button>)}
            </div>}
          </label>
          {matchedResource && <div className="span-2 existing-match">
            <div><b>{matchedResource.name}</b> ya existe en el catálogo — actualmente hay <b>{matchedResource.capacity}</b> {matchedResource.capacity === 1 ? 'unidad' : 'unidades'} ({matchedResource.location}). Le vamos a sumar cantidad en vez de crear un recurso nuevo.</div>
            <button type="button" className="button mini ghost" onClick={clearMatch} disabled={busy}>Usar otro nombre</button>
          </div>}
          {!matchedResource && kind === 'aula' && <label className="span-2">Piso<select value={form.location} onChange={(e) => change('location', e.target.value)} disabled={busy}>
            {PISOS.map((piso) => <option key={piso} value={piso}>{piso}</option>)}
          </select></label>}
          {!matchedResource && kind === 'objeto' && <label>Categoría<select value={form.category} onChange={(e) => change('category', e.target.value as Resource['category'])} disabled={busy}>
            <option value="hardware_pc">Hardware de PC</option>
            <option value="audiovisual">Audiovisual</option>
          </select></label>}
          <label>{matchedResource ? 'Cantidad a agregar' : kind === 'aula' ? 'Cantidad de computadoras' : 'Cantidad'}<input type="number" min="1" max="10000" value={form.capacity} onChange={(e) => change('capacity', Number(e.target.value))} disabled={busy}/></label>
          {!matchedResource && <label className="span-2">Descripción (opcional)<textarea rows={2} maxLength={500} value={form.description} onChange={(e) => change('description', e.target.value)} disabled={busy}/></label>}
        </div>
        <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? 'Guardando...' : matchedResource ? `Sumar ${form.capacity || 0} ${form.capacity === 1 ? 'unidad' : 'unidades'}` : 'Agregar al catálogo'}</button></div>
      </form>
    </section>

    <ResourcesInventoryOverview resources={resources} reservations={reservations}/>
  </div>
}

function ResourcesInventoryOverview({ resources, reservations }: { resources: Resource[], reservations: Reservation[] }) {
  const now = new Date()
  const nowTime = now.toTimeString().slice(0, 5)
  const nowLabel = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(now)
  const inUseFor = (resourceId: string) => reservations
    .filter((item) => item.resourceId === resourceId && item.date === today && item.start <= nowTime && item.end > nowTime && !['cancelada', 'rechazada', 'finalizada'].includes(normalize(item.status)))
    .reduce((sum, item) => sum + item.quantity, 0)

  return <>
    <section className="resources-table-card">
      <div className="section-heading"><div><p className="eyebrow">CATÁLOGO ACTUAL</p><h2>Aulas y objetos en el inventario</h2></div></div>
      <div className="resources-table">
        <div className="resources-table-row head"><span>Recurso</span><span>Ubicación</span><span>Categoría</span><span>Cantidad total</span></div>
        {resources.map((resource) => <div className="resources-table-row" key={resource.id}>
          <span>{resource.name}</span>
          <span>{resource.location}</span>
          <span>{resource.category === 'audiovisual' ? 'Audiovisual' : 'Hardware de PC'}</span>
          <span>{resource.capacity}</span>
        </div>)}
        {resources.length === 0 && <p className="cart-empty">Todavía no hay recursos cargados.</p>}
      </div>
    </section>

    <section className="resources-table-card">
      <div className="section-heading"><div><p className="eyebrow">EN VIVO</p><h2>Uso ahora mismo</h2></div></div>
      <p className="hint no-top">Hoy {formatDate(today)} · {nowLabel}</p>
      <div className="resources-table">
        <div className="resources-table-row head"><span>Recurso</span><span>Cantidad existente</span><span>En uso ahora</span><span>Libres</span></div>
        {resources.map((resource) => {
          const used = inUseFor(resource.id)
          return <div className="resources-table-row" key={resource.id}>
            <span>{resource.name}</span>
            <span>{resource.capacity}</span>
            <span>{used}</span>
            <span>{Math.max(resource.capacity - used, 0)}</span>
          </div>
        })}
        {resources.length === 0 && <p className="cart-empty">Todavía no hay recursos cargados.</p>}
      </div>
    </section>
  </>
}

function Reports({ report, month, onMonth }: { report: ReservationReport | null, month: string, onMonth: (month: string) => void }) {
  if (!report) return <><div className="month-picker"><label>Mes a consultar <input type="month" value={month} onChange={(event) => onMonth(event.target.value)}/></label></div><div className="loading-line"><span className="spinner dark"/>Cargando reportes...</div></>
  const categoryName = (category: Resource['category']) => category === 'audiovisual' ? 'Recursos audiovisuales' : 'Hardware de PC'
  const totals = report.monthly.reduce((all, item) => ({ requested: all.requested + item.requested, processed: all.processed + item.processed, delivered: all.delivered + item.delivered, shortage: all.shortage + item.shortage }), { requested: 0, processed: 0, delivered: 0, shortage: 0 })
  return <><div className="month-picker"><label>Mes a consultar <input type="month" value={month} onChange={(event) => onMonth(event.target.value)}/></label></div>
    <section className="monthly-summary"><div><span>SOLICITADOS</span><b>{totals.requested}</b></div><div><span>ENTREGADOS</span><b>{totals.delivered}</b></div><div><span>FALTANTES EN RETIROS</span><b>{totals.shortage}</b></div><p>De {totals.requested} unidades solicitadas, {totals.processed} ya tienen retiro registrado. Las reservas sin retiro aún no cuentan como faltantes.</p></section>
    <section className="report-card monthly-table"><p className="eyebrow">DEMANDA Y ENTREGA</p><h2>Recursos del mes</h2><div className="table-scroll"><table><thead><tr><th>Recurso</th><th>Inventario actual</th><th>Solicitadas</th><th>Entregadas</th><th>Faltaron</th></tr></thead><tbody>{report.monthly.map((item) => <tr key={item.resourceId}><td>{item.resourceName}</td><td>{item.capacity}</td><td>{item.requested}</td><td>{item.delivered}</td><td>{item.shortage}</td></tr>)}</tbody></table></div></section>
    <section className="report-card monthly-table"><p className="eyebrow">MOTIVOS REGISTRADOS</p><h2>Por qué faltaron recursos</h2>{report.shortages.length ? report.shortages.map((item) => <div className="report-row" key={item.reservationId}><span>{item.resourceName} · {item.date}</span><b>{item.requested - item.delivered} sin entregar</b><small>Reserva #{item.reservationId} · {item.reason}</small></div>) : <p className="hint">No hay faltantes registrados en este mes.</p>}</section>
    <div className="reports-grid">
    <section className="report-card"><p className="eyebrow">POR CATEGORÍA</p><h2>Uso del inventario</h2>{report.byCategory.map((item) => <div className="report-row" key={item.category}><span>{categoryName(item.category)}</span><b>{item.units} unidades</b><small>{item.reservations} reservas</small></div>)}</section>
    <section className="report-card"><p className="eyebrow">MÁS UTILIZADOS</p><h2>Recursos</h2>{report.byResource.map((item) => <div className="report-row" key={item.resourceId}><span>{item.resourceName}</span><b>{item.units} unidades</b><small>{item.reservations} reservas</small></div>)}</section>
    <section className="report-card"><p className="eyebrow">HORARIOS</p><h2>Franjas más solicitadas</h2>{report.byHour.map((item) => <div className="report-row" key={item.hour}><span>{String(item.hour).padStart(2, '0')}:00</span><b>{item.reservations} reservas</b><small>{item.units} unidades</small></div>)}</section>
  </div></>
}

function DeliveryForm({ reservation, busy, onClose, onSave }: { reservation: Reservation, busy: boolean, onClose: () => void, onSave: (quantity: number, reason: string, observation: string) => void }) {
  const [quantity, setQuantity] = useState(reservation.quantity)
  const [reason, setReason] = useState('')
  const [observation, setObservation] = useState('')
  return <form className="reservation-form" onSubmit={(event) => { event.preventDefault(); onSave(quantity, reason.trim(), observation.trim()) }}>
    <p>Solicitaron <b>{reservation.quantity}</b> unidades de <b>{reservation.resourceName}</b>. Registrá lo que se entrega al retirar.</p>
    <div className="field-grid"><label>Cantidad entregada<input type="number" min="0" max={reservation.quantity} required value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></label>
    {quantity < reservation.quantity && <label className="span-2">¿Por qué no se pudo entregar todo?<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: dos computadoras fuera de servicio"/></label>}
    <label className="span-2">Observaciones del retiro (opcional)<textarea maxLength={1000} value={observation} onChange={(event) => setObservation(event.target.value)}/></label></div>
    <div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !Number.isInteger(quantity) || quantity < 0 || quantity > reservation.quantity || quantity < reservation.quantity && !reason.trim()}>{busy ? 'Guardando...' : 'Registrar retiro'}</button></div>
  </form>
}

function Incidents({ incidents, resources, reservations, admin, busy, onCreate, onResolve }: {
  incidents: Incident[], resources: Resource[], reservations: Reservation[], admin: boolean, busy: boolean,
  onCreate: (input: { resourceId: string, reservationId: string, equipmentIdentifier: string, description: string }) => Promise<boolean>,
  onResolve: (id: string, resolution: string) => Promise<boolean>,
}) {
  const [reservationId, setReservationId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [description, setDescription] = useState('')
  const selected = reservations.find((item) => item.id === reservationId)
  const chosenResource = selected?.resourceId || resourceId
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await onCreate({ resourceId: chosenResource, reservationId, equipmentIdentifier: identifier.trim(), description: description.trim() })) {
      setDescription(''); setIdentifier(''); setReservationId(''); setResourceId('')
    }
  }
  return <div className="incidents-layout">
    <form className="report-card incident-form" onSubmit={(event) => void submit(event)}><p className="eyebrow">NUEVO REPORTE</p><h2>Informar un problema</h2>
      <label>Reserva relacionada <select value={reservationId} onChange={(event) => { setReservationId(event.target.value); setResourceId('') }}><option value="">{admin ? 'Sin reserva asociada' : 'Seleccionar reserva'}</option>{reservations.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.resourceName} · {item.date}</option>)}</select></label>
      {admin && !reservationId && <label>Recurso <select required value={resourceId} onChange={(event) => setResourceId(event.target.value)}><option value="">Seleccionar recurso</option>{resources.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.location}</option>)}</select></label>}
      <label>Identificación de la PC (opcional)<input maxLength={100} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Ej.: PC 08 o código de inventario"/></label>
      <label>¿Qué pasó?<textarea required maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describí la falla y cuándo la notaste"/></label>
      <button className="button primary" disabled={busy || !chosenResource || !description.trim()}>Enviar reporte</button>
    </form>
    <section className="report-card"><p className="eyebrow">SEGUIMIENTO</p><h2>{admin ? 'Todos los reportes' : 'Mis reportes'}</h2>
      {!incidents.length && <p className="hint">Todavía no hay problemas informados.</p>}
      {incidents.map((item) => <article className="incident-item" key={item.id}><div className="incident-head"><b>{item.resourceName}{item.equipmentIdentifier ? ` · ${item.equipmentIdentifier}` : ''}</b><span className={`badge ${item.status === 'resuelto' ? 'status-finalizada' : 'status-rechazada'}`}>{item.status}</span></div>
        <p>{item.description}</p><small>{item.reportedAt.slice(0, 16).replace('T', ' ')} · {item.reporterName}{item.reservationId ? ` · Reserva #${item.reservationId}` : ''}</small>
        {item.resolution && <p><b>Resolución:</b> {item.resolution}</p>}
        {admin && item.status === 'abierto' && <form className="resolve-form" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const value = (new FormData(form).get('resolution') || '').toString().trim(); if (value && await onResolve(item.id, value)) form.reset() }}><input name="resolution" required maxLength={1000} placeholder="Cómo se resolvió"/><button className="button mini ghost" disabled={busy}>Resolver</button></form>}
      </article>)}
    </section>
  </div>
}

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}T12:00:00`)
  const noYear = { weekday: 'long' as const, day: 'numeric' as const, month: 'long' as const }
  const opts = date.getFullYear() === new Date().getFullYear() ? noYear : { ...noYear, year: 'numeric' as const }
  return new Intl.DateTimeFormat('es-AR', opts).format(date)
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'offline' | 'forbidden' | 'ready'>('loading')
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('dashboard')
  const [menu, setMenu] = useState(false)
  const [resources, setResources] = useState<Resource[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [report, setReport] = useState<ReservationReport | null>(null)
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('sv-SE').slice(0, 7))
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [delivery, setDelivery] = useState<Reservation | null>(null)
  const [category, setCategory] = useState<'all' | Resource['category']>('all')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [preferredResourceId, setPreferredResourceId] = useState('')
  const [toast, setToast] = useState('')

  const restore = async () => {
    setAuthState('loading'); setAuthError('')
    try {
      const current = await restoreSession()
      setSession(current)
      setAuthState(canAccessGaliservas(current) ? 'ready' : 'forbidden')
    }
    catch (error) {
      setSession(null)
      if (error instanceof ApiError && error.connection) { setAuthError(error.message); setAuthState('offline') }
      else setAuthState('guest')
    }
  }
  const restoreOnMount = useEffectEvent(restore)
  useEffect(() => {
    const timer = window.setTimeout(() => void restoreOnMount(), 0)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3500); return () => window.clearTimeout(timer) }, [toast])

  const admin = session ? canAdmin(session) : false
  const loadData = async () => {
    if (!session) return
    setDataLoading(true); setDataError('')
    try {
      const [nextResources, nextReservations, nextReport, nextIncidents] = await Promise.all([
        getResources(), getReservations(admin ? undefined : 'mine'), admin ? getReservationReport(month) : Promise.resolve(null), getIncidents(),
      ])
      setResources(nextResources); setReservations(nextReservations)
      setReport(nextReport); setIncidents(nextIncidents)
    } catch (error) { setDataError(messageOf(error)) }
    finally { setDataLoading(false) }
  }
  const loadDataOnSessionChange = useEffectEvent(loadData)
  useEffect(() => {
    const timer = window.setTimeout(() => void loadDataOnSessionChange(), 0)
    return () => window.clearTimeout(timer)
  }, [session?.user.id, admin, month])

  const navigate = (next: Page, resourceId = '') => { setPage(next); setMenu(false); setEditing(null); setPreferredResourceId(next === 'new' ? resourceId : '') }
  const mutate = async (action: () => Promise<unknown>, success: string, id = 'form') => {
    setBusyId(id)
    try { await action(); setToast(success); setEditing(null); await loadData(); return true }
    catch (error) { setToast(`Error: ${messageOf(error)}`); return false }
    finally { setBusyId('') }
  }
  const createResourceItem = (input: ResourceInput) => mutate(() => createResource(input), 'Recurso creado correctamente.', 'resource-form')
  const addResourceQuantity = (resource: Resource, extra: number, busyKey?: string) => mutate(() => updateResource(resource.id, {
    name: resource.name, type: resource.type, category: resource.category, location: resource.location,
    description: resource.description, capacity: resource.capacity + extra, active: resource.active, available: true,
  }), `Se sumaron ${extra} unidades a "${resource.name}".`, busyKey ?? `resource-qty-${resource.id}`)
  const submitReservationBatch = async (
    shared: { date: string, start: string, end: string, reason: string },
    items: { resourceId: string, quantity: number }[],
  ) => {
    setBusyId('form')
    const failures: { resourceId: string, message: string }[] = []
    let successCount = 0
    for (const item of items) {
      try {
        await createReservation({ resourceId: item.resourceId, quantity: item.quantity, date: shared.date, start: shared.start, end: shared.end, reason: shared.reason })
        successCount++
      } catch (error) { failures.push({ resourceId: item.resourceId, message: messageOf(error) }) }
    }
    setBusyId('')
    if (successCount > 0) await loadData()
    if (failures.length === 0) { setToast(successCount === 1 ? 'Reserva creada correctamente.' : `${successCount} reservas creadas correctamente.`); navigate('mine') }
    else if (successCount > 0) setToast(`Se crearon ${successCount} de ${items.length} reservas. Revisá los recursos marcados en rojo.`)
    else setToast('Error: no se pudo crear ninguna reserva.')
    return { failures }
  }
  const doLogout = async () => {
    setBusyId('logout')
    try { await logout(); window.location.assign(GALISENCIA_URL) }
    catch (error) { setToast(`No se pudo cerrar la sesión: ${messageOf(error)}`) }
    finally { setBusyId('') }
  }

  if (authState === 'loading') return <div className="splash"><img className="system-logo splash-logo" src="/logo-galiservas.png" alt="Logotipo de Galiservas"/><span className="spinner dark"/><p>Conectando con Galileo Auth</p></div>
  if (authState === 'offline') return <main className="connection-page"><div className="connection-card"><div className="warning-mark">!</div><p className="eyebrow">SIN CONEXIÓN</p><h1>No pudimos llegar al servidor</h1><p>{authError}</p><button className="button primary" onClick={() => void restore()}>Reintentar conexión</button><code>API: {import.meta.env.VITE_API_URL || 'http://localhost:8080/api'}</code></div></main>
  if (authState === 'forbidden') return <main className="connection-page"><div className="connection-card"><div className="warning-mark">!</div><p className="eyebrow">ACCESO RESTRINGIDO</p><h1>Tu rol no puede ingresar</h1><p>Galiservas está disponible únicamente para Preceptores, Docentes y Administradores.</p><a className="button primary" href={GALISENCIA_URL}>Volver a Galisencia</a></div></main>
  if (!session) return <Login onSuccess={(current) => { setSession(current); setAuthState('ready') }}/>

  const nav: { id: Page, label: string, icon: IconName }[] = [
    { id: 'dashboard', label: 'Panel general', icon: 'grid' },
    { id: 'aulas', label: 'Aulas', icon: 'monitor' },
    { id: 'panol', label: 'Pañol', icon: 'box' },
    ...(admin ? [{ id: 'reservations' as Page, label: 'Reservas', icon: 'calendar' as const }] : []),
    ...(admin ? [{ id: 'resources' as Page, label: 'Recursos', icon: 'layers' as const }] : []),
    ...(admin ? [{ id: 'reports' as Page, label: 'Reportes', icon: 'clock' as const }] : []),
    { id: 'incidents', label: 'Problemas con PC', icon: 'monitor' },
    { id: 'mine', label: 'Mis reservas', icon: 'user' }, { id: 'new', label: 'Nueva reserva', icon: 'plus' },
  ]
  const visibleReservations = page === 'mine' ? reservations.filter((item) => !item.userId || item.userId === session.user.id) : reservations
  const catalogResources = (page === 'aulas' ? resources.filter((item) => item.location !== 'Pañol') : page === 'panol' ? resources.filter((item) => item.location === 'Pañol') : resources)
    .filter((item) => page === 'aulas' || category === 'all' || item.category === category)

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <div className="brand"><img className="system-logo sidebar-logo" src="/logo-galiservas.png" alt="Logotipo de Galiservas"/><div><b>GALISERVAS</b><small>GESTIÓN DE RECURSOS</small></div><button className="icon-button close-menu" onClick={() => setMenu(false)} aria-label="Cerrar menú"><Icon name="close"/></button></div>
      <nav aria-label="Navegación principal">{nav.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-footer"><div className="user-avatar">{session.user.name.slice(0, 2).toUpperCase()}</div><div><b>{session.user.name}</b><small>{session.user.role}</small></div><button className="icon-button" onClick={() => void doLogout()} disabled={busyId === 'logout'} aria-label="Cerrar sesión"><Icon name="logout"/></button></div>
    </aside>
    {menu && <button className="menu-backdrop" onClick={() => setMenu(false)} aria-label="Cerrar menú"/>}
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenu(true)} aria-label="Abrir menú"><Icon name="menu"/></button><div><p className="eyebrow">E.E.S.T. N°5 · GALILEO GALILEI</p><span>Sistema de reservas</span></div><button className="button primary compact" onClick={() => navigate('new')}><Icon name="plus"/> Nueva reserva</button></header>
      <div className="content">
        {dataError && <div className="alert connection" role="alert"><div><b>No se pudieron cargar los datos</b><span>{dataError}</span></div><button className="button mini ghost" onClick={() => void loadData()}>Reintentar</button></div>}
        {page === 'dashboard' && <>
          <section className="page-title hero-title"><div><p className="eyebrow">PANEL GENERAL</p><h1>Buen día, {session.user.name.split(' ')[0]}.</h1><p>Consultá la disponibilidad de los espacios técnicos.</p></div><div className="date-chip"><Icon name="calendar"/><div><small>HOY</small><b>{new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date())}</b></div></div></section>
          <section className="summary-grid"><article><span>RECURSOS ACTIVOS</span><b>{resources.filter((r) => r.active).length}</b><small>espacios y equipos</small></article><article><span>CAPACIDAD HABILITADA</span><b>{resources.reduce((sum, r) => sum + r.capacity, 0)}</b><small>unidades reservables</small></article><article><span>RESERVAS REGISTRADAS</span><b>{reservations.length}</b><small>en tu vista actual</small></article></section>
        </>}
        {(page === 'dashboard' || page === 'aulas' || page === 'panol') && <>
          {page !== 'dashboard' && <section className="page-title"><div><p className="eyebrow">{page === 'aulas' ? 'LABORATORIOS' : 'INVENTARIO MÓVIL'}</p><h1>{page === 'aulas' ? 'Aulas' : 'Pañol'}</h1><p>{page === 'aulas' ? 'Reservá una cantidad de computadoras para una fecha y horario.' : 'Reservá notebooks, hardware y recursos audiovisuales.'}</p></div></section>}
          <div className="section-heading"><div><p className="eyebrow">CATÁLOGO</p><h2>{page === 'aulas' ? 'Computadoras por aula' : page === 'panol' ? 'Equipos del Pañol' : 'Espacios y equipos'}</h2></div><button className="refresh" onClick={() => void loadData()} disabled={dataLoading}>{dataLoading ? 'Actualizando...' : 'Actualizar'}</button></div>
          {page !== 'aulas' && <div className="category-filters" role="group" aria-label="Filtrar recursos por categoría"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Todos</button><button className={category === 'hardware_pc' ? 'active' : ''} onClick={() => setCategory('hardware_pc')}>Hardware de PC</button><button className={category === 'audiovisual' ? 'active' : ''} onClick={() => setCategory('audiovisual')}>Audiovisuales</button></div>}
          {dataLoading && !resources.length ? <div className="resource-grid">{[1,2,3,4].map((i) => <div className="resource-card skeleton" key={i}/>)}</div> : catalogResources.length ? <div className="resource-grid">{catalogResources.map((resource) => <ResourceCard key={resource.id} resource={resource} onReserve={() => navigate('new', resource.id)}/>)}</div> : !dataError && <div className="empty"><div className="empty-icon"><Icon name={page === 'panol' ? 'box' : 'monitor'}/></div><h3>No hay recursos en esta categoría</h3><p>Probá con otro filtro o actualizá el catálogo.</p></div>}
        </>}
        {(page === 'reservations' || page === 'mine') && <>
          <section className="page-title"><div><p className="eyebrow">{page === 'mine' ? 'ACTIVIDAD PERSONAL' : 'ADMINISTRACIÓN'}</p><h1>{page === 'mine' ? 'Mis reservas' : 'Todas las reservas'}</h1><p>{page === 'mine' ? 'Seguí y administrá tus solicitudes.' : 'Supervisá solicitudes y actualizá sus estados.'}</p></div></section>
          {dataLoading && !reservations.length ? <div className="loading-line"><span className="spinner dark"/>Cargando reservas...</div> : <ReservationsList reservations={visibleReservations} admin={admin} userId={session.user.id} busyId={busyId} onEdit={setEditing} onDelivery={setDelivery} onCancel={(item) => { if (window.confirm('¿Querés cancelar esta reserva?')) void mutate(() => cancelReservation(item.id), 'Reserva cancelada.', item.id) }} onStatus={(item, status) => void mutate(() => setReservationStatus(item.id, status), 'Estado actualizado.', item.id)}/>} 
        </>}
        {page === 'reports' && <><section className="page-title"><div><p className="eyebrow">ANÁLISIS DE USO</p><h1>Reportes de reservas</h1><p>Recursos más utilizados, categorías y horarios de mayor demanda.</p></div></section><Reports report={report} month={month} onMonth={(value) => { setReport(null); setMonth(value) }}/></>}
        {page === 'incidents' && <><section className="page-title"><div><p className="eyebrow">MANTENIMIENTO</p><h1>Problemas con equipos</h1><p>Informá fallas de las PC y seguí su resolución.</p></div></section><Incidents incidents={incidents} resources={resources} reservations={visibleReservations} admin={admin} busy={busyId === 'incident'} onCreate={(input) => mutate(() => createIncident(input), 'Problema informado.', 'incident')} onResolve={(id, resolution) => mutate(() => resolveIncident(id, resolution), 'Problema resuelto.', 'incident')}/></>}
        {page === 'resources' && <><section className="page-title"><div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Recursos</h1><p>Agregá aulas y objetos nuevos, o sumá cantidad a los que ya existen.</p></div></section><ResourcesAdmin resources={resources} reservations={reservations} busyId={busyId} onCreate={createResourceItem} onAddQuantity={addResourceQuantity}/></>}
        {page === 'new' && <><section className="page-title"><div><p className="eyebrow">NUEVA SOLICITUD</p><h1>Reservar recursos</h1><p>Indicá cuándo, y sumá todas las aulas y objetos que necesites para esa reserva.</p></div></section><section className="form-card"><div className="form-card-head"><div className="step-number">01</div><div><h2>Datos de la reserva</h2><p>Podés agregar más de un recurso antes de confirmar.</p></div></div><NewReservationForm resources={resources} preferredResourceId={preferredResourceId} busy={busyId === 'form'} onSubmit={submitReservationBatch}/></section></>}
      </div>
    </main>
    {delivery && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDelivery(null) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delivery-title"><div className="modal-head"><div><p className="eyebrow">ANTES DE RETIRAR</p><h2 id="delivery-title">Registrar entrega</h2></div><button className="icon-button" onClick={() => setDelivery(null)} aria-label="Cerrar"><Icon name="close"/></button></div><DeliveryForm reservation={delivery} busy={busyId === delivery.id} onClose={() => setDelivery(null)} onSave={(quantity, reason, observation) => void (async () => { if (await mutate(() => recordDelivery(delivery.id, quantity, reason, observation), 'Retiro registrado.', delivery.id)) setDelivery(null) })()}/></section></div>}
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="modal-head"><div><p className="eyebrow">EDITAR RESERVA</p><h2 id="edit-title">{editing.resourceName}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Cerrar"><Icon name="close"/></button></div><ReservationForm resources={resources} initial={editing} busy={busyId === editing.id} onClose={() => setEditing(null)} onSubmit={(input) => void mutate(() => updateReservation(editing.id, input), 'Reserva actualizada.', editing.id)}/></section></div>}
    {toast && <div className={`toast ${toast.startsWith('Error') || toast.startsWith('No se') ? 'toast-error' : ''}`} role="status">{toast}</div>}
  </div>
}

export default App
