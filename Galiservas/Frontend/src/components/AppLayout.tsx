import { useState, type ReactNode } from 'react'
import type { Theme } from '../theme'
import type { Page, Session } from '../types'
import { GALISENCIA_URL } from '../utils'
import { Icon, type IconName } from './Icon'

// Estructura de la aplicación (sidebar + topbar) copiada del AppLayout de
// Galisencia para que ambos sistemas se sientan como un único producto.

export type NavItem = { id: Page, label: string, icon: IconName }

const SIDEBAR_KEY = 'galiservas.sidebar-collapsed'

function readCollapsed() {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
}

function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

export function AppLayout({ session, nav, page, onNavigate, theme, onToggleTheme, onLogout, loggingOut, banner, children }: {
  session: Session, nav: NavItem[], page: Page, onNavigate: (page: Page) => void, theme: Theme, onToggleTheme: () => void,
  onLogout: () => void, loggingOut: boolean, banner?: ReactNode, children: ReactNode,
}) {
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const activeItem = nav.find((item) => item.id === page) ?? nav[0]
  const initials = iniciales(session.user.name)
  const dark = theme === 'dark'

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* almacenamiento no disponible */ }
  }
  const go = (next: Page) => { setDrawer(false); onNavigate(next) }

  return (
    <div className={`app gdash${dark ? ' gdash--dark' : ''}${collapsed ? ' app--collapsed' : ''}`}>
      <button type="button" className={`app__overlay${drawer ? ' show' : ''}`} onClick={() => setDrawer(false)} aria-label="Cerrar menú" tabIndex={drawer ? 0 : -1} />

      <aside className={`app__sidebar${drawer ? ' open' : ''}`}>
        <div className="app__sidebar-accent" />
        <div className="app__brand">
          {!collapsed && <img className="app__brand-logo" src="/logo-galiservas-sinfondo.png" alt="Escudo de Galiservas" />}
          {!collapsed && <div className="app__brand-copy"><div className="app__brand-name">Galiservas</div><div className="app__brand-sub">Sistema de Reservas</div></div>}
          <button type="button" className="app__collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed}>
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} />
          </button>
          <button type="button" className="app__drawer-close" onClick={() => setDrawer(false)} aria-label="Cerrar menú"><Icon name="close" size={18} /></button>
        </div>

        {!collapsed && <div className="app__nav-label">Navegación</div>}
        <nav className="app__nav" aria-label="Navegación principal">
          {nav.map((item) => (
            <button type="button" key={item.id} title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined} aria-current={page === item.id ? 'page' : undefined}
              className={`app__nav-link${page === item.id ? ' on' : ''}`} onClick={() => go(item.id)}>
              <span className="app__nav-icon"><Icon name={item.icon} size={18} /></span>{!collapsed && <span>{item.label}</span>}
            </button>
          ))}
          {!collapsed && <div className="app__nav-section">Sistemas</div>}
          <a className={`app__nav-link${collapsed ? ' app__nav-link--first-system' : ''}`} href={GALISENCIA_URL} title={collapsed ? 'Galisencia' : undefined} aria-label={collapsed ? 'Volver a Galisencia' : undefined}>
            <span className="app__nav-icon"><Icon name="school" size={18} /></span>{!collapsed && <span>Galisencia</span>}
          </a>
        </nav>

        <div className="app__profile">
          <div className="app__user">
            <span className="app__avatar" aria-hidden="true"><span>{initials}</span></span>
            {!collapsed && <span className="app__user-info"><strong>{session.user.name}</strong><small>{session.user.email}</small><small className="app__user-role">{session.user.role}</small></span>}
            <button type="button" className="app__logout" onClick={onLogout} disabled={loggingOut} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="logout" size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="app__main">
        <header className="app__topbar">
          <button type="button" className="app__menu-btn" onClick={() => setDrawer(true)} aria-label="Abrir menú" aria-expanded={drawer}><Icon name="menu" size={19} /></button>
          <div className="app__topbar-brand"><img src="/logo-galiservas-sinfondo.png" alt="" /><span><strong>Galiservas</strong><small>E.E.S.T. N.º 5</small></span></div>
          <div className="app__topbar-separator" />
          <div className="app__breadcrumb"><span>Sistema</span><Icon name="chevron-right" size={12} /><strong aria-current="page">{activeItem.label}</strong></div>
          <div className="app__topbar-actions">
            {page !== 'new' && (
              <button type="button" className="btn btn-primary btn-sm app__new-btn" onClick={() => go('new')} aria-label="Nueva reserva">
                <Icon name="plus" size={16} /><span>Nueva reserva</span>
              </button>
            )}
            <button type="button" className="app__action-btn" onClick={onToggleTheme} title={dark ? 'Modo claro' : 'Modo oscuro'} aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}>
              <Icon name={dark ? 'sun' : 'moon'} size={16} />
            </button>
            <button type="button" className="app__action-btn app__notification" title="Notificaciones" aria-label="Notificaciones"><Icon name="bell" size={16} /><span /></button>
            <div className="app__user-pill"><span className="app__avatar app__avatar--small" aria-hidden="true"><span>{initials}</span></span><span>{session.user.email}</span></div>
          </div>
        </header>
        {banner}
        <main className="app__content">{children}</main>
      </div>
    </div>
  )
}
