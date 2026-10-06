import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "../../data/apiClient";
import { etiquetaCurso, ordenarCursos } from "../horarios/grillaModelo";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import "./promocion.css";

type Accion = "promover" | "repetir" | "egresar" | "baja";
type Procesado = "promocion" | "repitencia" | "egreso";

interface AlumnoPromocion {
  id: string;
  nombre: string;
  apellido: string;
  procesado: Procesado | null;
}

interface CursoPromocion {
  id: string;
  anio: string;
  division: string;
  alumnos: AlumnoPromocion[];
  sugerencia: { accion: "promover" | "egresar"; cursoDestinoId: string | null };
}

interface Vista {
  ciclo: { anio: number; estado: "abierto" | "cerrado"; cerradoEn: string | null };
  pendientes: number;
  cursos: CursoPromocion[];
}

interface Eleccion {
  accion: Accion;
  destino: string;
}

interface Movimiento {
  alumnoId: number;
  accion: Accion;
  cursoDestinoId?: number;
}

interface RespuestaPost {
  resumen: Record<Accion, number>;
  cerrado: boolean;
}

const ULTIMO_ANIO = 7;
const MAX_LOTE = 1000;

const PROCESADO_BADGE: Record<Procesado, { label: string; cls: string }> = {
  promocion: { label: "Promovido", cls: "badge-success" },
  repitencia: { label: "Repite", cls: "badge-warning" },
  egreso: { label: "Egresado", cls: "badge-info" },
};

const ACCION_TEXTO: Record<Accion, string> = {
  promover: "Promover",
  repetir: "Repetir",
  egresar: "Egresar",
  baja: "Baja",
};

function mensajeError(error: unknown, defecto: string): string {
  return error instanceof Error && error.message ? error.message : defecto;
}

