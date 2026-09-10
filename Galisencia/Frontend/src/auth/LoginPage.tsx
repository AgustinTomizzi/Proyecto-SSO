import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Rol } from "../data/types";
import { ROL_LABEL } from "../data/types";
import "./LoginPage.css";

const CSSVAR = (v: Record<string, string | number>) => v as CSSProperties;

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
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("El email institucional es obligatorio.");
      return;
    }
    setError(null);
    try {
      await login(email, password, rol);
      navigate(HOME[rol]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    }
  }

  return (
    <div className="login">
      <aside className="login__brand">
        <img className="login__logo" src="/galisencia.png" alt="Galisencia" />
        <h1 className="login__title">Galisencia</h1>
        <p className="login__tag">Sistema de Asistencia Escolar</p>
        <ul className="login__features">
          <li style={CSSVAR({ '--i': 0 })}>✓ Seguimiento de asistencia en tiempo real</li>
          <li style={CSSVAR({ '--i': 1 })}>✓ Alertas de alumnos en riesgo</li>
          <li style={CSSVAR({ '--i': 2 })}>✓ Acceso único para toda la institución</li>
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
            {ROLES.map((r, i) => (
              <button
                type="button"
                key={r.rol}
                style={CSSVAR({ '--i': i })}
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
              required
              placeholder=" "
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Ingresando…" : "Entrar"}
          </button>

          {error && <p className="login__error">{error}</p>}
        </form>
      </main>
    </div>
  );
}
