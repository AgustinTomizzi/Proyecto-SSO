import { useState } from "react";
import { useAuth } from "./AuthContext";
import "./LoginPage.css";

// Pantalla obligatoria para cuentas con debe_cambiar_password (por ejemplo,
// las cuentas demo con demo1234): la API rechaza el resto de los pedidos
// hasta que el usuario elija una contraseña propia.
export default function CambiarPasswordPage() {
  const { usuario, cambiarPassword, logout } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!actual || !nueva || !repetida) {
      setError("Completá los tres campos.");
      return;
    }
    if (nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== repetida) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await cambiarPassword(actual, nueva);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar la contraseña.");
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
            <h3 className="login__card-title">Elegí una contraseña nueva</h3>
            <p className="login__card-sub">
              {usuario?.email}: antes de continuar tenés que reemplazar la contraseña inicial.
            </p>
          </div>

          {error && (
            <div className="login__error" role="alert">
              {error}
            </div>
          )}

          <form className="login__form" onSubmit={onSubmit} noValidate>
            <div className="login__field">
              <label className="login__label" htmlFor="pw-actual">Contraseña actual</label>
              <input id="pw-actual" type="password" className="login__input login__input--plain" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" disabled={enviando} />
            </div>
            <div className="login__field">
              <label className="login__label" htmlFor="pw-nueva">Contraseña nueva</label>
              <input id="pw-nueva" type="password" className="login__input login__input--plain" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={8} disabled={enviando} />
            </div>
            <div className="login__field">
              <label className="login__label" htmlFor="pw-repetida">Repetí la contraseña nueva</label>
              <input id="pw-repetida" type="password" className="login__input login__input--plain" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" minLength={8} disabled={enviando} />
            </div>
            <button type="submit" className="login__submit" disabled={enviando}>
              {enviando ? "Guardando..." : "Guardar y continuar"}
            </button>
          </form>

          <button type="button" className="login__forgot" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </main>
    </div>
  );
}
