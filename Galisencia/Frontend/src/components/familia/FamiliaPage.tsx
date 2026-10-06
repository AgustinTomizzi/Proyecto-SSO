import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiGet, apiSend, apiUrl, CSRF_HEADER } from "../../data/apiClient";
import AsistenciaDashboard from "../asistencia/AsistenciaDashboard";
import { etiquetaCursoTexto } from "../horarios/grillaModelo";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import "../justificaciones/justificaciones.css";
import "./familia.css";

interface Justificacion {
  id: string;
  desde: string;
  hasta: string;
  motivo: string | null;
  tieneAdjunto: boolean;
  adjuntoNombre: string | null;
  ausenciasJustificadas: number;
}

interface Preferencia {
  tipo: string;
  etiqueta: string;
  habilitada: boolean;
}

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/** Justificaciones del alumno (solo lectura; las carga la escuela). */
function JustificacionesDelAlumno({ alumnoId, nombre }: { alumnoId: string; nombre: string }) {
  const { push } = useToast();
  const [lista, setLista] = useState<Justificacion[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      const data = await apiGet<{ ok: true; justificaciones: Justificacion[] }>(`/justificaciones.php?alumnoId=${encodeURIComponent(alumnoId)}`, 10000);
      setLista(data.justificaciones);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las justificaciones.");
    }
  }, [alumnoId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  async function descargar(j: Justificacion) {
    try {
      const res = await fetch(apiUrl(`/justificaciones.php?id=${encodeURIComponent(j.id)}&adjunto=1`), { credentials: "include", headers: CSRF_HEADER });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Error HTTP ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = j.adjuntoNombre || `justificacion-${j.id}`;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudo descargar el adjunto.", "error");
    }
  }

  return (
    <div className="card card-pad-lg">
      <div className="row spread justificaciones__lista-head">
        <h3>Justificaciones de {nombre}</h3>
        {lista && <span className="badge badge-brand">{lista.length}</span>}
      </div>
      {error ? (
        <div className="justificaciones__error">
          <p className="asistencia-dashboard__error" role="alert">{error}</p>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => void cargar()}>Reintentar</button>
        </div>
      ) : lista === null ? (
        <p className="muted text-sm" role="status">Cargando justificaciones...</p>
      ) : lista.length === 0 ? (
        <EmptyState icon="📝" title="No hay justificaciones" description="Si tu hijo faltó por un motivo justificado, acercá el comprobante a preceptoría." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Período</th><th>Motivo</th><th>Ausencias</th><th>Adjunto</th></tr></thead>
            <tbody>
              {lista.map((j) => (
                <tr key={j.id}>
                  <td className="justificaciones__periodo">{j.desde === j.hasta ? fechaCorta(j.desde) : `${fechaCorta(j.desde)} al ${fechaCorta(j.hasta)}`}</td>
                  <td>{j.motivo ?? "—"}</td>
                  <td><span className="badge badge-info">{j.ausenciasJustificadas}</span></td>
                  <td>{j.tieneAdjunto && j.adjuntoNombre !== null ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void descargar(j)}>Descargar</button> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Preferencia del aviso diario de inasistencias por email. */
function AvisosFamilia() {
  const { push } = useToast();
  const [prefs, setPrefs] = useState<Preferencia[] | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    apiGet<{ ok: true; preferencias: Preferencia[] }>("/notificaciones.php")
      .then((data) => vigente && setPrefs(data.preferencias))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : "No se pudieron cargar tus avisos."));
    return () => { vigente = false; };
  }, []);

  async function cambiar(tipo: string, habilitada: boolean) {
    setGuardando(true);
    try {
      const data = await apiSend<{ ok: true; preferencias: Preferencia[] }>("/notificaciones.php", "PUT", { preferencias: { [tipo]: habilitada } });
      setPrefs(data.preferencias);
      push(habilitada ? "Vas a recibir el aviso de inasistencias por email." : "Dejaste de recibir el aviso de inasistencias.");
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudo guardar el cambio.", "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card card-pad-lg">
      <h3>Avisos por email</h3>
      <p className="muted text-sm" style={{ margin: "4px 0 12px" }}>Cuando tu hijo falta, te escribimos una vez por día con las materias en las que estuvo ausente.</p>
      {error && <p className="asistencia-dashboard__error" role="alert">{error}</p>}
      {prefs?.map((p) => (
        <label key={p.tipo} className="familia__aviso">
          <input type="checkbox" checked={p.habilitada} disabled={guardando} onChange={(e) => void cambiar(p.tipo, e.target.checked)} />
          <span>{p.etiqueta}</span>
        </label>
      ))}
    </div>
  );
}

/** Portal de familias: asistencia, justificaciones y avisos de cada hijo vinculado. */
export default function FamiliaPage() {
  const { usuario } = useAuth();
  const hijos = usuario?.alumnos ?? [];
  const [elegido, setElegido] = useState("");
  const hijo = hijos.find((h) => h.id === elegido) ?? hijos[0];

  return (
    <div className="page familia-page">
      <div className="page-head">
        <div>
          <h1>Familia</h1>
          <p className="sub">Seguí la asistencia de tus hijos y sus justificaciones.</p>
        </div>
      </div>

      {hijos.length === 0 ? (
        <EmptyState icon="👪" title="Todavía no tenés alumnos vinculados" description="Pedile a la escuela que vincule tu cuenta con la de tu hijo o hija." />
      ) : (
        <>
          {hijos.length > 1 && (
            <div className="suplencias-tabs" role="tablist" aria-label="Elegí a tu hijo o hija">
              {hijos.map((h) => (
                <button key={h.id} type="button" role="tab" aria-selected={h.id === hijo?.id} className={`btn btn-sm ${h.id === hijo?.id ? "btn-soft" : "btn-ghost"}`} onClick={() => setElegido(h.id)}>
                  {h.nombre}{h.curso ? ` · ${etiquetaCursoTexto(h.curso)}` : ""}
                </button>
              ))}
            </div>
          )}
          {hijo && (
            <div className="familia__contenido" key={hijo.id}>
              <AsistenciaDashboard alumnoId={hijo.id} nombre={`${hijo.nombre} ${hijo.apellido}`.trim()} curso={hijo.curso ?? ""} vista="familia" />
              <JustificacionesDelAlumno alumnoId={hijo.id} nombre={hijo.nombre} />
            </div>
          )}
          <AvisosFamilia />
        </>
      )}
    </div>
  );
}
