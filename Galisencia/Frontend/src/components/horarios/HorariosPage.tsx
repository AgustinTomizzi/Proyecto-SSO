import { useEffect, useState, type ChangeEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiGet, apiSend, apiUpload, apiUrl } from "../../data/apiClient";
import { useToast } from "../ui/Toast";
import "./horarios.css";

interface CursoHorario {
  id: string;
  anio: string;
  division: string;
  turno: string;
  horarioId: string | null;
  nombreArchivo: string | null;
  mimeType: string | null;
  tamanio: number | null;
  actualizadoEn: string | null;
}

interface HorariosResponse {
  ok: boolean;
  cursos: CursoHorario[];
}

const MAX_SIZE = 5 * 1024 * 1024;
const VALID_TYPES = ["image/png", "image/jpeg", "image/webp"];

function imageUrl(curso: CursoHorario, download = false) {
  const params = new URLSearchParams({ imagen: "1", cursoId: curso.id });
  if (download) params.set("download", "1");
  if (curso.actualizadoEn) params.set("v", curso.actualizadoEn);
  return apiUrl(`/horarios.php?${params}`);
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.replace(" ", "T")));
}

export default function HorariosPage() {
  const { usuario } = useAuth();
  const { push } = useToast();
  const [cursos, setCursos] = useState<CursoHorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<CursoHorario | null>(null);
  const canManage = usuario?.permisos.includes("horarios.gestionar") ?? false;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<HorariosResponse>("/horarios.php");
      setCursos(data.cursos);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los horarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(cursoId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!VALID_TYPES.includes(file.type)) {
      setError("Seleccioná una imagen PNG, JPG o WEBP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("La imagen no puede superar los 5 MB.");
      return;
    }
    const body = new FormData();
    body.append("cursoId", cursoId);
    body.append("imagen", file);
    setBusyId(cursoId);
    setError("");
    try {
      await apiUpload("/horarios.php", body);
      push("Horario actualizado");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el horario");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(curso: CursoHorario) {
    if (!window.confirm(`¿Eliminar el horario de ${curso.anio} ${curso.division}?`)) return;
    setBusyId(curso.id);
    setError("");
    try {
      await apiSend("/horarios.php", "DELETE", { cursoId: curso.id });
      push("Horario eliminado");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el horario");
    } finally {
      setBusyId(null);
    }
  }

  async function download(curso: CursoHorario) {
    try {
      const response = await fetch(imageUrl(curso, true), { credentials: "include" });
      if (!response.ok) throw new Error("No se pudo descargar el horario");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = curso.nombreArchivo || `horario-${curso.anio}-${curso.division}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar el horario");
    }
  }

  return (
    <div className="page horarios-page">
      <div className="page-head horarios-head">
        <div>
          <span className="horarios-eyebrow">Organización semanal</span>
          <h1>{canManage ? "Horarios por curso" : "Mi horario"}</h1>
          <p className="sub">{canManage ? "Publicá una imagen vigente para cada curso." : "Consultá, ampliá o descargá el horario de tu curso."}</p>
        </div>
        {canManage && <span className="badge badge-brand">{cursos.filter((curso) => curso.horarioId).length} de {cursos.length} publicados</span>}
      </div>

      {error && <div className="horarios-alert" role="alert">{error}</div>}
      {loading ? <div className="horarios-loading"><span />Cargando horarios...</div> : cursos.length === 0 ? (
        <section className="horarios-empty"><CalendarIcon /><h2>No hay un curso asociado</h2><p>Cuando se asigne tu curso, el horario aparecerá en esta sección.</p></section>
      ) : (
        <div className={`horarios-grid${canManage ? " horarios-grid--manage" : ""}`}>
          {cursos.map((curso) => (
            <article className="horario-card" key={curso.id}>
              <header className="horario-card__header">
                <div className="horario-card__course"><span>{curso.anio}°</span><div><h2>{curso.anio}° {curso.division}</h2><p>Turno {curso.turno}</p></div></div>
                <span className={`horario-card__status ${curso.horarioId ? "published" : "pending"}`}>{curso.horarioId ? "Publicado" : "Sin horario"}</span>
              </header>

              {curso.horarioId ? (
                <button className="horario-card__preview" onClick={() => setExpanded(curso)} aria-label={`Ampliar horario de ${curso.anio} ${curso.division}`}>
                  <img src={imageUrl(curso)} alt={`Horario de ${curso.anio}° ${curso.division}`} />
                  <span><ZoomIcon /> Ampliar</span>
                </button>
              ) : <div className="horario-card__placeholder"><CalendarIcon /><strong>Horario no publicado</strong><span>{canManage ? "Cargá una imagen para este curso." : "La administración todavía no publicó el horario."}</span></div>}

              <footer className="horario-card__footer">
                {curso.horarioId && <div className="horario-card__meta"><strong>{curso.nombreArchivo}</strong><span>Actualizado {formatDate(curso.actualizadoEn)}</span></div>}
                <div className="horario-card__actions">
                  {curso.horarioId && <button className="btn btn-soft btn-sm" onClick={() => void download(curso)}><DownloadIcon /> Descargar</button>}
                  {canManage && <label className="btn btn-primary btn-sm horario-upload">{busyId === curso.id ? "Guardando..." : curso.horarioId ? "Reemplazar" : "Cargar imagen"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busyId !== null} onChange={(event) => void upload(curso.id, event)} /></label>}
                  {canManage && curso.horarioId && <button className="btn btn-danger btn-sm" disabled={busyId !== null} onClick={() => void remove(curso)}>Eliminar</button>}
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}

      {expanded && <div className="horario-lightbox" role="dialog" aria-modal="true" aria-label={`Horario de ${expanded.anio} ${expanded.division}`} onMouseDown={() => setExpanded(null)}><div onMouseDown={(event) => event.stopPropagation()}><header><div><strong>{expanded.anio}° {expanded.division}</strong><span>Turno {expanded.turno}</span></div><button onClick={() => setExpanded(null)} aria-label="Cerrar"><CloseIcon /></button></header><img src={imageUrl(expanded)} alt={`Horario ampliado de ${expanded.anio}° ${expanded.division}`} /><footer><button className="btn btn-primary" onClick={() => void download(expanded)}><DownloadIcon /> Descargar imagen</button></footer></div></div>}
    </div>
  );
}

function CalendarIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>; }
function ZoomIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/></svg>; }
function DownloadIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>; }
function CloseIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg>; }
