import { useEffect, useEffectEvent, useState, type FormEvent, type ReactNode } from 'react'
import {
  API_URL,
  ApiError, cancelReservation, createReservation, createResource, getReservationReport, getReservations, getResources,
  logout, restoreSession, setReservationStatus, updateReservation, updateResource,
} from './api'
import { hoyLocal, horaLocal, ZONA_HORARIA } from './fecha'
import type { Page, Reservation, ReservationInput, ReservationReport, Resource, ResourceInput, Session } from './types'
import { AppLayout, type NavItem } from './components/AppLayout'
import { Icon, type IconName } from './components/Icon'
import { LoginPage } from './components/LoginPage'
import { SplashScreen, StatusScreen } from './components/StatusScreen'
import { canAccessGaliservas, GALISENCIA_URL, messageOf, normalize } from './utils'
import { useTheme } from './theme'
import './App.css'

const emptyForm = (): ReservationInput => ({ resourceId: '', date: hoyLocal(), start: '08:00', end: '09:00', quantity: 1, reason: '' })

const stateFor = (session: Session) => !canAccessGaliservas(session) ? 'forbidden' as const : session.mustChangePassword ? 'password' as const : 'ready' as const
const canAdmin = (session: Session) => {
  const role = normalize(session.user.role)
  const permissions = session.permissions.map(normalize)
  return ['admin', 'administrador'].includes(role)
    || permissions.some((permission) => /(administr|gestionar.*reserva|reservas.*gestionar|reserva.*estado)/.test(permission))
}
const canChange = (reservation: Reservation) => !['cancelada', 'rechazada', 'finalizada'].includes(normalize(reservation.status))

