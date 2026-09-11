import { useEffect, useEffectEvent, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError, cancelReservation, createReservation, getReservationReport, getReservations, getResources, login,
  logout, restoreSession, setReservationStatus, updateReservation,
} from './api'
import type { Page, Reservation, ReservationInput, ReservationReport, Resource, Session } from './types'
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

type IconName = 'grid' | 'calendar' | 'user' | 'plus' | 'logout' | 'monitor' | 'box' | 'clock' | 'menu' | 'close' | 'laptop' | 'camera' | 'mic' | 'speaker' | 'cable'

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
  const [form, setForm] = useState<ReservationInput>(initial ? {
    resourceId: initial.resourceId, date: initial.date, start: initial.start, end: initial.end,
    quantity: initial.quantity, reason: initial.reason,
  } : { ...emptyForm, resourceId: preferredResourceId || resources[0]?.id || '' })
  const [error, setError] = useState('')
  const selected = resources.find((resource) => resource.id === form.resourceId)
  const [slotAvailable, setSlotAvailable] = useState<number | null>(selected?.available ?? null)
  const checkingAvailability = slotAvailable === null && Boolean(form.resourceId && form.date && form.start && form.end && form.start < form.end)
  const change = (key: keyof ReservationInput, value: string | number) => {
    if (['resourceId', 'date', 'start', 'end'].includes(key)) {
      setSlotAvailable(null)
    }
    setForm((current) => ({ ...current, [key]: value }))
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
    if (form.quantity < 1 || form.quantity > maximum) return setError(`La cantidad debe estar entre 1 y ${maximum} para esa franja.`)
    if (form.reason.trim().length < 5) return setError('Explicá el motivo de la reserva (mínimo 5 caracteres).')
    setError(''); onSubmit({ ...form, reason: form.reason.trim() })
  }
  return <form className="reservation-form" onSubmit={submit} noValidate>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="field-grid">
      <label className="span-2">Recurso<select value={form.resourceId} onChange={(e) => change('resourceId', e.target.value)} disabled={busy}>
        <option value="">Seleccionar recurso</option>{resources.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.capacity} equipos</option>)}
      </select></label>
      <label>Fecha<input type="date" min={today} value={form.date} onChange={(e) => change('date', e.target.value)} disabled={busy}/></label>
      <label>Cantidad<input type="number" min="1" max={slotAvailable ?? selected?.capacity ?? 1} value={form.quantity} onChange={(e) => change('quantity', Number(e.target.value))} disabled={busy || checkingAvailability}/><small>{checkingAvailability ? 'Consultando disponibilidad...' : `Disponibles en esa franja: ${slotAvailable ?? selected?.capacity ?? 0}`}</small></label>
      <label>Hora de inicio<input type="time" value={form.start} onChange={(e) => change('start', e.target.value)} disabled={busy}/></label>
      <label>Hora de fin<input type="time" value={form.end} onChange={(e) => change('end', e.target.value)} disabled={busy}/></label>
      <label className="span-2">Motivo<textarea rows={4} maxLength={300} value={form.reason} onChange={(e) => change('reason', e.target.value)} placeholder="Ej.: Práctica de programación de 4° año" disabled={busy}/><small>{form.reason.length}/300</small></label>
    </div>
    <div className="form-actions">{onClose && <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>}<button className="button primary" disabled={busy}>{busy ? 'Guardando...' : initial ? 'Guardar cambios' : 'Confirmar reserva'}</button></div>
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

