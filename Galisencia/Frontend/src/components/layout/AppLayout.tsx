import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import type { Rol } from "../../data/types";
import { ROL_LABEL } from "../../data/types";
import "./AppLayout.css";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const IconBook = () => <svg {...iconProps}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const IconClipboard = () => <svg {...iconProps}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/></svg>;
const IconChart = () => <svg {...iconProps}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>;
const IconSchool = () => <svg {...iconProps}><path d="m3 10 9-6 9 6"/><path d="M5 9v10h14V9M9 19v-6h6v6"/></svg>;
const IconPeople = () => <svg {...iconProps}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconShield = () => <svg {...iconProps}><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10"/></svg>;
const IconBuilding = () => <svg {...iconProps}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M9 10V6M15 10V6"/></svg>;
const IconCalendar = () => <svg {...iconProps}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;

const NAV: Record<Rol, NavItem[]> = {
  alumno: [
    { to: "/alumno", label: "Mi asistencia", icon: <IconBook /> },
    { to: "/horarios", label: "Mi horario", icon: <IconCalendar /> },
  ],
  preceptor: [
    { to: "/preceptor", label: "Registrar asistencia", icon: <IconClipboard /> },
    { to: "/reportes", label: "Reportes", icon: <IconChart /> },
  ],
  directivo: [
    { to: "/directivo", label: "Panel institucional", icon: <IconSchool /> },
    { to: "/reportes", label: "Reportes", icon: <IconChart /> },
  ],
  admin: [
    { to: "/admin", label: "Panel", icon: <IconChart /> },
    { to: "/gestion", label: "Gestión académica", icon: <IconPeople /> },
    { to: "/admin/horarios", label: "Horarios", icon: <IconCalendar /> },
    { to: "/reportes", label: "Reportes", icon: <IconChart /> },
    { to: "/auditoria", label: "Auditoría", icon: <IconShield /> },
    { to: "/usuarios", label: "Usuarios", icon: <IconPeople /> },
  ],
};

const HOME: Record<Rol, string> = {
  alumno: "/alumno",
  preceptor: "/preceptor",
  directivo: "/directivo",
  admin: "/admin",
};

const SIDEBAR_KEY = "galisencia.sidebar-collapsed";

function iniciales(nombre: string) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();
}

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "true");

  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);

  if (!usuario) return null;

  const galiservasUrl = (import.meta as any).env?.VITE_GALISERVAS_URL ?? "http://localhost:5174";
  const items = NAV[usuario.rol];
  const activeItem = items.find((item) => item.to === location.pathname) ?? items[0];
  const puedeAbrirGaliservas = usuario.permisos.includes("galiservas.acceder") && usuario.sistemas.includes("Galiservas");
  const initials = iniciales(usuario.nombre);

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem(SIDEBAR_KEY, String(!current));
      return !current;
    });
  }

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className={`app gdash${theme === "dark" ? " gdash--dark" : ""}${collapsed ? " app--collapsed" : ""}`}>
      <button className={`app__overlay${drawer ? " show" : ""}`} onClick={() => setDrawer(false)} aria-label="Cerrar menú" />

      <aside className={`app__sidebar${drawer ? " open" : ""}`}>
        <div className="app__sidebar-accent" />
        <div className="app__brand">
          {!collapsed && <img className="app__brand-logo" src="/logogalisenciasinfondo.png" alt="Escudo de Galisencia" />}
          {!collapsed && <div className="app__brand-copy"><div className="app__brand-name">Galisencias</div><div className="app__brand-sub">Sistema Educativo</div></div>}
          <button className="app__collapse" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={collapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
          </button>
          <button className="app__drawer-close" onClick={() => setDrawer(false)} aria-label="Cerrar menú"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        </div>

        {!collapsed && <div className="app__nav-label">Navegación</div>}
        <nav className="app__nav" aria-label="Navegación principal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined} className={({ isActive }) => `app__nav-link${isActive ? " on" : ""}`}>
              <span className="app__nav-icon">{item.icon}</span>{!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          {puedeAbrirGaliservas && (
            <>
              {!collapsed && <div className="app__nav-section">Sistemas</div>}
              <a className="app__nav-link" href={galiservasUrl} target="_blank" rel="noreferrer" title={collapsed ? "Galiservas" : undefined}>
                <span className="app__nav-icon"><IconBuilding /></span>{!collapsed && <span>Galiservas</span>}
              </a>
            </>
          )}
        </nav>

        <div className="app__profile">
          <div className="app__user">
            <span className="app__avatar"><span>{initials}</span>{usuario.avatarUrl && <img src={usuario.avatarUrl} alt={`Foto de ${usuario.nombre}`} />}</span>
            {!collapsed && <><span className="app__user-info"><strong>{usuario.nombre}</strong><small>{usuario.email}</small><small>{ROL_LABEL[usuario.rol]}</small></span><button className="app__logout" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg></button></>}
          </div>
        </div>
      </aside>

      <div className="app__main">
        <header className="app__topbar">
          <button className="app__menu-btn" onClick={() => setDrawer(true)} aria-label="Abrir menú"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
          <div className="app__topbar-brand"><img src="/logogalisenciasinfondo.png" alt=""/><span><strong>Galisencias</strong><small>E.E.S.T. N.º 5</small></span></div>
          <div className="app__topbar-separator" />
          <div className="app__breadcrumb"><span>Sistema</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg><strong>{activeItem.label}</strong></div>
          <div className="app__topbar-actions">
            <button className="app__action-btn" onClick={toggle} title={theme === "dark" ? "Modo claro" : "Modo oscuro"} aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}>
              {theme === "dark" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
            </button>
            <button className="app__action-btn app__notification" title="Notificaciones" aria-label="Notificaciones"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg><span /></button>
            <div className="app__user-pill"><span className="app__avatar app__avatar--small"><span>{initials}</span>{usuario.avatarUrl && <img src={usuario.avatarUrl} alt="" />}</span><span>{usuario.email}</span></div>
          </div>
        </header>
        <main className="app__content"><Outlet /></main>
      </div>
    </div>
  );
}

export { HOME };
