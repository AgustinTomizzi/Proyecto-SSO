import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import TextoPolitica from "./TextoPolitica";
import "../../auth/LoginPage.css";
import "./privacidad.css";

// Pantalla obligatoria hasta aceptar la versión vigente de la política de
// privacidad: la API rechaza el resto de los pedidos (codigo debe_aceptar_politica).
export default function AceptarPoliticaPage() {
  const { usuario, aceptarPolitica, logout } = useAuth();
  const [leida, setLeida] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aceptar() {
    if (!usuario?.versionPolitica) return;
    setError(null);
    setEnviando(true);
    try {
      await aceptarPolitica(usuario.versionPolitica);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la aceptación.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <main className="login__panel">
        <div className="login__panel-glow" />
        <div className="login__card">
          <div className="login__card-accent" />
          <div className="login__card-header">
            <h3 className="login__card-title">Política de privacidad</h3>
            <p className="login__card-sub">
              {usuario?.email}: antes de continuar, leé cómo tratamos tus datos y aceptá la política (versión {usuario?.versionPolitica}).
            </p>
          </div>

          {error && (
            <div className="login__error" role="alert">
              {error}
            </div>
          )}

          <div className="aceptar-politica__texto" tabIndex={0} aria-label="Texto de la política de privacidad">
            <TextoPolitica />
          </div>

          <label className="aceptar-politica__check">
            <input type="checkbox" checked={leida} onChange={(e) => setLeida(e.target.checked)} disabled={enviando} />
            <span>Leí la política de privacidad y acepto el tratamiento de mis datos para los fines descriptos.</span>
          </label>

          <button type="button" className="login__submit" disabled={!leida || enviando} onClick={() => void aceptar()}>
            {enviando ? "Guardando..." : "Aceptar y continuar"}
          </button>

          <button type="button" className="login__forgot" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </main>
    </div>
  );
}