function nombreAlumno(a: AlumnoPromocion): string {
  return `${a.apellido}, ${a.nombre}`.trim();
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`;
}

interface Props {
  /** Se llama después de cada cambio (los alumnos cambian de curso o quedan inactivos). */
  onCambio?: () => void;
}

export default function PromocionPanel({ onCambio }: Props) {
  const { push } = useToast();
  const [vista, setVista] = useState<Vista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [cursoSel, setCursoSel] = useState("");
  const [elecciones, setElecciones] = useState<Record<string, Eleccion>>({});
  const [errorCurso, setErrorCurso] = useState("");
  const [confirmarCurso, setConfirmarCurso] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga("");
    try {
      const datos = await apiGet<Vista>("/promocion.php", 15000);
      setVista({
        ciclo: datos.ciclo,
        pendientes: Number(datos.pendientes) || 0,
        cursos: (datos.cursos ?? []).map((c) => ({
          ...c,
          id: String(c.id),
          anio: String(c.anio),
          division: String(c.division),
          alumnos: (c.alumnos ?? []).map((a) => ({ ...a, id: String(a.id) })),
          sugerencia: {
            accion: c.sugerencia?.accion ?? "promover",
            cursoDestinoId: c.sugerencia?.cursoDestinoId != null ? String(c.sugerencia.cursoDestinoId) : null,
          },
        })),
      });
    } catch (error) {
      setErrorCarga(mensajeError(error, "No se pudo cargar la promoción del ciclo"));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cerrado = vista?.ciclo.estado === "cerrado";
  const todos = useMemo(() => ordenarCursos(vista?.cursos ?? []), [vista]);
  const conAlumnos = useMemo(() => todos.filter((c) => c.alumnos.length > 0), [todos]);
  const porId = useMemo(() => new Map(todos.map((c) => [c.id, c])), [todos]);

  // Si el curso elegido ya no tiene alumnos (o es la primera carga), se pasa al primero con pendientes.
  useEffect(() => {
    if (conAlumnos.length === 0) return;
    if (conAlumnos.some((c) => c.id === cursoSel)) return;
    const primero = conAlumnos.find((c) => c.alumnos.some((a) => !a.procesado)) ?? conAlumnos[0];
    setCursoSel(primero.id);
  }, [conAlumnos, cursoSel]);

  const curso = porId.get(cursoSel) ?? null;
  const pendientesCurso = useMemo(() => curso?.alumnos.filter((a) => !a.procesado) ?? [], [curso]);
  const esUltimo = curso ? Number(curso.anio) >= ULTIMO_ANIO : false;
  const destinos = useMemo(
    () => (curso ? todos.filter((c) => Number(c.anio) === Number(curso.anio) + 1) : []),
    [curso, todos]
  );
  const destinoSugerido = curso?.sugerencia.cursoDestinoId ? porId.get(curso.sugerencia.cursoDestinoId) ?? null : null;

  function cambiarCurso(id: string) {
    setCursoSel(id);
    setErrorCurso("");
  }

  function siguienteConPendientes() {
    const idx = conAlumnos.findIndex((c) => c.id === cursoSel);
    const orden = [...conAlumnos.slice(idx + 1), ...conAlumnos.slice(0, idx + 1)];
    const siguiente = orden.find((c) => c.id !== cursoSel && c.alumnos.some((a) => !a.procesado));
    if (siguiente) cambiarCurso(siguiente.id);
  }

  function elegir(alumnoId: string, cambios: Partial<Eleccion> | null) {
    setErrorCurso("");
    setElecciones((prev) => {
      const nuevo = { ...prev };
      if (cambios === null) {
        delete nuevo[alumnoId];
        return nuevo;
      }
      const actual = prev[alumnoId] ?? { accion: "promover" as Accion, destino: "" };
      const siguiente = { ...actual, ...cambios };
      // Al elegir "Promover", el destino arranca en la sugerencia del curso.
      if (cambios.accion === "promover" && !actual.destino && cambios.destino === undefined) {
        siguiente.destino = curso?.sugerencia.cursoDestinoId ?? "";
      }
      nuevo[alumnoId] = siguiente;
      return nuevo;
    });
  }

  function aplicarSugerencias() {
    if (!curso) return;
    const accion: Accion = curso.sugerencia.accion === "egresar" ? "egresar" : "promover";
    const destino = accion === "promover" ? curso.sugerencia.cursoDestinoId ?? "" : "";
    setErrorCurso("");
    setElecciones((prev) => {
      const nuevo = { ...prev };
      for (const a of pendientesCurso) nuevo[a.id] = { accion, destino };
      return nuevo;
    });
  }

  const elegidos = pendientesCurso.filter((a) => elecciones[a.id]);
  const sinDestino = elegidos.filter((a) => elecciones[a.id].accion === "promover" && !elecciones[a.id].destino);

  /** "28 promueven a 2º A, 2 repiten, 1 baja". */
  const resumenCurso = useMemo(() => {
    const promoPorDestino = new Map<string, number>();
    const cuentas = { repetir: 0, egresar: 0, baja: 0 };
    for (const a of pendientesCurso) {
      const e = elecciones[a.id];
      if (!e) continue;
      if (e.accion === "promover") promoPorDestino.set(e.destino, (promoPorDestino.get(e.destino) ?? 0) + 1);
      else cuentas[e.accion]++;
    }
    const partes: string[] = [];
    for (const [destino, n] of promoPorDestino) {
      const c = porId.get(destino);
      partes.push(`${n} ${n === 1 ? "promueve" : "promueven"} a ${c ? etiquetaCurso(c) : "un curso sin elegir"}`);
    }
    if (cuentas.repetir) partes.push(`${cuentas.repetir} ${cuentas.repetir === 1 ? "repite" : "repiten"}`);
    if (cuentas.egresar) partes.push(`${cuentas.egresar} ${cuentas.egresar === 1 ? "egresa" : "egresan"}`);
    if (cuentas.baja) partes.push(`${cuentas.baja} ${cuentas.baja === 1 ? "se da de baja" : "se dan de baja"}`);
    return partes.join(", ");
  }, [pendientesCurso, elecciones, porId]);

  function pedirConfirmacionCurso() {
    if (elegidos.length === 0) {
      setErrorCurso("Elegí una acción para al menos un alumno (o usá “Aplicar sugerencias del curso”).");
      return;
    }
    if (sinDestino.length > 0) {
      setErrorCurso(
        `Elegí el curso destino para ${plural(sinDestino.length, "alumno que promueve", "alumnos que promueven")}.`
      );
      return;
    }
    setErrorCurso("");
    setConfirmarCurso(true);
  }

  async function enviarCurso() {
    if (!curso) return;
    const movimientos: Movimiento[] = elegidos.map((a) => {
      const e = elecciones[a.id];
      const m: Movimiento = { alumnoId: Number(a.id), accion: e.accion };
      if (e.accion === "promover") m.cursoDestinoId = Number(e.destino);
      return m;
    });
    setEnviando(true);
    let procesados = 0;
    try {
      for (let i = 0; i < movimientos.length; i += MAX_LOTE) {
        const lote = movimientos.slice(i, i + MAX_LOTE);
        await apiSend<RespuestaPost>("/promocion.php", "POST", { movimientos: lote });
        procesados += lote.length;
      }
      setConfirmarCurso(false);
      setElecciones((prev) => {
        const nuevo = { ...prev };
        for (const m of movimientos) delete nuevo[String(m.alumnoId)];
        return nuevo;
      });
      push(`${etiquetaCurso(curso)}: ${plural(procesados, "alumno procesado", "alumnos procesados")}`);
    } catch (error) {
      setConfirmarCurso(false);
      const detalle = mensajeError(error, "No se pudo aplicar la promoción");
      setErrorCurso(procesados > 0 ? `Se procesaron ${procesados} alumnos, pero falló el resto: ${detalle}` : detalle);
      push(detalle, "error");
    } finally {
      setEnviando(false);
      if (procesados > 0) onCambio?.();
      await cargar();
    }
  }

  async function cerrarCiclo() {
    if (!vista) return;
    setEnviando(true);
    try {
      await apiSend<RespuestaPost>("/promocion.php", "POST", { movimientos: [], cerrarCiclo: true });
      setConfirmarCierre(false);
      push(`Ciclo ${vista.ciclo.anio} cerrado. Se abrió el ciclo ${vista.ciclo.anio + 1}.`);
      onCambio?.();
    } catch (error) {
      setConfirmarCierre(false);
      push(mensajeError(error, "No se pudo cerrar el ciclo"), "error");
    } finally {
      setEnviando(false);
      await cargar();
    }
  }

  if (cargando && !vista) {
    return (
      <div className="card card-pad-lg">
        <p className="muted text-sm" role="status">Cargando promoción del ciclo...</p>
      </div>
    );
  }

  if (!vista) {
    return (
      <div className="card card-pad-lg promocion__error">
        <p className="asistencia-dashboard__error" role="alert">{errorCarga || "No se pudo cargar la promoción del ciclo"}</p>
        <button type="button" className="btn btn-soft btn-sm" onClick={() => void cargar()}>Reintentar</button>
      </div>
    );
  }

  const anio = vista.ciclo.anio;
  const hayOtroConPendientes = conAlumnos.some((c) => c.id !== cursoSel && c.alumnos.some((a) => !a.procesado));

  return (
    <div className="promocion">
      <div className="card card-pad-lg">
        <div className="row spread row-wrap promocion__head">
          <div className="row row-wrap promocion__titulo">
            <h3>Ciclo lectivo {anio}</h3>
            <span className={`badge ${cerrado ? "" : "badge-success"}`}>{cerrado ? "Cerrado" : "Abierto"}</span>
            {!cerrado && (
              <span className={`badge ${vista.pendientes > 0 ? "badge-warning" : "badge-brand"}`}>
                {vista.pendientes > 0 ? plural(vista.pendientes, "alumno pendiente", "alumnos pendientes") : "Sin pendientes"}
              </span>
            )}
          </div>
          {!cerrado && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={vista.pendientes !== 0 || enviando || cargando}
              onClick={() => setConfirmarCierre(true)}
              title={vista.pendientes !== 0 ? "Procesá a todos los alumnos para poder cerrar el ciclo" : undefined}
            >
              Cerrar ciclo {anio}
            </button>
          )}
        </div>
        <p className="muted text-sm promocion__ayuda">
          {cerrado
            ? `El ciclo ${anio} está cerrado${vista.ciclo.cerradoEn ? ` desde el ${vista.ciclo.cerradoEn.slice(0, 10).split("-").reverse().join("/")}` : ""}. Solo podés consultar cómo quedó.`
            : "Elegí qué pasa con cada alumno al terminar el año: promueve al curso siguiente, repite, egresa (solo 7º) o se da de baja. Confirmá curso por curso; el ciclo se puede cerrar cuando no queden pendientes."}
        </p>
        {errorCarga && (
          <div className="promocion__error">
            <p className="asistencia-dashboard__error" role="alert">{errorCarga}</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => void cargar()}>Reintentar</button>
          </div>
        )}
      </div>

      <div className="card card-pad-lg">
        {conAlumnos.length === 0 ? (
          <EmptyState icon="🎓" title="No hay alumnos activos" description="No quedan alumnos con curso asignado para procesar en este ciclo." />
        ) : (
          <>
            <div className="row row-wrap promocion__selector">
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="promocion-curso">Curso</label>
                <select
                  id="promocion-curso"
                  className="select"
                  value={cursoSel}
                  onChange={(e) => cambiarCurso(e.target.value)}
                >
                  {conAlumnos.map((c) => {
                    const pend = c.alumnos.filter((a) => !a.procesado).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {etiquetaCurso(c)} · {pend > 0 ? plural(pend, "pendiente", "pendientes") : "listo"}
                      </option>
                    );
                  })}
                </select>
              </div>
              {!cerrado && hayOtroConPendientes && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={siguienteConPendientes}>
                  Siguiente curso con pendientes →
                </button>
              )}
            </div>

            {curso && (
              <>
                <div className="row spread row-wrap promocion__curso-head">
                  <div>
                    <h3>{etiquetaCurso(curso)}</h3>
                    <p className="muted text-sm promocion__sugerencia">
                      Sugerencia:{" "}
                      {curso.sugerencia.accion === "egresar"
                        ? "egresan"
                        : destinoSugerido
                          ? `promueven a ${etiquetaCurso(destinoSugerido)}`
                          : "promueven, pero no hay un curso equivalente: elegí el destino de cada alumno"}
                      {" · "}
                      {plural(pendientesCurso.length, "pendiente", "pendientes")} de {curso.alumnos.length}
                    </p>
                  </div>
                  {!cerrado && pendientesCurso.length > 0 && (
                    <div className="row row-wrap promocion__acciones">
                      <button type="button" className="btn btn-soft btn-sm" onClick={aplicarSugerencias} disabled={enviando}>
                        Aplicar sugerencias del curso
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={pedirConfirmacionCurso}
                        disabled={enviando || elegidos.length === 0}
                      >
                        {enviando ? "Aplicando..." : `Confirmar curso${elegidos.length ? ` (${elegidos.length})` : ""}`}
                      </button>
                    </div>
                  )}
                </div>

                {errorCurso && (
                  <p className="asistencia-dashboard__error promocion__error-curso" role="alert">{errorCurso}</p>
                )}

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th style={{ width: 170 }}>Acción</th>
                        <th style={{ width: 170 }}>Curso destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {curso.alumnos.map((a) => {
                        const nombre = nombreAlumno(a);
                        if (a.procesado) {
                          const b = PROCESADO_BADGE[a.procesado];
                          return (
                            <tr key={a.id} className="promocion__procesado">
                              <td style={{ fontWeight: 600 }}>{nombre}</td>
                              <td colSpan={2}><span className={`badge ${b.cls}`}>{b.label}</span></td>
                            </tr>
                          );
                        }
                        const e = elecciones[a.id];
                        const faltaDestino = e?.accion === "promover" && !e.destino;
                        return (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 600 }}>{nombre}</td>
                            <td>
                              <select
                                className="select"
                                aria-label={`Acción para ${nombre}`}
                                value={e?.accion ?? ""}
                                disabled={cerrado || enviando}
                                onChange={(ev) =>
                                  elegir(a.id, ev.target.value ? { accion: ev.target.value as Accion } : null)
                                }
                              >
                                <option value="">Sin elegir</option>
                                {!esUltimo && <option value="promover">{ACCION_TEXTO.promover}</option>}
                                <option value="repetir">{ACCION_TEXTO.repetir}</option>
                                {esUltimo && <option value="egresar">{ACCION_TEXTO.egresar}</option>}
                                <option value="baja">{ACCION_TEXTO.baja}</option>
                              </select>
                            </td>
                            <td>
                              {e?.accion === "promover" ? (
                                <div className="promocion__destino">
                                  <select
                                    className="select"
                                    aria-label={`Curso destino para ${nombre}`}
                                    aria-invalid={faltaDestino || undefined}
                                    value={e.destino}
                                    disabled={cerrado || enviando}
                                    onChange={(ev) => elegir(a.id, { destino: ev.target.value })}
                                  >
                                    <option value="">Elegí destino…</option>
                                    {destinos.map((d) => (
                                      <option key={d.id} value={d.id}>{etiquetaCurso(d)}</option>
                                    ))}
                                  </select>
                                  {faltaDestino && <span className="badge badge-warning">Elegí destino</span>}
                                </div>
                              ) : (
                                <span className="muted text-sm">
                                  {e?.accion === "repetir" ? etiquetaCurso(curso) : "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmarCurso}
        title={curso ? `Confirmar ${etiquetaCurso(curso)}` : "Confirmar curso"}
        message={`${resumenCurso}.${
          elegidos.length < pendientesCurso.length
            ? ` ${plural(pendientesCurso.length - elegidos.length, "alumno queda pendiente", "alumnos quedan pendientes")}.`
            : ""
        } Cada alumno se procesa una sola vez en el ciclo ${anio}.`}
        confirmLabel={enviando ? "Aplicando..." : "Confirmar"}
        danger={false}
        onConfirm={() => {
          if (!enviando) void enviarCurso();
        }}
        onCancel={() => {
          if (!enviando) setConfirmarCurso(false);
        }}
      />

      <ConfirmDialog
        open={confirmarCierre}
        title={`Cerrar ciclo ${anio}`}
        message={`Esta acción no se puede deshacer: el ciclo ${anio} queda cerrado (no se podrán procesar más alumnos en él) y se abre el ciclo ${anio + 1}.`}
        confirmLabel={enviando ? "Cerrando..." : `Cerrar ciclo ${anio}`}
        onConfirm={() => {
          if (!enviando) void cerrarCiclo();
        }}
        onCancel={() => {
          if (!enviando) setConfirmarCierre(false);
        }}
      />
    </div>
  );
}
