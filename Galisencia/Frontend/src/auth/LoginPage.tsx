import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { HOME } from "../components/layout/AppLayout";
import { validarLogin } from "../utils/validate";
import "./LoginPage.css";

const CSSVAR = (v: Record<string, string | number>) => v as CSSProperties;

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errores = validarLogin(email, password);
    if (errores.length > 0) {
      setError(errores[0]);
      return;
    }
    setError(null);
    try {
      const usuario = await login(email, password);
      navigate(HOME[usuario.rol]);
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
        <form className="login__form" onSubmit={onSubmit} noValidate>
          <h2 className="login__form-title">Iniciar sesión</h2>
          <p className="login__form-sub">Ingresá con tu email institucional.</p>

          <div className="field">
            <label htmlFor="email">Email institucional</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Ingresando…" : "Entrar"}
          </button>

          {error && <p className="login__error">{error}</p>}

          <p className="login__demo">
            Demo: <code>admin@galileo.edu.ar</code> · <code>preceptor@galileo.edu.ar</code>
          </p>
        </form>
      </main>
    </div>
  );
}