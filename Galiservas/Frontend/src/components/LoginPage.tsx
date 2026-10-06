import { useState, type FormEvent } from 'react'
import { login } from '../api'
import type { Session } from '../types'
import { canAccessGaliservas, GALISENCIA_URL, messageOf } from '../utils'
import { Icon } from './Icon'

// Pantalla de ingreso con el mismo diseño que Galisencia (panel institucional
// + tarjeta de acceso), conservando la validación y el control de acceso de Galiservas.

const LOGO = `${import.meta.env.BASE_URL}logo-galiservas-sinfondo.png`
const LOGO_ALT = 'Escudo de Galiservas — E.E.S.T. N.º 5 Galileo Galilei'
const PILLS = ['Aulas', 'Pañol', 'Reservas']

export function CircuitPattern() {
  return (
    <svg className="login__circuit" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M0 40 H20 M60 40 H80 M40 0 V20 M40 60 V80" stroke="white" strokeWidth="0.5" opacity="0.12" fill="none" />
          <circle cx="20" cy="40" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <circle cx="60" cy="40" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <circle cx="40" cy="20" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <circle cx="40" cy="60" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <path d="M20 40 L30 30 L50 30 L60 40" stroke="white" strokeWidth="0.4" fill="none" opacity="0.1" />
          <path d="M20 40 L30 50 L50 50 L60 40" stroke="white" strokeWidth="0.4" fill="none" opacity="0.1" />
          <rect x="29" y="29" width="22" height="22" fill="none" stroke="white" strokeWidth="0.3" opacity="0.08" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit)" />
    </svg>
  )
}

function CodeLines() {
  const lines = [
    'const reserva = new Sistema();',
    'if (aula.disponible) { reservar(); }',
    '// E.E.S.T. N°5 — 2026',
    'function reservar(recurso, franja) {',
    '  return panol.verificar(recurso);',
    '}',
    "<Galileo version='2026' />",
    '01001000 01101001',
    'SELECT * FROM reservas',
    "import { Recursos } from 'galiservas';",
  ]
  return (
    <div className="login__coderows" aria-hidden="true">
      {lines.map((line, i) => (
        <div key={i} className="login__coderow" style={{ top: `${8 + i * 9.2}%`, left: i % 2 === 0 ? '-2%' : '5%', transform: `rotate(${i % 2 === 0 ? '-4deg' : '0deg'})` }}>
          {line}
        </div>
      ))}
    </div>
  )
}

function SunGlow() {
  return <div className="login__sunglow" aria-hidden="true" style={{ bottom: '5%', right: '-10%', width: '380px', height: '380px', background: 'radial-gradient(circle, rgba(255,201,60,0.08) 0%, rgba(255,201,60,0.03) 40%, transparent 70%)', borderRadius: '50%' }} />
}

export function LoginFooter() {
  return (
    <div className="login__footer">
      <span className="login__footer-brand">GALISERVAS</span>
      <span>·</span>
      <span>Sistema de Reservas</span>
      <span>·</span>
      <span>2026</span>
    </div>
  )
}

export function LoginPage({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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

  return (
    <div className="login">
      <aside className="login__brand" aria-label="Identidad institucional">
        <CircuitPattern />
        <CodeLines />
        <SunGlow />
        <div className="login__accent-top" />

        <div className="login__mobile-brand">
          <img className="login__school-logo mobile" src={LOGO} alt={LOGO_ALT} />
          <div className="login__mobile-info">
            <div className="login__school-title mobile">E.E.S.T N°5 Galileo Galilei</div>
            <div className="login__school-sub mobile">Provincia de Buenos Aires</div>
            <div className="login__pills mobile">{PILLS.map((pill) => <span key={pill} className="login__pill">{pill}</span>)}</div>
          </div>
        </div>

        <div className="login__accent-bottom" />
        <div className="login__brand-inner">
          <img className="login__school-logo" src={LOGO} alt={LOGO_ALT} />
          <div className="login__divider" aria-hidden="true">
            <span className="login__divider-line" />
            <span className="login__divider-dot" />
            <span className="login__divider-line" />
          </div>
          <div className="login__school-heading">
            <div className="login__school-title">E.E.S.T N°5 Galileo Galilei</div>
            <div className="login__school-sub">Provincia de Buenos Aires</div>
          </div>
          <div className="login__pills">{PILLS.map((pill) => <span key={pill} className="login__pill">{pill}</span>)}</div>
        </div>
      </aside>

      <main className="login__panel">
        <div className="login__panel-glow" />
        <div className="login__card">
          <div className="login__card-accent" />

          <div className="login__card-header">
            <p className="login__kicker">Galiservas · Sistema de Reservas</p>
            <h1 className="login__card-title">Iniciar sesión</h1>
            <p className="login__card-sub">Usá las credenciales de tu cuenta Galileo.</p>
          </div>

          {error && (
            <div className="login__error" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          <form className="login__form" onSubmit={(event) => void submit(event)} noValidate>
            <div className="login__field">
              <label className="login__label" htmlFor="login-email">Correo institucional</label>
              <div className="login__input-wrap">
                <span className="login__icon"><Icon name="user" size={17} /></span>
                <input id="login-email" type="email" className="login__input" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} placeholder="nombre@galileo.edu.ar" autoComplete="email" disabled={busy} />
              </div>
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="login-password">Contraseña</label>
              <div className="login__input-wrap">
                <span className="login__icon"><Icon name="lock" size={17} /></span>
                <input id="login-password" type={showPassword ? 'text' : 'password'} className="login__input login__input--pw" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} placeholder="Tu contraseña" autoComplete="current-password" disabled={busy} />
                <button type="button" className="login__toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}>
                  <Icon name={showPassword ? 'eye' : 'eye-off'} size={18} />
                </button>
              </div>
            </div>

            <button type="submit" className="login__submit" disabled={busy}>
              {busy ? <><span className="login__spinner" />Ingresando...</> : <>Ingresar al sistema <Icon name="arrow-right" size={16} /></>}
            </button>
          </form>

          <div className="login__or">
            <div className="login__or-line" />
            <span className="login__or-text">o también</span>
            <div className="login__or-line" />
          </div>

          <a className="login__sso" href={GALISENCIA_URL}>
            <Icon name="school" size={16} />
            Volver a Galisencia
          </a>

          <p className="login__demo"><span className="login__status-dot" /> Acceso protegido por Galileo Auth</p>
        </div>

        <LoginFooter />
      </main>
    </div>
  )
}
