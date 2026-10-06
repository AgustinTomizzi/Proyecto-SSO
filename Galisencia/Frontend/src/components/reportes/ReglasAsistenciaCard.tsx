import { useState, type FormEvent } from "react";
import { apiSend } from "../../data/apiClient";
import { useStore } from "../../data/StoreContext";
import { REGLAS_DEMO, reglasDesdeConfig } from "../../data/types";
import { useToast } from "../ui/Toast";
import "../justificaciones/justificaciones.css";

const CAMPOS = [
  { clave: "asistencia.valor_tarde_pct", label: "Valor de una llegada tarde", ayuda: "% de un presente (0 a 100)", min: 0, max: 100 },
  { clave: "asistencia.valor_justificado_pct", label: "Valor de una inasistencia justificada", ayuda: "% de un presente; 0 = cuenta como ausencia", min: 0, max: 100 },
  { clave: "asistencia.umbral_regularidad_pct", label: "Asistencia mínima para la regularidad", ayuda: "% (1 a 100)", min: 1, max: 100 },
] as const;

type Clave = (typeof CAMPOS)[number]["clave"];

interface RespuestaConfig {
  ok: true;
  valores: Record<string, unknown>;
}

/** Reglas de cálculo de asistencia (permiso config.gestionar). Las claves de reservas no se tocan desde acá. */
export default function ReglasAsistenciaCard() {
  const { reglas, actualizarReglas } = useStore();
  const { push } = useToast();
  const desdeReglas = (r = reglas): Record<Clave, string> => ({
    "asistencia.valor_tarde_pct": String(Math.round(r.valorTarde * 100)),
    "asistencia.valor_justificado_pct": String(Math.round(r.valorJustificado * 100)),
    "asistencia.umbral_regularidad_pct": String(r.umbral),
  });
  const [form, setForm] = useState<Record<Clave, string>>(desdeReglas);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setError("");
    const valores: Record<string, number> = {};
    for (const campo of CAMPOS) {
      const valor = Number(form[campo.clave]);
      if (!Number.isInteger(valor) || valor < campo.min || valor > campo.max) {
        setError(`${campo.label}: tiene que ser un entero entre ${campo.min} y ${campo.max}.`);
        return;
      }
      valores[campo.clave] = valor;
    }
    setGuardando(true);
    try {
      const data = await apiSend<RespuestaConfig>("/config_institucion.php", "PUT", { valores });
      const nuevas = reglasDesdeConfig(data.valores);
      actualizarReglas(nuevas);
      setForm(desdeReglas(nuevas));
      push("Reglas de asistencia actualizadas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar las reglas.");
    } finally {
      setGuardando(false);
    }
  }

  async function restablecer() {
    setError("");
    setGuardando(true);
    try {
      const data = await apiSend<RespuestaConfig>("/config_institucion.php", "DELETE", { claves: CAMPOS.map((c) => c.clave) });
      const nuevas = reglasDesdeConfig(data.valores);
      actualizarReglas(nuevas);
      setForm(desdeReglas(nuevas));
      push("Se restablecieron las reglas de asistencia");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron restablecer las reglas.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="card card-pad-lg reglas-asistencia" onSubmit={guardar} noValidate>
      <h3>Reglas de asistencia</h3>
      <p className="muted text-sm" style={{ margin: "4px 0 14px" }}>
        Definen cómo se calcula el porcentaje en reportes, paneles e historiales. Por defecto: tarde {Math.round(REGLAS_DEMO.valorTarde * 100)}%, justificada {Math.round(REGLAS_DEMO.valorJustificado * 100)}% y mínimo {REGLAS_DEMO.umbral}%.
      </p>
      <div className="grid grid-3">
        {CAMPOS.map((campo) => (
          <div className="field" style={{ margin: 0 }} key={campo.clave}>
            <label htmlFor={`regla-${campo.clave}`}>{campo.label}</label>
            <input id={`regla-${campo.clave}`} className="input" type="number" min={campo.min} max={campo.max} value={form[campo.clave]} onChange={(e) => setForm((actual) => ({ ...actual, [campo.clave]: e.target.value }))} disabled={guardando} />
            <span className="muted text-sm">{campo.ayuda}</span>
          </div>
        ))}
      </div>
      {error && <p className="asistencia-dashboard__error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      <div className="reglas-asistencia__acciones">
        <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar reglas"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => void restablecer()} disabled={guardando}>Restablecer valores por defecto</button>
      </div>
    </form>
  );
}
