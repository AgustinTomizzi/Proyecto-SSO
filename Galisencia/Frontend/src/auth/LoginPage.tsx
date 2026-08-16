import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Rol } from "../data/types";
import { ROL_LABEL } from "../data/types";
import "./LoginPage.css";

const ROLES: { rol: Rol; icono: string; desc: string }[] = [
  { rol: "alumno", icono: "🎓", desc: "Consultá tu asistencia" },
  { rol: "preceptor", icono: "📋", desc: "Registrá tu curso" },
  { rol: "directivo", icono: "📊", desc: "Seguimiento institucional" },
  { rol: "admin", icono: "⚙️", desc: "Gestión académica" },
];

const HOME: Record<Rol, string> = {
  alumno: "/alumno",
  preceptor: "/preceptor",
  directivo: "/directivo",
  admin: "/admin",
};

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [rol, setRol] = useState<Rol>("alumno");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(email, password, rol);
    navigate(HOME[rol]);
  }

  return (
    <div className="login">
      <aside className="login__brand">
        <div className="login__logo">G</div>
        <h1 className="login__title">Galisencia</h1>
        <p className="login__tag">Sistema de Asistencia Escolar</p>
        <ul className="login__features">
          <li>✓ Seguimiento de asistencia en tiempo real</li>
          <li>✓ Alertas de alumnos en riesgo</li>
          <li>✓ Acceso único para toda la institución</li>
        </ul>
        <p className="login__sso">
          🔐 <strong>SSO</strong> — un solo inicio de sesión para Galisencia y
          Galiservas.
        </p>
      </aside>

      <main className="login__panel">
        <form className="login__form" onSubmit={onSubmit}>
          <h2 className="login__form-title">Iniciar sesión</h2>
          <p className="login__form-sub">Elegí tu rol y continuá.</p>

          <div className="rol-grid">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.rol}
                className={`rol-card ${rol === r.rol ? "on" : ""}`}
                onClick={() => setRol(r.rol)}
              >
                <span className="rol-card__icon">{r.icono}</span>
                <span className="rol-card__label">{ROL_LABEL[r.rol]}</span>
                <span className="rol-card__desc">{r.desc}</span>
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="email">Email institucional</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="demo@galileo.edu.ar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Ingresando…" : "Entrar"}
          </button>

          <p className="login__hint">
            Demo: podés ingresar con cualquier email/contraseña. Si el servidor
            del colegio está conectado, valida contra la base de datos real.
          </p>
        </form>
      </main>
    </div>
  );
}