function ReservationsList({ reservations, admin, userId, busyId, onEdit, onCancel, onStatus }: {
  reservations: Reservation[], admin: boolean, userId: string, busyId: string, onEdit: (r: Reservation) => void,
  onCancel: (r: Reservation) => void, onStatus: (r: Reservation, status: string) => void,
}) {
  const groups = reservations.reduce<Record<string, Reservation[]>>((all, item) => ((all[item.date || 'Sin fecha'] ??= []).push(item), all), {})
  if (!reservations.length) return <div className="empty"><div className="empty-icon"><Icon name="calendar"/></div><h3>No hay reservas para mostrar</h3><p>Las reservas nuevas aparecerán organizadas por día.</p></div>
  return <div className="day-groups">{Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => <section className="day-group" key={date}>
    <header><time dateTime={date}>{formatDate(date)}</time><span>{items.length} {items.length === 1 ? 'reserva' : 'reservas'}</span></header>
    <div className="reservation-list">{items.sort((a, b) => a.start.localeCompare(b.start)).map((item) => {
      const own = !item.userId || item.userId === userId
      return <article className="reservation-row" key={item.id}>
        <div className="time-block"><b>{item.start}</b><span>{item.end}</span></div>
        <div className="reservation-info"><div><h3>{item.resourceName || `Recurso #${item.resourceId}`}</h3><span className={`badge status-${normalize(item.status)}`}>{item.status}</span></div><p>{item.reason || 'Sin motivo especificado'}</p><small>{item.quantity} {item.quantity === 1 ? 'equipo' : 'equipos'}{admin && item.userName ? ` · ${item.userName}` : ''}</small></div>
        {(admin || own) && canChange(item) && <div className="row-actions">
          {own && <button className="button mini ghost" onClick={() => onEdit(item)} disabled={busyId === item.id}>Editar</button>}
          {admin && normalize(item.status) !== 'finalizada' && <button className="button mini ghost" onClick={() => onStatus(item, 'finalizada')} disabled={busyId === item.id}>Finalizar</button>}
          {(own || admin) && <button className="button mini danger" onClick={() => onCancel(item)} disabled={busyId === item.id}>Cancelar</button>}
        </div>}
      </article>
    })}</div>
  </section>)}</div>
}

