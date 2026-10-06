import type { ReactNode } from 'react'
import { CircuitPattern, LoginFooter } from './LoginPage'

// Pantallas de estado previas al ingreso (carga, sin conexión, acceso
// restringido, contraseña inicial) sobre el mismo fondo que el login.

export function SplashScreen() {
  return (
    <div className="login status-screen">
      <CircuitPattern />
      <main className="status-screen__splash" aria-busy="true">
        <img className="status-screen__splash-logo" src={`${import.meta.env.BASE_URL}logo-galiservas-sinfondo.png`} alt="Logotipo de Galiservas" />
        <span className="login__spinner status-screen__spinner" />
        <p role="status">Conectando con Galileo Auth</p>
      </main>
    </div>
  )
}

export function StatusScreen({ kicker, title, tone = 'warning', children, actions }: {
  kicker: string, title: string, tone?: 'warning' | 'danger', children: ReactNode, actions: ReactNode,
}) {
  return (
    <div className="login status-screen">
      <CircuitPattern />
      <main className="login__panel">
        <div className="login__card status-screen__card">
          <div className="login__card-accent" />
          <div className="status-screen__head">
            <img className="status-screen__logo" src={`${import.meta.env.BASE_URL}logo-galiservas-sinfondo.png`} alt="Logotipo de Galiservas" />
            <span className={`status-screen__mark status-screen__mark--${tone}`} aria-hidden="true">!</span>
          </div>
          <div className="login__card-header">
            <p className="login__kicker">{kicker}</p>
            <h1 className="login__card-title">{title}</h1>
            <div className="login__card-sub">{children}</div>
          </div>
          <div className="status-screen__actions">{actions}</div>
        </div>
        <LoginFooter />
      </main>
    </div>
  )
}
