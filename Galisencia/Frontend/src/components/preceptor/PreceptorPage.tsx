import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { useToast } from "../../components/ui/Toast";
import { MATERIAS } from "../../data/types";
import type { Alumno, EstadoAsistencia } from "../../data/types";
import { apiGet } from "../../data/apiClient";
import "./PreceptorPage.css";

const ESTADOS: { key: EstadoAsistencia; label: string; cls: string }[] = [
  { key: "presente", label: "Presente", cls: "presente" },
  { key: "tarde", label: "Tarde", cls: "tarde" },
  { key: "ausente", label: "Ausente", cls: "ausente" },
];

type Accion = { tipo: "curso" | "baja"; alumno: Alumno } | null;

interface HistorialAsistencia {
  ciclo: string | number;
  materia: string;
  porcentaje: string | number;
  clases: string | number;
  presentes: string | number;
  tardes: string | number;
  ausentes: string | number;
}

interface HistorialMovimiento {
  id: string | number;
  tipo: string;
  fecha: string;
  cursoOrigen: string | null;
  cursoDestino: string | null;
  realizadoPor: string;
}

interface HistorialResponse {
  ok: true;
  asistencia: HistorialAsistencia[];
  movimientos: HistorialMovimiento[];
}

interface HistorialState {
  alumno: Alumno;
  loading: boolean;
  error: string;
  data?: HistorialResponse;
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación";
}

