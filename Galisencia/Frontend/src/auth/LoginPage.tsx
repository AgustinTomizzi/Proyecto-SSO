import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

const HOME = {
  alumno: "/alumno",
  preceptor: "/preceptor",
  directivo: "/directivo",
  admin: "/admin",
} as const;

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Ingresá el correo institucional y la contraseña.");
      return;
    }
    setError(null);
    try {
      const user = await login(email.trim(), password);
      navigate(HOME[user.rol]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    }
  }

  return (
    <div className="login">
      <aside className="login__brand">
        <img className="login__school-logo" src="/escudo-galisencia.png" alt="Escudo de Galisencia" />
        <p className="login__eyebrow">E.E.S.T. N°5 · General San Martín</p>
        <h1 className="login__title">Gestión escolar<br /><em>conectada.</em></h1>
        <p className="login__tag">Galisencia organiza la asistencia, el seguimiento académico y las decisiones institucionales.</p>
        <div className="login__features">
          <p><span>01</span> Asistencia y alertas en tiempo real</p>
          <p><span>02</span> Roles y permisos protegidos en el backend</p>
          <p><span>03</span> Auditoría de cada cambio importante</p>
        </div>
        <p className="login__sso"><span className="login__status" /> Una cuenta para Galisencia y Galiservas</p>
        <p className="login__school-name">GALILEO GALILEI · ESCUELA TÉCNICA</p>
      </aside>

      <main className="login__panel">
        <form className="login__form" onSubmit={onSubmit} noValidate>
          <div className="login__mobile-brand"><img className="login__school-logo small" src="/escudo-galisencia.png" alt="" /><b>GALISENCIA</b></div>
          <p className="login__form-kicker">ACCESO INSTITUCIONAL</p>
          <h2 className="login__form-title">Bienvenido</h2>
          <p className="login__form-sub">El sistema identifica tu rol y habilita únicamente las funciones autorizadas.</p>

          <div className="field">
            <label htmlFor="email">Correo institucional</label>
            <input id="email" className="input" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="nombre@galileo.edu.ar" autoComplete="username" disabled={loading} />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" className="input" type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder="Tu contraseña" autoComplete="current-password" disabled={loading} />
          </div>
          {error && <p className="login__error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block login__submit" type="submit" disabled={loading}>
            {loading ? <><span className="login__spinner" /> Verificando...</> : "Ingresar al sistema"}
          </button>
          <p className="login__help">Usuarios de demostración: contraseña <code>demo1234</code></p>
        </form>
      </main>
    </div>
  );
}
