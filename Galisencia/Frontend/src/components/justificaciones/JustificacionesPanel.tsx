import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { apiGet, apiSend, apiUpload, apiUrl, CSRF_HEADER } from "../../data/apiClient";
import { hoyLocal } from "../../data/fecha";
import { useStore } from "../../data/StoreContext";
import { etiquetaCurso, ordenarCursos } from "../horarios/grillaModelo";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import "./justificaciones.css";

interface Justificacion {
  id: string;
  alumnoId: string;
  alumno: string;
  desde: string;
  hasta: string;
  /** null si la sesión no puede verlo (puede ser un dato de salud). */
  motivo: string | null;
  tieneAdjunto: boolean;
  adjuntoNombre: string | null;
  creadoPor: string | null;
  creadoEn: string;
  ausenciasJustificadas: number;
  puedeEliminar: boolean;
}

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_ADJUNTO = 5 * 1024 * 1024;
const MAX_DIAS = 60;
const TIPOS_ADJUNTO = ["application/pdf", "image/jpeg", "image/png"];

/** Suma días a YYYY-MM-DD sin pasar por UTC/toISOString. */
function sumarDias(iso: string, dias: number): string {
  const m = FECHA_RE.exec(iso);
  if (!m) return iso;
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}-${String(fecha.getUTCDate()).padStart(2, "0")}`;
}
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");
const periodo = (j: Pick<Justificacion, "desde" | "hasta">) => (j.desde === j.hasta ? fechaCorta(j.desde) : `${fechaCorta(j.desde)} al ${fechaCorta(j.hasta)}`);

/**
 * Justificación de inasistencias (permiso asistencia.justificar). Las ausencias
 * del rango pasan a "justificada"; el backend valida alcance y fechas.
 */
export default function JustificacionesPanel({ onCambio }: { onCambio?: () => void }) {
  const { cursos, alumnos } = useStore();
  const { push } = useToast();
  const hoy = hoyLocal();
  const cursosOrdenados = useMemo(() => ordenarCursos(cursos), [cursos]);
  const [cursoId, setCursoId] = useState("");
  const [alumnoId, setAlumnoId] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [motivo, setMotivo] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [lista, setLista] = useState<Justificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [quitarId, setQuitarId] = useState<string | null>(null);
  const [quitando, setQuitando] = useState(false);

  const cursoActual = cursoId || cursosOrdenados[0]?.id || "";
  const alumnosCurso = useMemo(
    () => alumnos.filter((a) => String(a.cursoId) === String(cursoActual)).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es")),
    [alumnos, cursoActual]
  );

  const cargar = useCallback(async () => {
    if (!cursoActual) return;
    setCargando(true);
    setErrorCarga("");
    try {
      const data = await apiGet<{ ok: true; justificaciones: Justificacion[] }>(`/justificaciones.php?cursoId=${encodeURIComponent(cursoActual)}`, 10000);
      setLista(data.justificaciones);
    } catch (error) {
      setErrorCarga(error instanceof Error ? error.message : "No se pudieron cargar las justificaciones.");
    } finally {
      setCargando(false);
    }
  }, [cursoActual]);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  const elegirArchivo = (file: File | null) => {
    setErrorForm("");
    if (file && file.size > MAX_ADJUNTO) {
      setErrorForm("El adjunto no puede superar los 5 MB.");
      if (archivoRef.current) archivoRef.current.value = "";
      setArchivo(null);
      return;
    }
    if (file && file.type && !TIPOS_ADJUNTO.includes(file.type)) {
      setErrorForm("El adjunto tiene que ser PDF, JPG o PNG.");
      if (archivoRef.current) archivoRef.current.value = "";
      setArchivo(null);
      return;
    }
    setArchivo(file);
  };

  async function crear(event: FormEvent) {
    event.preventDefault();
    setErrorForm("");
    if (!alumnoId) return setErrorForm("Elegí el alumno.");
    if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta) || desde > hasta) return setErrorForm("Revisá las fechas: el inicio no puede ser posterior al fin.");
    if (hasta > sumarDias(hoy, 30)) return setErrorForm("Se puede justificar por adelantado hasta 30 días.");
    if (desde < sumarDias(hasta, -(MAX_DIAS - 1))) return setErrorForm(`Una justificación cubre hasta ${MAX_DIAS} días.`);
    if (motivo.trim().length < 3) return setErrorForm("Escribí el motivo (mínimo 3 caracteres).");
    setGuardando(true);
    try {
      const form = new FormData();
      form.append("alumnoId", alumnoId);
      form.append("desde", desde);
      form.append("hasta", hasta);
      form.append("motivo", motivo.trim());
      if (archivo) form.append("archivo", archivo);
      const data = await apiUpload<{ ok: true; justificacion: Justificacion }>("/justificaciones.php", form);
      const n = data.justificacion.ausenciasJustificadas;
      push(n === 0 ? "Justificación registrada. Las ausencias de esas fechas quedarán justificadas al cargarse." : `Justificación registrada: ${n} ${n === 1 ? "ausencia justificada" : "ausencias justificadas"}.`);
      setMotivo("");
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = "";
      await cargar();
      onCambio?.();
    } catch (error) {
      setErrorForm(error instanceof Error ? error.message : "No se pudo registrar la justificación.");
    } finally {
      setGuardando(false);
    }
  }

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
    } catch (error) {
      push(error instanceof Error ? error.message : "No se pudo descargar el adjunto.", "error");
    }
  }

  async function quitar() {
    if (!quitarId) return;
    setQuitando(true);
    try {
      const data = await apiSend<{ ok: true; ausenciasRevertidas: number }>("/justificaciones.php", "DELETE", { id: quitarId });
      push(`Justificación quitada. ${data.ausenciasRevertidas} ${data.ausenciasRevertidas === 1 ? "ausencia volvió" : "ausencias volvieron"} a quedar sin justificar.`);
      setQuitarId(null);
      await cargar();
      onCambio?.();
    } catch (error) {
      push(error instanceof Error ? error.message : "No se pudo quitar la justificación.", "error");
    } finally {
      setQuitando(false);
    }
  }

  const aQuitar = lista.find((j) => j.id === quitarId);

  return (
    <div className="justificaciones">
      <form className="card card-pad-lg" onSubmit={crear} noValidate>
        <h3>Nueva justificación</h3>
        <p className="muted text-sm justificaciones__ayuda">
          Las ausencias del alumno en esas fechas pasan a "Justificada", también las que se carguen después. El motivo y el adjunto solo los ven quienes justifican y el propio alumno.
        </p>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="justif-curso">Curso</label>
            <select id="justif-curso" className="select" value={cursoActual} onChange={(e) => { setCursoId(e.target.value); setAlumnoId(""); }}>
              {cursosOrdenados.length === 0 && <option value="">Sin cursos a cargo</option>}
              {cursosOrdenados.map((c) => <option key={c.id} value={c.id}>{etiquetaCurso({ anio: c.anio.replace(/\D/g, ""), division: c.division })}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="justif-alumno">Alumno</label>
            <select id="justif-alumno" className="select" value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)} disabled={alumnosCurso.length === 0}>
              <option value="">{alumnosCurso.length ? "Seleccionar…" : "El curso no tiene alumnos"}</option>
              {alumnosCurso.map((a) => <option key={a.id} value={a.id}>{`${a.apellido}, ${a.nombre}`}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="justif-desde">Desde</label>
            <input id="justif-desde" className="input" type="date" value={desde} max={sumarDias(hoy, 30)} onChange={(e) => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="justif-hasta">Hasta</label>
            <input id="justif-hasta" className="input" type="date" value={hasta} min={FECHA_RE.test(desde) ? desde : undefined} max={sumarDias(hoy, 30)} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="justif-motivo">Motivo</label>
            <input id="justif-motivo" className="input" value={motivo} maxLength={255} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Certificado médico" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="justif-archivo">Adjunto (opcional: PDF, JPG o PNG, hasta 5 MB)</label>
            <input id="justif-archivo" ref={archivoRef} className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        {errorForm && <p className="asistencia-dashboard__error" role="alert" style={{ marginTop: 14 }}>{errorForm}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={guardando || !cursoActual}>{guardando ? "Registrando..." : "Registrar justificación"}</button>
        </div>
      </form>

      <div className="card card-pad-lg">
        <div className="row spread justificaciones__lista-head">
          <h3>Justificaciones del curso</h3>
          {!cargando && !errorCarga && <span className="badge badge-brand">{lista.length}</span>}
        </div>
        {cargando ? (
          <p className="muted text-sm" role="status">Cargando justificaciones...</p>
        ) : errorCarga ? (
          <div className="justificaciones__error">
            <p className="asistencia-dashboard__error" role="alert">{errorCarga}</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => void cargar()}>Reintentar</button>
          </div>
        ) : lista.length === 0 ? (
          <EmptyState icon="📝" title="No hay justificaciones" description="Las justificaciones que registres para este curso aparecen acá." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Alumno</th><th>Período</th><th>Motivo</th><th>Ausencias</th><th>Adjunto</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {lista.map((j) => (
                  <tr key={j.id}>
                    <td style={{ fontWeight: 600 }}>{j.alumno}</td>
                    <td className="justificaciones__periodo">{periodo(j)}</td>
                    <td>{j.motivo ?? <span className="muted">Reservado</span>}</td>
                    <td><span className="badge badge-info">{j.ausenciasJustificadas}</span></td>
                    <td>
                      {j.tieneAdjunto && j.adjuntoNombre !== null
                        ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void descargar(j)} aria-label={`Descargar el adjunto de ${j.alumno}`}>Descargar</button>
                        : <span className="muted">{j.tieneAdjunto ? "Reservado" : "—"}</span>}
                    </td>
                    <td>
                      {j.puedeEliminar && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuitarId(j.id)} aria-label={`Quitar la justificación de ${j.alumno} (${periodo(j)})`}>Quitar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={quitarId !== null}
        title="Quitar justificación"
        message={aQuitar ? `Las ausencias de ${aQuitar.alumno} del ${periodo(aQuitar)} vuelven a quedar sin justificar.` : "Las ausencias vuelven a quedar sin justificar."}
        confirmLabel={quitando ? "Quitando..." : "Quitar"}
        danger
        onConfirm={() => void quitar()}
        onCancel={() => { if (!quitando) setQuitarId(null); }}
      />
    </div>
  );
}