function statusBadge(status: string) {
  const value = normalize(status)
  if (['aprobada', 'confirmada'].includes(value)) return 'badge badge-success'
  if (['cancelada', 'rechazada'].includes(value)) return 'badge badge-danger'
  if (value === 'finalizada') return 'badge badge-neutral'
  return 'badge badge-warning'
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`${statusBadge(status)} status-${normalize(status)}`}><span className="dot" />{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

function EmptyState({ icon, title, children }: { icon: IconName, title: string, children: ReactNode }) {
  return <div className="card empty-state">
    <div className="empty-state__icon"><Icon name={icon}/></div>
    <h3 className="empty-state__title">{title}</h3>
    <p className="empty-state__desc">{children}</p>
  </div>
}

function LoadingLine({ children }: { children: ReactNode }) {
  return <div className="loading-line" role="status"><span className="spinner"/>{children}</div>
}

function ReservationForm({ resources, initial, preferredResourceId, busy, onSubmit, onClose }: {
  resources: Resource[], initial?: Reservation, preferredResourceId?: string, busy: boolean, onSubmit: (input: ReservationInput) => void, onClose?: () => void
}) {
  const [form, setForm] = useState<ReservationInput>(() => {
    if (initial) return { resourceId: initial.resourceId, date: initial.date, start: initial.start, end: initial.end, quantity: initial.quantity, reason: initial.reason }
    const initialResourceId = preferredResourceId || resources[0]?.id || ''
    const initialResource = resources.find((resource) => resource.id === initialResourceId)
    const base = emptyForm()
    return { ...base, resourceId: initialResourceId, quantity: initialResource?.type === 'desktop_pc' ? initialResource.capacity : base.quantity }
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
    if (form.date < hoyLocal()) return setError('La fecha no puede ser anterior a hoy.')
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
  return <form className="gform" onSubmit={submit} noValidate>
    {error && <div className="alert alert--error" role="alert"><Icon name="alert"/><span>{error}</span></div>}
    <div className="field-grid">
      <label className="span-2">Recurso<select value={form.resourceId} onChange={(e) => change('resourceId', e.target.value)} disabled={busy}>
        <option value="">Seleccionar recurso</option>{resources.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.capacity} equipos</option>)}
      </select></label>
      <label className={isRoom ? 'span-2' : undefined}>Fecha<input type="date" min={hoyLocal()} value={form.date} onChange={(e) => change('date', e.target.value)} disabled={busy}/>{isRoom && <small>{checkingAvailability ? 'Consultando disponibilidad...' : (slotAvailable ?? selected?.capacity ?? 0) >= (selected?.capacity ?? 0) ? `Aula completa disponible (${selected?.capacity} equipos)` : `Solo disponible parcialmente para ese horario`}</small>}</label>
      {!isRoom && <label>Cantidad<input type="number" min="1" max={slotAvailable ?? selected?.capacity ?? 1} value={form.quantity} onChange={(e) => change('quantity', Number(e.target.value))} disabled={busy || checkingAvailability}/><small>{checkingAvailability ? 'Consultando disponibilidad...' : `Disponibles en esa franja: ${slotAvailable ?? selected?.capacity ?? 0}`}</small></label>}
      <label>Hora de inicio<input type="time" value={form.start} onChange={(e) => change('start', e.target.value)} disabled={busy}/></label>
      <label>Hora de fin<input type="time" value={form.end} onChange={(e) => change('end', e.target.value)} disabled={busy}/></label>
      <label className="span-2">Motivo<textarea rows={4} maxLength={300} value={form.reason} onChange={(e) => change('reason', e.target.value)} placeholder="Ej.: Práctica de programación de 4° año" disabled={busy}/><small className="counter">{form.reason.length}/300</small></label>
    </div>
    <div className="form-actions">{onClose && <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>}<button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando...' : initial ? 'Guardar cambios' : 'Confirmar reserva'}</button></div>
  </form>
}

type CartItem = { resourceId: string, resourceName: string, quantity: number, capacity: number, available: number, isRoom: boolean }

function NewReservationForm({ resources, preferredResourceId, busy, onSubmit }: {
  resources: Resource[], preferredResourceId?: string, busy: boolean,
  onSubmit: (shared: { date: string, start: string, end: string, reason: string }, items: { resourceId: string, quantity: number }[]) => Promise<{ failures: { resourceId: string, message: string }[] }>,
}) {
  const activeResources = resources.filter((item) => item.active)
  const [shared, setShared] = useState(() => ({ date: hoyLocal(), start: '08:00', end: '09:00', reason: '' }))
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
    if (shared.date < hoyLocal()) return setFormError('La fecha no puede ser anterior a hoy.')
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

  return <form className="gform cart-form" onSubmit={(e) => void submit(e)} noValidate>
    {formError && <div className="alert alert--error" role="alert"><Icon name="alert"/><span>{formError}</span></div>}
    <div className="field-grid field-grid--3">
      <label>Fecha<input type="date" min={hoyLocal()} value={shared.date} onChange={(e) => changeShared('date', e.target.value)} disabled={disabled}/></label>
      <label>Hora de inicio<input type="time" value={shared.start} onChange={(e) => changeShared('start', e.target.value)} disabled={disabled}/></label>
      <label>Hora de fin<input type="time" value={shared.end} onChange={(e) => changeShared('end', e.target.value)} disabled={disabled}/></label>
      <label className="span-all">Motivo<textarea rows={3} maxLength={300} value={shared.reason} onChange={(e) => changeShared('reason', e.target.value)} placeholder="Ej.: Práctica de programación de 4° año" disabled={disabled}/><small className="counter">{shared.reason.length}/300</small></label>
    </div>

    <div className="cart-add">
      <p className="card-kicker">Sumá recursos a esta reserva</p>
      <div className="cart-add__row">
        <label>Recurso<select value={pendingResourceId} onChange={(e) => changePendingResource(e.target.value)} disabled={disabled || availableOptions.length === 0}>
          {availableOptions.length === 0 && <option value="">No quedan más recursos para agregar</option>}
          {availableOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.capacity} equipos</option>)}
        </select></label>
        {pendingResourceId && !isRoom && <label className="cart-add__qty">Cantidad<input type="number" min="1" max={slotAvailable ?? pendingResource?.capacity ?? 1} value={pendingQuantity} onChange={(e) => setPendingQuantity(Number(e.target.value))} disabled={disabled || checkingAvailability}/></label>}
        <button type="button" className="btn btn-soft cart-add__btn" onClick={addToCart} disabled={disabled || !pendingResourceId || checkingAvailability}><Icon name="plus"/> Agregar</button>
      </div>
      {pendingResourceId && <p className="hint">{checkingAvailability ? 'Consultando disponibilidad...' : isRoom ? ((slotAvailable ?? pendingResource?.capacity ?? 0) >= (pendingResource?.capacity ?? 0) ? `Aula completa disponible (${pendingResource?.capacity} equipos)` : 'Esta aula ya tiene equipos reservados en ese horario.') : `Disponibles en esa franja: ${slotAvailable ?? pendingResource?.capacity ?? 0}`}</p>}
      {addError && <div className="alert alert--error alert--compact" role="alert"><Icon name="alert"/><span>{addError}</span></div>}
    </div>

    <div className="cart-list">
      {cart.length === 0 ? <p className="cart-empty">Todavía no agregaste ningún recurso a esta reserva.</p> : cart.map((item) => <div className="cart-row" key={item.resourceId}>
        <span className="cart-row__icon"><Icon name={item.isRoom ? 'monitor' : 'box'}/></span>
        <span className="cart-row__name">{item.resourceName}</span>
        {item.isRoom ? <span className="cart-row__qty">Aula completa · {item.capacity} equipos</span> : <input type="number" min="1" max={item.available} value={item.quantity} onChange={(e) => updateCartQuantity(item.resourceId, Number(e.target.value))} disabled={disabled} aria-label={`Cantidad de ${item.resourceName}`}/>}
        <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeFromCart(item.resourceId)} aria-label={`Quitar ${item.resourceName}`} disabled={disabled}><Icon name="close"/></button>
      </div>)}
    </div>

    <div className="form-actions">
      <button type="submit" className="btn btn-primary" disabled={disabled}>{disabled ? 'Guardando...' : `Confirmar reserva${cart.length ? ` (${cart.length})` : ''}`}</button>
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
  const level = percentage === 0 ? 'empty' : percentage < 35 ? 'low' : 'ok'
  return <article className="card resource-card">
    <div className="resource-card__top">
      <div className={`resource-icon resource-icon--${resource.type}`}><Icon name={display.icon}/></div>
      <span className={`badge ${resource.available ? 'badge-success' : 'badge-danger'}`}><span className="dot"/>{resource.available ? 'Disponible' : 'Sin disponibilidad'}</span>
    </div>
    <p className="resource-type">{display.label}</p>
    <h3 className="resource-name">{resource.name}</h3>
    <div className={`meter meter--${level}`}><span style={{ width: `${percentage}%` }}/></div>
    <div className="capacity"><b>{resource.available}</b><span> disponibles de {resource.capacity}</span></div>
    <button type="button" className="btn btn-soft btn-sm resource-card__cta" onClick={onReserve} disabled={!resource.active || resource.available < 1} aria-label={`Reservar recurso ${resource.name}`}>Reservar recurso <Icon name="arrow-right"/></button>
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

