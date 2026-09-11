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

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function CircuitPattern() {
  return (
    <svg className="login__circuit" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
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
  );
}

function CodeLines() {
  const lines = [
    "const asistencia = new Sistema();",
    "if (alumno.presente) { registrar(); }",
    "// E.E.S.T. N°5 — 2026",
    "function login(legajo, pass) {",
    "  return auth.verificar(legajo);",
    "}",
    "<Galileo version='2026' />",
    "01001000 01101001",
    "SELECT * FROM asistencias",
    "import { Control } from 'galisencia';",
  ];

  return (
    <div className="login__coderows">
      {lines.map((line, i) => (
        <div
          key={i}
          className="login__coderow"
          style={{
            top: `${8 + i * 9.2}%`,
            left: i % 2 === 0 ? "-2%" : "5%",
            transform: `rotate(${i % 2 === 0 ? "-4deg" : "0deg"})`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function SunGlow() {
  return (
    <div
      className="login__sunglow"
      style={{
        bottom: "5%",
        right: "-10%",
        width: "380px",
        height: "380px",
        background: "radial-gradient(circle, rgba(255,201,60,0.08) 0%, rgba(255,201,60,0.03) 40%, transparent 70%)",
        borderRadius: "50%",
      }}
    />
  );
}

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Completá el correo institucional y la contraseña.");
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
      {/* ─── PANEL INSTITUCIONAL ─── */}
      <aside className="login__brand">
        <CircuitPattern />
        <CodeLines />
        <SunGlow />
        <div className="login__accent-top" />

        {/* Móvil: fila horizontal logo + texto */}
        <div className="login__mobile-brand">
          <img className="login__school-logo mobile" src="/logogalisenciasinfondo.png" alt="Escudo GALISENCIA — E.E.S.T. N.º 5 Galileo Galilei" />
          <div className="login__mobile-info">
            <div className="login__school-title mobile">E.E.S.T N°5 Galileo Galilei</div>
            <div className="login__school-sub mobile">Provincia de Buenos Aires</div>
            <div className="login__pills mobile">
              {["Informática", "Programación", "Multimedios"].map((o) => (
                <span key={o} className="login__pill">
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Escritorio: columna vertical centrada */}
        <div className="login__accent-bottom" />
        <div className="login__brand-inner">
          <img className="login__school-logo" src="/logogalisenciasinfondo.png" alt="Escudo GALISENCIA — E.E.S.T. N.º 5 Galileo Galilei" />
          <div className="login__divider">
            <span className="login__divider-line" />
            <span className="login__divider-dot" />
            <span className="login__divider-line" />
          </div>
          <div className="login__school-heading">
            <div className="login__school-title">E.E.S.T N°5 Galileo Galilei</div>
            <div className="login__school-sub">Provincia de Buenos Aires</div>
          </div>
          <div className="login__pills">
            {["Informática", "Programación", "Multimedios"].map((o) => (
              <span key={o} className="login__pill">
                {o}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── PANEL DE ACCESO ─── */}
      <main className="login__panel">
        <div className="login__panel-glow" />
        <div className="login__card">
          <div className="login__card-accent" />

          <div className="login__card-header">
            <h3 className="login__card-title">Iniciar sesión</h3>
            <p className="login__card-sub">Ingresá con tu correo galileo.</p>
          </div>

          {error && (
            <div className="login__error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form className="login__form" onSubmit={onSubmit} noValidate>
            <div className="login__field">
              <label className="login__label" htmlFor="email">
                Correo institucional
              </label>
              <div className="login__input-wrap">
                <span className="login__icon" style={{ color: focusedField === "email" ? "#1E6B3C" : "#9CA3AF" }}>
                  <UserIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  className="login__input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="nombre@galileo.edu.ar"
                  autoComplete="username"
                  disabled={loading}
                  style={{
                    borderColor: focusedField === "email" ? "#1E6B3C" : "#E5E7EB",
                    boxShadow: focusedField === "email" ? "0 0 0 3px rgba(30,107,60,0.1)" : "none",
                  }}
                />
              </div>
            </div>

            <div className="login__field">
              <label className="login__label" htmlFor="password">
                Contraseña
              </label>
              <div className="login__input-wrap">
                <span className="login__icon" style={{ color: focusedField === "password" ? "#1E6B3C" : "#9CA3AF" }}>
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="login__input login__input--pw"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{
                    borderColor: focusedField === "password" ? "#1E6B3C" : "#E5E7EB",
                    boxShadow: focusedField === "password" ? "0 0 0 3px rgba(30,107,60,0.1)" : "none",
                  }}
                />
                <button
                  type="button"
                  className="login__toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div className="login__row">
              <label className="login__check-label" onClick={() => setRemember(!remember)}>
                <span
                  className="login__check"
                  style={{
                    backgroundColor: remember ? "#1E6B3C" : "white",
                    borderColor: remember ? "#1E6B3C" : "#D1D5DB",
                  }}
                >
                  {remember && (
                    <svg className="login__check-mark" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6 L5 9 L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="login__remember">Recordarme</span>
              </label>
              <button type="button" className="login__forgot">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button type="submit" className="login__submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login__spinner" />
                  Verificando...
                </>
              ) : (
                <>
                  Ingresar
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login__or">
            <div className="login__or-line" />
            <span className="login__or-text">o también</span>
            <div className="login__or-line" />
          </div>

          <button type="button" className="login__sso">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            Ingresar con tu cuenta galileo.
          </button>

          <p className="login__demo">
            Usuarios de demostración: contraseña <code>demo1234</code>
          </p>
        </div>

        <div className="login__footer">
          <span className="login__footer-brand">GALISENCIA</span>
          <span>·</span>
          <span>Sistema de Asistencias</span>
          <span>·</span>
          <span>2026</span>
        </div>
      </main>
    </div>
  );
}