function Reports({ report }: { report: ReservationReport | null }) {
  if (!report) return <div className="loading-line"><span className="spinner dark"/>Cargando reportes...</div>
  const categoryName = (category: Resource['category']) => category === 'audiovisual' ? 'Recursos audiovisuales' : 'Hardware de PC'
  return <div className="reports-grid">
    <section className="report-card"><p className="eyebrow">POR CATEGORÍA</p><h2>Uso del inventario</h2>{report.byCategory.map((item) => <div className="report-row" key={item.category}><span>{categoryName(item.category)}</span><b>{item.units} unidades</b><small>{item.reservations} reservas</small></div>)}</section>
    <section className="report-card"><p className="eyebrow">MÁS UTILIZADOS</p><h2>Recursos</h2>{report.byResource.map((item) => <div className="report-row" key={item.resourceId}><span>{item.resourceName}</span><b>{item.units} unidades</b><small>{item.reservations} reservas</small></div>)}</section>
    <section className="report-card"><p className="eyebrow">HORARIOS</p><h2>Franjas más solicitadas</h2>{report.byHour.map((item) => <div className="report-row" key={item.hour}><span>{String(item.hour).padStart(2, '0')}:00</span><b>{item.reservations} reservas</b><small>{item.units} unidades</small></div>)}</section>
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

  const navigate = (next: Page, resourceId = '') => { setPage(next); setMenu(false); setEditing(null); setPreferredResourceId(next === 'new' ? resourceId : '') }
  const mutate = async (action: () => Promise<unknown>, success: string, id = 'form') => {
    setBusyId(id)
    try { await action(); setToast(success); setEditing(null); await loadData(); return true }
    catch (error) { setToast(`Error: ${messageOf(error)}`); return false }
    finally { setBusyId('') }
  }
  const submitReservation = async (input: ReservationInput) => {
    const success = await mutate(() => createReservation(input), 'Reserva creada correctamente.')
    if (success) navigate('mine')
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
    { id: 'aulas', label: 'Aulas 208 / 209 / 210', icon: 'monitor' },
    { id: 'panol', label: 'Pañol', icon: 'box' },
    ...(admin ? [{ id: 'reservations' as Page, label: 'Reservas', icon: 'calendar' as const }] : []),
    ...(admin ? [{ id: 'reports' as Page, label: 'Reportes', icon: 'clock' as const }] : []),
    { id: 'mine', label: 'Mis reservas', icon: 'user' }, { id: 'new', label: 'Nueva reserva', icon: 'plus' },
  ]
  const visibleReservations = page === 'mine' ? reservations.filter((item) => !item.userId || item.userId === session.user.id) : reservations
  const catalogResources = (page === 'aulas' ? resources.filter((item) => item.location !== 'Pañol') : page === 'panol' ? resources.filter((item) => item.location === 'Pañol') : resources)
    .filter((item) => category === 'all' || item.category === category)

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
          {page !== 'dashboard' && <section className="page-title"><div><p className="eyebrow">{page === 'aulas' ? 'LABORATORIOS' : 'INVENTARIO MÓVIL'}</p><h1>{page === 'aulas' ? 'Aulas 208, 209 y 210' : 'Pañol'}</h1><p>{page === 'aulas' ? 'Reservá una cantidad de computadoras para una fecha y horario.' : 'Reservá notebooks, hardware y recursos audiovisuales.'}</p></div></section>}
          <div className="section-heading"><div><p className="eyebrow">CATÁLOGO</p><h2>{page === 'aulas' ? 'Computadoras por aula' : page === 'panol' ? 'Equipos del Pañol' : 'Espacios y equipos'}</h2></div><button className="refresh" onClick={() => void loadData()} disabled={dataLoading}>{dataLoading ? 'Actualizando...' : 'Actualizar'}</button></div>
          {page !== 'aulas' && <div className="category-filters" role="group" aria-label="Filtrar recursos por categoría"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Todos</button><button className={category === 'hardware_pc' ? 'active' : ''} onClick={() => setCategory('hardware_pc')}>Hardware de PC</button><button className={category === 'audiovisual' ? 'active' : ''} onClick={() => setCategory('audiovisual')}>Audiovisuales</button></div>}
          {dataLoading && !resources.length ? <div className="resource-grid">{[1,2,3,4].map((i) => <div className="resource-card skeleton" key={i}/>)}</div> : catalogResources.length ? <div className="resource-grid">{catalogResources.map((resource) => <ResourceCard key={resource.id} resource={resource} onReserve={() => navigate('new', resource.id)}/>)}</div> : !dataError && <div className="empty"><div className="empty-icon"><Icon name={page === 'panol' ? 'box' : 'monitor'}/></div><h3>No hay recursos en esta categoría</h3><p>Probá con otro filtro o actualizá el catálogo.</p></div>}
        </>}
        {(page === 'reservations' || page === 'mine') && <>
          <section className="page-title"><div><p className="eyebrow">{page === 'mine' ? 'ACTIVIDAD PERSONAL' : 'ADMINISTRACIÓN'}</p><h1>{page === 'mine' ? 'Mis reservas' : 'Todas las reservas'}</h1><p>{page === 'mine' ? 'Seguí y administrá tus solicitudes.' : 'Supervisá solicitudes y actualizá sus estados.'}</p></div></section>
          {dataLoading && !reservations.length ? <div className="loading-line"><span className="spinner dark"/>Cargando reservas...</div> : <ReservationsList reservations={visibleReservations} admin={admin} userId={session.user.id} busyId={busyId} onEdit={setEditing} onCancel={(item) => { if (window.confirm('¿Querés cancelar esta reserva?')) void mutate(() => cancelReservation(item.id), 'Reserva cancelada.', item.id) }} onStatus={(item, status) => void mutate(() => setReservationStatus(item.id, status), 'Estado actualizado.', item.id)}/>} 
        </>}
        {page === 'reports' && <><section className="page-title"><div><p className="eyebrow">ANÁLISIS DE USO</p><h1>Reportes de reservas</h1><p>Recursos más utilizados, categorías y horarios de mayor demanda.</p></div></section><Reports report={report}/></>}
        {page === 'new' && <><section className="page-title"><div><p className="eyebrow">NUEVA SOLICITUD</p><h1>Reservar un recurso</h1><p>Indicá cuándo y qué equipamiento necesitás.</p></div></section><section className="form-card"><div className="form-card-head"><div className="step-number">01</div><div><h2>Datos de la reserva</h2><p>Todos los campos son obligatorios.</p></div></div><ReservationForm resources={resources} preferredResourceId={preferredResourceId} busy={busyId === 'form'} onSubmit={(input) => void submitReservation(input)}/></section></>}
      </div>
    </main>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="modal-head"><div><p className="eyebrow">EDITAR RESERVA</p><h2 id="edit-title">{editing.resourceName}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Cerrar"><Icon name="close"/></button></div><ReservationForm resources={resources} initial={editing} busy={busyId === editing.id} onClose={() => setEditing(null)} onSubmit={(input) => void mutate(() => updateReservation(editing.id, input), 'Reserva actualizada.', editing.id)}/></section></div>}
    {toast && <div className={`toast ${toast.startsWith('Error') || toast.startsWith('No se') ? 'toast-error' : ''}`} role="status">{toast}</div>}
  </div>
}

export default App
