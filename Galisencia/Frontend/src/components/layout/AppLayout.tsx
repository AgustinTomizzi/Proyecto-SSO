import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import type { Rol } from "../../data/types";
import { ROL_LABEL } from "../../data/types";
import "./AppLayout.css";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV: Record<Rol, NavItem[]> = {
  alumno: [{ to: "/alumno", label: "Mi asistencia", icon: "🎓" }],
  preceptor: [
    { to: "/preceptor", label: "Registrar asistencia", icon: "📋" },
    { to: "/reportes", label: "Reportes", icon: "📊" },
  ],
  directivo: [
    { to: "/directivo", label: "Institucional", icon: "🏫" },
    { to: "/reportes", label: "Reportes", icon: "📊" },
  ],
  admin: [
    { to: "/admin", label: "Panel", icon: "📈" },
    { to: "/gestion", label: "Gestión académica", icon: "👥" },
    { to: "/reportes", label: "Reportes", icon: "📊" },
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
  const { usuario, logout, modo } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  if (!usuario) return null;

  const items = NAV[usuario.rol];

  function onLogout() {
    logout();
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
          <div className="app__brand-logo">G</div>
          <div>
            <div className="app__brand-name">Galisencia</div>
            <div className="app__brand-sub">Asistencia Escolar</div>
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
                🔐 SSO
              </span>
              {modo === "mock" && (
                <span className="badge badge-warning">demo · datos de prueba</span>
              )}
              {modo === "backend" && (
                <span className="badge badge-success">conectado a la base</span>
              )}
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