function ReservationsList({ reservations, admin, userId, busyId, onEdit, onCancel, onStatus }: {
  reservations: Reservation[], admin: boolean, userId: string, busyId: string, onEdit: (r: Reservation) => void,
  onCancel: (r: Reservation) => void, onStatus: (r: Reservation, status: string) => void,
}) {
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({})
  const groups = reservations.reduce<Record<string, Reservation[]>>((all, item) => ((all[item.date || 'Sin fecha'] ??= []).push(item), all), {})
  if (!reservations.length) return <EmptyState icon="calendar" title="No hay reservas para mostrar">Las reservas nuevas aparecerán organizadas por día.</EmptyState>
  const sortedDates = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  return <div className="day-groups">{sortedDates.map(([date, items], index) => {
    const isOpen = openDates[date] ?? index === 0
    const groupedItems = groupReservations(items).sort((a, b) => a.start.localeCompare(b.start))
    return <section className={`card day-group${isOpen ? ' open' : ''}`} key={date}>
      <button type="button" className="day-group__header" onClick={() => setOpenDates((current) => ({ ...current, [date]: !isOpen }))} aria-expanded={isOpen}>
        <span className="day-group__icon"><Icon name="calendar"/></span>
        <time dateTime={date}>{formatDate(date)}</time>
        <span className="badge badge-brand">{items.length} {items.length === 1 ? 'reserva' : 'reservas'}</span>
        <span className="day-group__chevron"><Icon name="chevron"/></span>
      </button>
      {isOpen && <div className="reservation-list">{groupedItems.map((group) => {
        const own = group.items.every((item) => !item.userId || item.userId === userId)
        const single = group.items.length === 1 ? group.items[0] : null
        return <article className="reservation-row" key={group.key}>
          <div className="time-block"><b>{group.start}</b><span>{group.end}</span></div>
          <div className="reservation-info">
            <div className="reservation-info__title">
              <h3>{single ? (single.resourceName || `Recurso #${single.resourceId}`) : `${group.items.length} recursos reservados`}</h3>
              {single && <StatusBadge status={single.status}/>}
            </div>
            <p>{group.reason || 'Sin motivo especificado'}</p>
            {!single && <div className="grouped-items">{group.items.map((item) => <div className="grouped-item" key={item.id}>
              <span className="grouped-item__name">{item.resourceName || `Recurso #${item.resourceId}`}</span>
              <span className="grouped-item__qty">{item.quantity} {item.quantity === 1 ? 'equipo' : 'equipos'}</span>
              <StatusBadge status={item.status}/>
              {(admin || (!item.userId || item.userId === userId)) && canChange(item) && <div className="row-actions row-actions--mini">
                {(!item.userId || item.userId === userId) && <button type="button" className="btn btn-ghost btn-xs" onClick={() => onEdit(item)} disabled={busyId === item.id}>Editar</button>}
                {admin && normalize(item.status) !== 'finalizada' && <button type="button" className="btn btn-ghost btn-xs" onClick={() => onStatus(item, 'finalizada')} disabled={busyId === item.id}>Finalizar</button>}
                <button type="button" className="btn btn-danger btn-xs" onClick={() => onCancel(item)} disabled={busyId === item.id}>Cancelar</button>
              </div>}
            </div>)}</div>}
            <small>{single ? `${single.quantity} ${single.quantity === 1 ? 'equipo' : 'equipos'}` : ''}{admin && group.userName ? `${single ? ' · ' : ''}${group.userName}` : ''}</small>
          </div>
          {single && (admin || own) && canChange(single) && <div className="row-actions">
            {own && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(single)} disabled={busyId === single.id}>Editar</button>}
            {admin && normalize(single.status) !== 'finalizada' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStatus(single, 'finalizada')} disabled={busyId === single.id}>Finalizar</button>}
            {(own || admin) && <button type="button" className="btn btn-danger btn-sm" onClick={() => onCancel(single)} disabled={busyId === single.id}>Cancelar</button>}
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

function FormCard({ step, title, description, children }: { step: string, title: string, description: string, children: ReactNode }) {
  return <section className="card form-card">
    <div className="form-card__head"><div className="step-number">{step}</div><div><h2>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>
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

  return <div className="stack">
    <FormCard step="01" title="Nuevo recurso" description="Sumá una nueva aula u objeto al catálogo, o cantidad a uno que ya existe.">
      <form className="gform" onSubmit={(e) => void submit(e)} noValidate>
        {error && <div className="alert alert--error" role="alert"><Icon name="alert"/><span>{error}</span></div>}
        {!matchedResource && <div className="seg seg--block" role="group" aria-label="Tipo de recurso">
          <button type="button" className={`seg__btn${kind === 'aula' ? ' on' : ''}`} aria-pressed={kind === 'aula'} onClick={() => changeKind('aula')} disabled={busy}><Icon name="monitor"/>Aula</button>
          <button type="button" className={`seg__btn${kind === 'objeto' ? ' on' : ''}`} aria-pressed={kind === 'objeto'} onClick={() => changeKind('objeto')} disabled={busy}><Icon name="box"/>Objeto del Pañol</button>
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
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearMatch} disabled={busy}>Usar otro nombre</button>
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
        <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando...' : matchedResource ? `Sumar ${form.capacity || 0} ${form.capacity === 1 ? 'unidad' : 'unidades'}` : 'Agregar al catálogo'}</button></div>
      </form>
    </FormCard>

    <ResourcesInventoryOverview resources={resources} reservations={reservations}/>
  </div>
}

function ResourcesInventoryOverview({ resources, reservations }: { resources: Resource[], reservations: Reservation[] }) {
  const now = new Date()
  const today = hoyLocal(now)
  const nowTime = horaLocal(now)
  const nowLabel = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_HORARIA }).format(now)
  const inUseFor = (resourceId: string) => reservations
    .filter((item) => item.resourceId === resourceId && item.date === today && item.start <= nowTime && item.end > nowTime && !['cancelada', 'rechazada', 'finalizada'].includes(normalize(item.status)))
    .reduce((sum, item) => sum + item.quantity, 0)

  return <>
    <section className="card card-pad-lg">
      <div className="section-head"><div><p className="card-kicker">Catálogo actual</p><h2>Aulas y objetos en el inventario</h2></div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">Recurso</th><th scope="col">Ubicación</th><th scope="col">Categoría</th><th scope="col" className="num">Cantidad total</th></tr></thead>
          <tbody>
            {resources.map((resource) => <tr key={resource.id}>
              <td className="strong">{resource.name}</td>
              <td>{resource.location}</td>
              <td><span className={`badge ${resource.category === 'audiovisual' ? 'badge-info' : 'badge-brand'}`}>{resource.category === 'audiovisual' ? 'Audiovisual' : 'Hardware de PC'}</span></td>
              <td className="num">{resource.capacity}</td>
            </tr>)}
            {resources.length === 0 && <tr><td colSpan={4} className="table-empty">Todavía no hay recursos cargados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <section className="card card-pad-lg">
      <div className="section-head"><div><p className="card-kicker"><span className="dot dot-live"/> En vivo</p><h2>Uso ahora mismo</h2><p className="sub">Hoy {formatDate(today)} · {nowLabel}</p></div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">Recurso</th><th scope="col" className="num">Cantidad existente</th><th scope="col" className="num">En uso ahora</th><th scope="col" className="num">Libres</th></tr></thead>
          <tbody>
            {resources.map((resource) => {
              const used = inUseFor(resource.id)
              const free = Math.max(resource.capacity - used, 0)
              return <tr key={resource.id}>
                <td className="strong">{resource.name}</td>
                <td className="num">{resource.capacity}</td>
                <td className="num">{used > 0 ? <span className="badge badge-warning">{used}</span> : used}</td>
                <td className="num"><span className={free === 0 ? 'text-danger' : 'text-success'}>{free}</span></td>
              </tr>
            })}
            {resources.length === 0 && <tr><td colSpan={4} className="table-empty">Todavía no hay recursos cargados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>
}

function ReportBars({ rows }: { rows: { key: string, label: string, main: string, detail: string, value: number }[] }) {
  if (!rows.length) return <p className="cart-empty">Todavía no hay datos para mostrar.</p>
  const max = Math.max(...rows.map((row) => row.value), 1)
  return <div className="report-bars">{rows.map((row) => <div className="report-bar" key={row.key}>
    <div className="report-bar__top"><span className="report-bar__label">{row.label}</span><b>{row.main}</b></div>
    <div className="report-bar__track"><span style={{ width: `${Math.round(row.value / max * 100)}%` }}/></div>
    <small>{row.detail}</small>
  </div>)}</div>
}

function Reports({ report }: { report: ReservationReport | null }) {
  if (!report) return <LoadingLine>Cargando reportes...</LoadingLine>
  const categoryName = (category: Resource['category']) => category === 'audiovisual' ? 'Recursos audiovisuales' : 'Hardware de PC'
  return <div className="grid grid-3 reports-grid">
    <section className="card card-pad-lg"><p className="card-kicker">Por categoría</p><h3 className="card-title">Uso del inventario</h3>
      <ReportBars rows={report.byCategory.map((item) => ({ key: item.category, label: categoryName(item.category), main: `${item.units} unidades`, detail: `${item.reservations} reservas`, value: item.units }))}/>
    </section>
    <section className="card card-pad-lg"><p className="card-kicker">Más utilizados</p><h3 className="card-title">Recursos</h3>
      <ReportBars rows={report.byResource.map((item) => ({ key: item.resourceId, label: item.resourceName, main: `${item.units} unidades`, detail: `${item.reservations} reservas`, value: item.units }))}/>
    </section>
    <section className="card card-pad-lg"><p className="card-kicker">Horarios</p><h3 className="card-title">Franjas más solicitadas</h3>
      <ReportBars rows={report.byHour.map((item) => ({ key: String(item.hour), label: `${String(item.hour).padStart(2, '0')}:00`, main: `${item.reservations} reservas`, detail: `${item.units} unidades`, value: item.reservations }))}/>
    </section>
  </div>
}

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}T12:00:00`)
  const noYear = { weekday: 'long' as const, day: 'numeric' as const, month: 'long' as const }
  const opts = value.slice(0, 4) === hoyLocal().slice(0, 4) ? noYear : { ...noYear, year: 'numeric' as const }
  return new Intl.DateTimeFormat('es-AR', opts).format(date)
}

function PageHead({ title, sub, children }: { title: ReactNode, sub: string, children?: ReactNode }) {
  return <div className="page-head">
    <div><h1>{title}</h1><p className="sub">{sub}</p></div>
    {children && <div className="row">{children}</div>}
  </div>
}

function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'offline' | 'forbidden' | 'password' | 'ready'>('loading')
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState<Page>('dashboard')
  const [resources, setResources] = useState<Resource[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [report, setReport] = useState<ReservationReport | null>(null)
  const [category, setCategory] = useState<'all' | Resource['category']>('all')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const [preferredResourceId, setPreferredResourceId] = useState('')
  const [toast, setToast] = useState('')

  const restore = async () => {
    setAuthState('loading'); setAuthError('')
    try {
      const current = await restoreSession()
      setSession(current)
      setAuthState(stateFor(current))
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
  useEffect(() => {
    if (!editing && !cancelling) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setEditing(null); setCancelling(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, cancelling])

  const admin = session ? canAdmin(session) : false
  const loadData = async () => {
    if (!session) return
    setDataLoading(true); setDataError('')
    try {
      const [nextResources, nextReservations, nextReport] = await Promise.all([
        getResources(), getReservations(admin ? undefined : 'mine'), admin ? getReservationReport() : Promise.resolve(null),
      ])
      setResources(nextResources); setReservations(nextReservations)
      setReport(nextReport)
    } catch (error) { setDataError(messageOf(error)) }
    finally { setDataLoading(false) }
  }
  const loadDataOnSessionChange = useEffectEvent(loadData)
  useEffect(() => {
    const timer = window.setTimeout(() => void loadDataOnSessionChange(), 0)
    return () => window.clearTimeout(timer)
  }, [session?.user.id, admin])

  const navigate = (next: Page, resourceId = '') => { setPage(next); setEditing(null); setPreferredResourceId(next === 'new' ? resourceId : '') }
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
  const confirmCancel = () => {
    const item = cancelling
    if (!item) return
    setCancelling(null)
    void mutate(() => cancelReservation(item.id), 'Reserva cancelada.', item.id)
  }

  if (authState === 'loading') return <SplashScreen/>
  if (authState === 'offline') return <StatusScreen kicker="Sin conexión" title="No pudimos llegar al servidor" tone="danger" actions={<>
    <button type="button" className="login__submit" onClick={() => void restore()}>Reintentar conexión</button>
    <code className="status-screen__code">API: {API_URL}</code>
  </>}><p>{authError}</p></StatusScreen>
  if (authState === 'forbidden') return <StatusScreen kicker="Acceso restringido" title="Tu rol no puede ingresar" actions={<a className="login__submit" href={GALISENCIA_URL}>Volver a Galisencia</a>}>
    <p>Galiservas está disponible únicamente para Preceptores, Docentes y Administradores.</p>
  </StatusScreen>
  if (authState === 'password') return <StatusScreen kicker="Contraseña inicial" title="Cambiá tu contraseña" actions={<>
    <a className="login__submit" href={GALISENCIA_URL}>Ir a Galisencia</a>
    <button type="button" className="login__sso" onClick={() => void restore()}>Ya la cambié</button>
  </>}><p>Antes de usar Galiservas tenés que reemplazar la contraseña inicial. Hacelo desde Galisencia y después volvé a esta pantalla.</p></StatusScreen>
  if (!session) return <LoginPage onSuccess={(current) => { setSession(current); setAuthState(stateFor(current)) }}/>

  const nav: NavItem[] = [
    { id: 'dashboard', label: 'Panel general', icon: 'grid' },
    { id: 'aulas', label: 'Aulas', icon: 'monitor' },
    { id: 'panol', label: 'Pañol', icon: 'box' },
    ...(admin ? [{ id: 'reservations' as Page, label: 'Reservas', icon: 'calendar' as const }] : []),
    ...(admin ? [{ id: 'resources' as Page, label: 'Recursos', icon: 'layers' as const }] : []),
    ...(admin ? [{ id: 'reports' as Page, label: 'Reportes', icon: 'chart' as const }] : []),
    { id: 'mine', label: 'Mis reservas', icon: 'user' }, { id: 'new', label: 'Nueva reserva', icon: 'plus' },
  ]
  const visibleReservations = page === 'mine' ? reservations.filter((item) => !item.userId || item.userId === session.user.id) : reservations
  const catalogResources = (page === 'aulas' ? resources.filter((item) => item.location !== 'Pañol') : page === 'panol' ? resources.filter((item) => item.location === 'Pañol') : resources)
    .filter((item) => page === 'aulas' || category === 'all' || item.category === category)
  const isError = toast.startsWith('Error') || toast.startsWith('No se')

  const banner = dataError ? <div className="app__offline" role="alert">
    <div><strong>No se pudieron cargar los datos</strong><span>{dataError}</span></div>
    <button type="button" onClick={() => void loadData()} disabled={dataLoading}>{dataLoading ? 'Reintentando...' : 'Reintentar'}</button>
  </div> : null

  return <AppLayout session={session} nav={nav} page={page} onNavigate={(next) => navigate(next)} theme={theme} onToggleTheme={toggleTheme}
    onLogout={() => void doLogout()} loggingOut={busyId === 'logout'} banner={banner}>
    <div className="page" key={page}>
      {page === 'dashboard' && <>
        <PageHead title={`Buen día, ${session.user.name.split(' ')[0]}.`} sub="Consultá la disponibilidad de los espacios técnicos.">
          <div className="date-chip"><span className="date-chip__icon"><Icon name="calendar"/></span><span><small>Hoy</small><b>{new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: ZONA_HORARIA }).format(new Date())}</b></span></div>
        </PageHead>
        <div className="grid grid-3 stats-row">
          <div className="stat"><div className="stat__icon"><Icon name="layers"/></div><div className="stat__label">Recursos activos</div><div className="stat__value">{resources.filter((r) => r.active).length}</div><div className="stat__hint">espacios y equipos</div></div>
          <div className="stat stat--success"><div className="stat__icon"><Icon name="monitor"/></div><div className="stat__label">Capacidad habilitada</div><div className="stat__value">{resources.reduce((sum, r) => sum + r.capacity, 0)}</div><div className="stat__hint">unidades reservables</div></div>
          <div className="stat"><div className="stat__icon"><Icon name="calendar"/></div><div className="stat__label">Reservas registradas</div><div className="stat__value">{reservations.length}</div><div className="stat__hint">en tu vista actual</div></div>
        </div>
      </>}
      {(page === 'dashboard' || page === 'aulas' || page === 'panol') && <>
        {page !== 'dashboard' && <PageHead title={page === 'aulas' ? 'Aulas' : 'Pañol'} sub={page === 'aulas' ? 'Reservá una cantidad de computadoras para una fecha y horario.' : 'Reservá notebooks, hardware y recursos audiovisuales.'}/>}
        <div className="section-head">
          <div><p className="card-kicker">Catálogo</p><h2>{page === 'aulas' ? 'Computadoras por aula' : page === 'panol' ? 'Equipos del Pañol' : 'Espacios y equipos'}</h2></div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadData()} disabled={dataLoading}><Icon name="refresh"/>{dataLoading ? 'Actualizando...' : 'Actualizar'}</button>
        </div>
        {page !== 'aulas' && <div className="seg" role="group" aria-label="Filtrar recursos por categoría">
          <button type="button" className={`seg__btn${category === 'all' ? ' on' : ''}`} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Todos</button>
          <button type="button" className={`seg__btn${category === 'hardware_pc' ? ' on' : ''}`} aria-pressed={category === 'hardware_pc'} onClick={() => setCategory('hardware_pc')}>Hardware de PC</button>
          <button type="button" className={`seg__btn${category === 'audiovisual' ? ' on' : ''}`} aria-pressed={category === 'audiovisual'} onClick={() => setCategory('audiovisual')}>Audiovisuales</button>
        </div>}
        {dataLoading && !resources.length
          ? <div className="resource-grid" aria-busy="true">{[1, 2, 3, 4].map((i) => <div className="card resource-card skeleton" key={i}/>)}</div>
          : catalogResources.length
            ? <div className="grid resource-grid">{catalogResources.map((resource) => <ResourceCard key={resource.id} resource={resource} onReserve={() => navigate('new', resource.id)}/>)}</div>
            : !dataError && <EmptyState icon={page === 'panol' ? 'box' : 'monitor'} title="No hay recursos en esta categoría">Probá con otro filtro o actualizá el catálogo.</EmptyState>}
      </>}
      {(page === 'reservations' || page === 'mine') && <>
        <PageHead title={page === 'mine' ? 'Mis reservas' : 'Todas las reservas'} sub={page === 'mine' ? 'Seguí y administrá tus solicitudes.' : 'Supervisá solicitudes y actualizá sus estados.'}/>
        {dataLoading && !reservations.length ? <LoadingLine>Cargando reservas...</LoadingLine> : <ReservationsList reservations={visibleReservations} admin={admin} userId={session.user.id} busyId={busyId} onEdit={setEditing} onCancel={setCancelling} onStatus={(item, status) => void mutate(() => setReservationStatus(item.id, status), 'Estado actualizado.', item.id)}/>}
      </>}
      {page === 'reports' && <><PageHead title="Reportes de reservas" sub="Recursos más utilizados, categorías y horarios de mayor demanda."/><Reports report={report}/></>}
      {page === 'resources' && <><PageHead title="Recursos" sub="Agregá aulas y objetos nuevos, o sumá cantidad a los que ya existen."/><ResourcesAdmin resources={resources} reservations={reservations} busyId={busyId} onCreate={createResourceItem} onAddQuantity={addResourceQuantity}/></>}
      {page === 'new' && <>
        <PageHead title="Reservar recursos" sub="Indicá cuándo, y sumá todas las aulas y objetos que necesites para esa reserva."/>
        <FormCard step="01" title="Datos de la reserva" description="Podés agregar más de un recurso antes de confirmar.">
          <NewReservationForm resources={resources} preferredResourceId={preferredResourceId} busy={busyId === 'form'} onSubmit={submitReservationBatch}/>
        </FormCard>
      </>}
    </div>

    {editing && <div className="modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null) }}>
      <section className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="modal__head">
          <div><p className="card-kicker">Editar reserva</p><h2 className="modal__title" id="edit-title">{editing.resourceName}</h2></div>
          <button type="button" className="icon-btn" onClick={() => setEditing(null)} aria-label="Cerrar"><Icon name="close"/></button>
        </div>
        <ReservationForm resources={resources} initial={editing} busy={busyId === editing.id} onClose={() => setEditing(null)} onSubmit={(input) => void mutate(() => updateReservation(editing.id, input), 'Reserva actualizada.', editing.id)}/>
      </section>
    </div>}
    {cancelling && <div className="modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCancelling(null) }}>
      <section className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-msg">
        <h2 className="modal__title" id="cancel-title">Cancelar reserva</h2>
        <p className="modal__msg" id="cancel-msg">¿Querés cancelar esta reserva{cancelling.resourceName ? ` de ${cancelling.resourceName}` : ''}?</p>
        <div className="modal__actions">
          <button type="button" className="btn btn-ghost" onClick={() => setCancelling(null)} autoFocus>Volver</button>
          <button type="button" className="btn btn-danger" onClick={confirmCancel}>Cancelar reserva</button>
        </div>
      </section>
    </div>}
    {toast && <div className="toast-stack"><div className={`toast ${isError ? 'toast--error' : 'toast--success'}`} role="status"><Icon name={isError ? 'alert' : 'check'}/>{toast}</div></div>}
  </AppLayout>
}

export default App