export default function PreceptorPage() {
  const { cursos, alumnos, registros, marcarAsistencia, editarAlumno, borrarAlumno } = useStore();
  const { push } = useToast();
  const opcionesCurso = useMemo(() => cursos.map((c) => ({ ...c, label: `${c.anio} ${c.division}` })), [cursos]);
  const [curso, setCurso] = useState("");
  const [materia, setMateria] = useState(MATERIAS[0]);
  const [fecha, setFecha] = useState(hoy());
  const [estado, setEstado] = useState<Record<string, EstadoAsistencia>>({});
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion>(null);
  const [nuevoCurso, setNuevoCurso] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [historial, setHistorial] = useState<HistorialState | null>(null);

  useEffect(() => {
    if (!opcionesCurso.some((c) => c.label === curso)) setCurso(opcionesCurso[0]?.label ?? "");
  }, [curso, opcionesCurso]);

  const alumnosCurso = useMemo(
    () => alumnos.filter((a) => a.curso === curso),
    [alumnos, curso]
  );

  useEffect(() => {
    const inicial: Record<string, EstadoAsistencia> = {};
    for (const alumno of alumnosCurso) {
      const registro = registros.find(
        (r) => r.alumnoId === alumno.id && r.materia === materia && r.fecha === fecha
      );
      inicial[alumno.id] = registro?.estado ?? "presente";
    }
    setEstado(inicial);
  }, [alumnosCurso, materia, fecha, registros]);

  const conteo = useMemo(() => {
    const total = { presente: 0, tarde: 0, ausente: 0 };
    for (const alumno of alumnosCurso) total[estado[alumno.id] ?? "presente"]++;
    return total;
  }, [alumnosCurso, estado]);

  async function guardar() {
    if (!fecha || Number.isNaN(Date.parse(`${fecha}T00:00:00`))) {
      push("Seleccioná una fecha válida", "error");
      return;
    }
    if (!materia || !MATERIAS.includes(materia)) {
      push("Seleccioná una materia válida", "error");
      return;
    }
    if (!curso || alumnosCurso.length === 0) {
      push("El curso seleccionado no tiene alumnos", "error");
      return;
    }
    setGuardando(true);
    try {
      await Promise.all(
        alumnosCurso.map((a) => marcarAsistencia(a.id, fecha, materia, estado[a.id] ?? "presente"))
      );
      setGuardado(true);
      push("Registro de asistencia guardado");
    } catch (error) {
      push(mensajeError(error), "error");
    } finally {
      setGuardando(false);
    }
  }

  function abrirAccion(tipo: "curso" | "baja", alumno: Alumno) {
    setAccion({ tipo, alumno });
    setNuevoCurso(alumno.curso);
    setCurrentPassword("");
    setErrorModal("");
    setMenuId(null);
  }

  async function abrirHistorial(alumno: Alumno) {
    setMenuId(null);
    setHistorial({ alumno, loading: true, error: "" });
    try {
      const data = await apiGet<HistorialResponse>(
        `/historial_alumno.php?id=${encodeURIComponent(alumno.id)}`
      );
      setHistorial((actual) =>
        actual?.alumno.id === alumno.id ? { alumno, loading: false, error: "", data } : actual
      );
    } catch (error) {
      setHistorial((actual) =>
        actual?.alumno.id === alumno.id
          ? { alumno, loading: false, error: mensajeError(error) }
          : actual
      );
    }
  }

  const asistenciaPorCiclo = useMemo(() => {
    const grupos = new Map<string, HistorialAsistencia[]>();
    for (const item of historial?.data?.asistencia ?? []) {
      const ciclo = String(item.ciclo);
      grupos.set(ciclo, [...(grupos.get(ciclo) ?? []), item]);
    }
    return [...grupos.entries()];
  }, [historial?.data?.asistencia]);

  function cerrarModal() {
    if (procesando) return;
    setAccion(null);
    setErrorModal("");
  }

  async function confirmarAccion() {
    if (!accion || !currentPassword.trim()) {
      setErrorModal("Ingresá tu contraseña actual");
      return;
    }
    if (accion.tipo === "curso" && (!nuevoCurso || nuevoCurso === accion.alumno.curso)) {
      setErrorModal("Seleccioná un curso diferente");
      return;
    }
    setProcesando(true);
    setErrorModal("");
    try {
      if (accion.tipo === "baja") {
        await borrarAlumno(accion.alumno.id, currentPassword);
        push("Alumno dado de baja");
      } else {
        const destino = opcionesCurso.find((c) => c.label === nuevoCurso);
        if (!destino) throw new Error("Curso inválido");
        await editarAlumno(accion.alumno.id, {
          ...accion.alumno,
          curso: destino.label,
          cursoId: String(destino.id),
          division: destino.division,
          currentPassword,
        });
        push("Curso actualizado");
      }
      setAccion(null);
    } catch (error) {
      setErrorModal(mensajeError(error));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Registrar asistencia</h1>
          <p className="sub">Gestioná la asistencia de tus cursos.</p>
        </div>
        <div className="row row-wrap">
          <span className="badge badge-success"><span className="dot dot-success" /> {conteo.presente} presentes</span>
          <span className="badge badge-warning">{conteo.tarde} tardes</span>
          <span className="badge badge-danger">{conteo.ausente} ausentes</span>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Curso</label>
          <select className="select" value={curso} onChange={(e) => { setCurso(e.target.value); setGuardado(false); }}>
            {opcionesCurso.map((c) => <option key={c.id} value={c.label}>{c.label} · {c.turno}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Materia</label>
          <select className="select" value={materia} onChange={(e) => { setMateria(e.target.value); setGuardado(false); }}>
            {MATERIAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Fecha</label>
          <input className="input" type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setGuardado(false); }} />
        </div>
      </div>

      <div className="card card-pad-lg">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Apellido</th><th>DNI</th><th>Curso</th><th>División</th><th>Email</th><th>Asistencia</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {alumnosCurso.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                  <td>{a.apellido || "—"}</td>
                  <td>{a.dni || "—"}</td>
                  <td>{a.curso.replace(/\s+[^\s]+$/, "") || a.curso}</td>
                  <td>{a.division || "—"}</td>
                  <td className="muted text-sm">{a.email}</td>
                  <td><div className="estado-group">{ESTADOS.map((e) => (
                    <button key={e.key} className={`estado-btn ${e.cls} ${(estado[a.id] ?? "presente") === e.key ? "on" : ""}`} onClick={() => { setEstado((prev) => ({ ...prev, [a.id]: e.key })); setGuardado(false); }}>{e.label}</button>
                  ))}</div></td>
                  <td className="alumno-menu-cell">
                    <button className="btn btn-ghost btn-sm alumno-menu-trigger" aria-label={`Acciones para ${a.nombre} ${a.apellido}`} onClick={() => setMenuId(menuId === a.id ? null : a.id)}>⋮</button>
                    {menuId === a.id && <div className="alumno-menu"><button onClick={() => void abrirHistorial(a)}>Ver historial</button><button onClick={() => abrirAccion("curso", a)}>Cambiar curso</button><button className="danger" onClick={() => abrirAccion("baja", a)}>Dar de baja</button></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="spread row" style={{ marginTop: 18 }}>
          <span className={guardado ? "badge badge-success" : "muted text-sm"}>{guardado ? "Registro guardado" : "Los cambios se aplican después de confirmarlos en el sistema."}</span>
          <button className={`btn ${guardado ? "btn-success" : "btn-primary"}`} onClick={guardar} disabled={guardando || guardado}>{guardando ? "Guardando..." : guardado ? "Guardado" : "Guardar registro"}</button>
        </div>
      </div>

      {accion && <div className="modal-overlay" onClick={cerrarModal}>
        <div className="modal" role="dialog" aria-modal="true" aria-label={accion.tipo === "curso" ? "Cambiar curso" : "Dar de baja"} onClick={(e) => e.stopPropagation()}>
          <h3 className="modal__title">{accion.tipo === "curso" ? "Cambiar curso" : "Dar de baja"}</h3>
          <p className="modal__msg">{accion.alumno.nombre} {accion.alumno.apellido}</p>
          {accion.tipo === "curso" && <div className="field"><label>Nuevo curso</label><select className="select" value={nuevoCurso} onChange={(e) => setNuevoCurso(e.target.value)}>{opcionesCurso.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}</select></div>}
          <div className="field"><label>Contraseña actual</label><input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
          {errorModal && <p className="asistencia-dashboard__error" role="alert">{errorModal}</p>}
          <div className="modal__actions"><button className="btn btn-ghost" onClick={cerrarModal} disabled={procesando}>Cancelar</button><button className={`btn ${accion.tipo === "baja" ? "btn-danger" : "btn-primary"}`} onClick={confirmarAccion} disabled={procesando}>{procesando ? "Procesando..." : "Confirmar"}</button></div>
        </div>
      </div>}

      {historial && <div className="modal-overlay" onClick={() => setHistorial(null)}>
        <div className="modal historial-modal" role="dialog" aria-modal="true" aria-label="Historial del alumno" onClick={(e) => e.stopPropagation()}>
          <div className="historial-modal__head">
            <div><h3 className="modal__title">Historial del alumno</h3><p className="modal__msg">{historial.alumno.nombre} {historial.alumno.apellido}</p></div>
            <button className="btn btn-ghost btn-sm" aria-label="Cerrar historial" onClick={() => setHistorial(null)}>Cerrar</button>
          </div>

          {historial.loading && <p className="historial-estado">Cargando historial...</p>}
          {historial.error && <div className="historial-estado"><p className="asistencia-dashboard__error" role="alert">{historial.error}</p><button className="btn btn-soft btn-sm" onClick={() => void abrirHistorial(historial.alumno)}>Reintentar</button></div>}

          {historial.data && <div className="historial-contenido">
            <section>
              <h4>Asistencia por ciclo y materia</h4>
              {asistenciaPorCiclo.length === 0 ? <p className="muted text-sm">No hay registros de asistencia.</p> : asistenciaPorCiclo.map(([ciclo, items]) => <div className="historial-ciclo" key={ciclo}>
                <h5>Ciclo {ciclo}</h5>
                <div className="table-wrap"><table className="table"><thead><tr><th>Materia</th><th>Porcentaje</th><th>Clases</th><th>Presentes</th><th>Tardes</th><th>Ausentes</th></tr></thead><tbody>{items.map((item) => <tr key={`${ciclo}-${item.materia}`}><td style={{ fontWeight: 600 }}>{item.materia}</td><td>{item.porcentaje}%</td><td>{item.clases}</td><td>{item.presentes}</td><td>{item.tardes}</td><td>{item.ausentes}</td></tr>)}</tbody></table></div>
              </div>)}
            </section>

            <section>
              <h4>Movimientos de curso y bajas</h4>
              {historial.data.movimientos.length === 0 ? <p className="muted text-sm">No hay movimientos registrados.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Origen</th><th>Destino</th><th>Actor</th></tr></thead><tbody>{historial.data.movimientos.map((movimiento) => <tr key={movimiento.id}><td>{movimiento.fecha.replace("T", " ")}</td><td>{movimiento.tipo.replaceAll("_", " ")}</td><td>{movimiento.cursoOrigen || "—"}</td><td>{movimiento.cursoDestino || "—"}</td><td>{movimiento.realizadoPor || "—"}</td></tr>)}</tbody></table></div>}
            </section>
          </div>}
        </div>
      </div>}
    </div>
  );
}
