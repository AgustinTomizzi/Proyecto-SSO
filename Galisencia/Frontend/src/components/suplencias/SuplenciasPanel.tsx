import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiGet, apiSend } from "../../data/apiClient";
import { hoyLocal } from "../../data/fecha";
import { etiquetaCurso, etiquetaCursoTexto, ordenarCursos } from "../horarios/grillaModelo";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import "./suplencias.css";

type Id = string | number;

interface Suplencia {
  id: Id;
  cursoId: Id;
  curso: string;
  preceptorId: Id;
  preceptor: string;
  desde: string;
  hasta: string;
  motivo: string | null;
  vigente: boolean;
}

interface CursoCatalogo {
  id: Id;
  anio: string;
  division: string;
  preceptorId: Id | null;
}

interface Catalogo {
  cursos: CursoCatalogo[];
  preceptores: { id: Id; nombre: string }[];
  maxDiasPreceptor: number;
}

type EstadoSuplencia = "vigente" | "proxima" | "finalizada";

const ESTADO_BADGE: Record<EstadoSuplencia, { label: string; cls: string }> = {
  vigente: { label: "Vigente", cls: "badge-success" },
  proxima: { label: "Próxima", cls: "badge-info" },
  finalizada: { label: "Finalizada", cls: "" },
};

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Suma días a una fecha YYYY-MM-DD sin pasar por UTC/toISOString. */
function sumarDias(fecha: string, dias: number): string {
  const m = FECHA_RE.exec(fecha);
  if (!m) return fecha;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function diasEntre(desde: string, hasta: string): number {
  const a = FECHA_RE.exec(desde);
  const b = FECHA_RE.exec(hasta);
  if (!a || !b) return NaN;
  const ta = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const tb = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((tb - ta) / 86_400_000);
}

/** "06/10 al 10/10/2026" (o con ambos años si cruza de año). */
function formatoPeriodo(desde: string, hasta: string): string {
  const a = FECHA_RE.exec(desde);
  const b = FECHA_RE.exec(hasta);
  if (!a || !b) return `${desde} al ${hasta}`;
  const inicio = a[1] === b[1] ? `${a[3]}/${a[2]}` : `${a[3]}/${a[2]}/${a[1]}`;
  if (desde === hasta) return `${b[3]}/${b[2]}/${b[1]}`;
  return `${inicio} al ${b[3]}/${b[2]}/${b[1]}`;
}

function estadoDe(s: Suplencia, hoy: string): EstadoSuplencia {
  if (s.hasta < hoy) return "finalizada";
  if (s.desde > hoy) return "proxima";
  return "vigente";
}

function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

interface Props {
  /** Se llama después de crear o quitar una suplencia (p. ej. para recargar cursos del store). */
  onCambio?: () => void;
}

export default function SuplenciasPanel({ onCambio }: Props) {
  const { usuario } = useAuth();
  const { push } = useToast();
  const esGestor = usuario?.permisos.includes("cursos.asignar") ?? false;
  const usuarioId = usuario?.id ?? "";

  const [suplencias, setSuplencias] = useState<Suplencia[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [cursoId, setCursoId] = useState("");
  const [preceptorId, setPreceptorId] = useState("");
  const [desde, setDesde] = useState(hoyLocal);
  const [hasta, setHasta] = useState(() => sumarDias(hoyLocal(), 4));
  const [motivo, setMotivo] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [quitarId, setQuitarId] = useState<Id | null>(null);
  const [quitando, setQuitando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga("");
    try {
      const [lista, cat] = await Promise.all([
        apiGet<{ suplencias: Suplencia[] }>("/suplencias.php"),
        apiGet<Catalogo>("/suplencias.php?catalogo=1"),
      ]);
      setSuplencias(lista.suplencias ?? []);
      setCatalogo({
        cursos: (cat.cursos ?? []).map((c) => ({ ...c, anio: String(c.anio), division: String(c.division) })),
        preceptores: cat.preceptores ?? [],
        maxDiasPreceptor: Number(cat.maxDiasPreceptor) || 30,
      });
    } catch (error) {
      setErrorCarga(mensajeError(error, "No se pudieron cargar las suplencias"));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hoy = hoyLocal();
  const maxDias = catalogo?.maxDiasPreceptor ?? 30;
  const preceptorElegido = esGestor ? preceptorId : usuarioId;

  const cursosDisponibles = useMemo(() => {
    const cursos = (catalogo?.cursos ?? []).filter(
      (c) => !preceptorElegido || String(c.preceptorId ?? "") !== String(preceptorElegido)
    );
    return ordenarCursos(cursos);
  }, [catalogo, preceptorElegido]);

  // Si el curso elegido deja de estar disponible (cambió el preceptor), se limpia.
  useEffect(() => {
    if (cursoId && !cursosDisponibles.some((c) => String(c.id) === cursoId)) setCursoId("");
  }, [cursoId, cursosDisponibles]);

  const ordenadas = useMemo(() => {
    const peso: Record<EstadoSuplencia, number> = { vigente: 0, proxima: 1, finalizada: 2 };
    return [...suplencias].sort(
      (a, b) =>
        peso[estadoDe(a, hoy)] - peso[estadoDe(b, hoy)] ||
        (estadoDe(a, hoy) === "finalizada" ? b.hasta.localeCompare(a.hasta) : a.desde.localeCompare(b.desde))
    );
  }, [suplencias, hoy]);

  const hastaMax = !esGestor && FECHA_RE.test(desde) ? sumarDias(desde, maxDias - 1) : undefined;

  function cambiarDesde(valor: string) {
    setDesde(valor);
    if (FECHA_RE.test(valor) && (!FECHA_RE.test(hasta) || hasta < valor)) setHasta(sumarDias(valor, 4));
  }

  function validar(): string {
    if (esGestor && !preceptorId) return "Seleccioná el preceptor suplente.";
    if (!cursoId) return "Seleccioná un curso.";
    if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) return "Ingresá fechas válidas.";
    if (hasta < desde) return "La fecha de fin no puede ser anterior a la de inicio.";
    if (!esGestor) {
      if (desde < hoy) return "La suplencia no puede empezar en una fecha pasada.";
      if (diasEntre(desde, hasta) + 1 > maxDias)
        return `La suplencia puede durar como máximo ${maxDias} días.`;
    }
    if (motivo.trim().length > 255) return "El motivo puede tener hasta 255 caracteres.";
    return "";
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setErrorForm(problema);
      return;
    }
    setGuardando(true);
    setErrorForm("");
    try {
      const cuerpo: Record<string, unknown> = { cursoId: Number(cursoId), desde, hasta };
      if (motivo.trim()) cuerpo.motivo = motivo.trim();
      if (esGestor) cuerpo.preceptorId = Number(preceptorId);
      await apiSend("/suplencias.php", "POST", cuerpo);
      push("Suplencia registrada");
      setCursoId("");
      setMotivo("");
      onCambio?.();
      await cargar();
    } catch (error) {
      setErrorForm(mensajeError(error, "No se pudo registrar la suplencia"));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id: Id) {
    setQuitando(true);
    try {
      await apiSend("/suplencias.php", "DELETE", { id: Number(id) });
      setQuitarId(null);
      push("Suplencia quitada");
      onCambio?.();
      await cargar();
    } catch (error) {
      setQuitarId(null);
      push(mensajeError(error, "No se pudo quitar la suplencia"), "error");
    } finally {
      setQuitando(false);
    }
  }

  const aQuitar = suplencias.find((s) => String(s.id) === String(quitarId));

  return (
    <div className="suplencias">
      <form className="card card-pad-lg suplencias__form" onSubmit={crear} noValidate>
        <h3>Nueva suplencia</h3>
        <p className="muted text-sm suplencias__ayuda">
          {esGestor
            ? "Asigná a un preceptor la cobertura temporal de otro curso."
            : `Cubrí temporalmente otro curso (hasta ${maxDias} días). Mientras esté vigente, lo vas a ver en tu lista de cursos.`}
        </p>
        <div className="grid grid-2">
          {esGestor && (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="suplencia-preceptor">Preceptor suplente</label>
              <select
                id="suplencia-preceptor"
                className="select"
                value={preceptorId}
                onChange={(e) => setPreceptorId(e.target.value)}
                disabled={!catalogo}
              >
                <option value="">Seleccionar…</option>
                {(catalogo?.preceptores ?? []).map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="suplencia-curso">Curso a cubrir</label>
            <select
              id="suplencia-curso"
              className="select"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              disabled={!catalogo}
            >
              <option value="">Seleccionar…</option>
              {cursosDisponibles.map((c) => (
                <option key={c.id} value={String(c.id)}>{etiquetaCurso(c)}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="suplencia-desde">Desde</label>
            <input
              id="suplencia-desde"
              className="input"
              type="date"
              value={desde}
              min={esGestor ? undefined : hoy}
              max={esGestor ? undefined : sumarDias(hoy, 7)}
              onChange={(e) => cambiarDesde(e.target.value)}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="suplencia-hasta">Hasta</label>
            <input
              id="suplencia-hasta"
              className="input"
              type="date"
              value={hasta}
              min={FECHA_RE.test(desde) ? desde : undefined}
              max={hastaMax}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className={`field${esGestor ? " suplencias__motivo" : ""}`} style={{ margin: 0 }}>
            <label htmlFor="suplencia-motivo">Motivo (opcional)</label>
            <input
              id="suplencia-motivo"
              className="input"
              value={motivo}
              maxLength={255}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Licencia del preceptor titular"
            />
          </div>
        </div>
        {errorForm && (
          <p className="asistencia-dashboard__error" role="alert" style={{ marginTop: 14 }}>{errorForm}</p>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={guardando || !catalogo}>
            {guardando ? "Registrando..." : "Registrar suplencia"}
          </button>
        </div>
      </form>

      <div className="card card-pad-lg">
        <div className="row spread suplencias__lista-head">
          <h3>Suplencias registradas</h3>
          {!cargando && !errorCarga && <span className="badge badge-brand">{suplencias.length}</span>}
        </div>
        {cargando ? (
          <p className="muted text-sm" role="status">Cargando suplencias...</p>
        ) : errorCarga ? (
          <div className="suplencias__error">
            <p className="asistencia-dashboard__error" role="alert">{errorCarga}</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => void cargar()}>Reintentar</button>
          </div>
        ) : ordenadas.length === 0 ? (
          <EmptyState
            icon="🔁"
            title="No hay suplencias"
            description={esGestor ? "No hay suplencias vigentes, próximas ni recientes." : "No tenés suplencias vigentes, próximas ni recientes."}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Curso</th>
                  {esGestor && <th>Preceptor</th>}
                  <th>Período</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th style={{ width: 110 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((s) => {
                  const estado = ESTADO_BADGE[estadoDe(s, hoy)];
                  const curso = etiquetaCursoTexto(s.curso);
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{curso}</td>
                      {esGestor && <td>{s.preceptor}</td>}
                      <td className="suplencias__periodo">{formatoPeriodo(s.desde, s.hasta)}</td>
                      <td className="muted text-sm">{s.motivo || "—"}</td>
                      <td><span className={`badge ${estado.cls}`}>{estado.label}</span></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setQuitarId(s.id)}
                          aria-label={`Quitar suplencia de ${curso}${esGestor ? ` (${s.preceptor})` : ""}`}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={quitarId !== null}
        title="Quitar suplencia"
        message={
          aQuitar
            ? `Se quitará la suplencia de ${etiquetaCursoTexto(aQuitar.curso)}${esGestor ? ` a cargo de ${aQuitar.preceptor}` : ""} (${formatoPeriodo(aQuitar.desde, aQuitar.hasta)}).`
            : "Se quitará la suplencia."
        }
        confirmLabel={quitando ? "Quitando..." : "Quitar"}
        onConfirm={() => {
          if (quitarId !== null && !quitando) void quitar(quitarId);
        }}
        onCancel={() => {
          if (!quitando) setQuitarId(null);
        }}
      />
    </div>
  );
}
