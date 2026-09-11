import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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

const IconBook = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);
const IconClipboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>
);
const IconChart = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
);
const IconSchool = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></svg>
);
const IconPeople = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const IconShield = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const IconBuilding = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="9" y1="22" x2="9" y2="18" /><line x1="15" y1="22" x2="15" y2="18" /><line x1="9" y1="10" x2="9" y2="6" /><line x1="15" y1="10" x2="15" y2="6" /></svg>
);

const NAV: Record<Rol, NavItem[]> = {
  alumno: [{ to: "/alumno", label: "Mi asistencia", icon: <IconBook /> }],
  preceptor: [
    { to: "/preceptor", label: "Registrar asistencia", icon: <IconClipboard /> },
    { to: "/reportes", label: "Reportes", icon: <IconChart /> },
  ],
  directivo: [
    { to: "/directivo", label: "Institucional", icon: <IconSchool /> },
    { to: "/reportes", label: "Reportes", icon: <IconChart /> },
  ],
  admin: [
    { to: "/admin", label: "Panel", icon: <IconChart /> },
    { to: "/gestion", label: "Gestión académica", icon: <IconPeople /> },
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

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// Color de avatar estable por nombre (hue derivado de un hash simple).
function avatarColor(nombre: string): { background: string; color: string } {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) {
    h = (h * 31 + nombre.charCodeAt(i)) % 360;
  }
  return {
    background: `hsl(${h} 62% 52%)`,
    color: `hsl(${h} 80% 14%)`,
  };
}

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  if (!usuario) return null;

  const items = NAV[usuario.rol];
  const puedeAbrirGaliservas = usuario.permisos.includes("galiservas.acceder") && usuario.sistemas.includes("Galiservas");

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app">
      <div
        className={`app__overlay ${drawer ? "show" : ""}`}
        onClick={() => setDrawer(false)}
      />
      <aside className={`app__sidebar ${drawer ? "open" : ""}`}>
        <div className="app__brand">
          <img className="app__brand-logo" src="/escudo-galisencia.png" alt="Escudo de Galisencia" />
          <div>
            <div className="app__brand-name">Galisencia</div>
            <div className="app__brand-sub">Galileo Galilei · Asistencia</div>
          </div>
        </div>

        <nav className="app__nav">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => setDrawer(false)}
              className={({ isActive }) => "app__nav-link" + (isActive ? " on" : "")}
            >
              <span className="app__nav-icon">{it.icon}</span>
              {it.label}
            </NavLink>
          ))}

          {puedeAbrirGaliservas && <>
            <div className="app__nav-section">Sistemas</div>
            <a
              className="app__nav-link"
              href={(import.meta as any).env?.VITE_GALISERVAS_URL ?? "http://localhost:5174"}
              target="_blank"
              rel="noreferrer"
              onClick={() => setDrawer(false)}
            >
              <span className="app__nav-icon"><IconBuilding /></span>
              Galiservas
            </a>
          </>}
        </nav>

        <div className="app__user">
          <div className="app__avatar" style={avatarColor(usuario.nombre)}>
            {iniciales(usuario.nombre)}
          </div>
          <div className="app__user-info">
            <div className="app__user-name">{usuario.nombre}</div>
            <div className="app__user-rol">{ROL_LABEL[usuario.rol]}</div>
          </div>
          <button className="app__logout" onClick={onLogout} title="Cerrar sesión">
            ⎋
          </button>
        </div>
      </aside>

      <div className="app__main">
        <header className="app__topbar">
          <div className="row" style={{ gap: 12 }}>
            <button
              className="app__menu-btn"
              onClick={() => setDrawer((d) => !d)}
              aria-label="Menú"
            >
              ☰
            </button>
            <div className="app__topbar-title">
              <span className="app__sso-pill" title="Login compartido con Galiservas">
                SSO · SESIÓN COMPARTIDA
              </span>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <span className="muted text-sm app__email">{usuario.email}</span>
            <button
              className="app__theme-btn"
              onClick={toggle}
              title="Cambiar tema"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        <main className="app__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { HOME };
