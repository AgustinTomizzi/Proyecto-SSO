import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { useToast } from "../../components/ui/Toast";
import { esMismaMateria } from "../../data/types";
import type { Alumno, EstadoCargable } from "../../data/types";
import { apiGet } from "../../data/apiClient";
import { hoyLocal } from "../../data/fecha";
import { useAuth } from "../../auth/AuthContext";
import SuplenciasPanel from "../suplencias/SuplenciasPanel";
import JustificacionesPanel from "../justificaciones/JustificacionesPanel";
import { alCambiarCola, encolar, esErrorDeRed, pendientes, sincronizar } from "../../data/colaAsistencia";
import "./PreceptorPage.css";

const ESTADOS: { key: EstadoCargable; label: string; cls: string }[] = [
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
  justificadas?: string | number;
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


function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación";
}

export default function PreceptorPage() {
  const { cursos, alumnos, registros, materias, marcarAsistencia, editarAlumno, borrarAlumno, reintentarCarga } = useStore();
  const { usuario } = useAuth();
  const puedeSuplir = usuario?.permisos.includes("suplencias.crear") ?? false;
  const puedeJustificar = usuario?.permisos.includes("asistencia.justificar") ?? false;
  const { push } = useToast();
  const opcionesCurso = useMemo(() => cursos.map((c) => ({ ...c, label: `${c.anio} ${c.division}` })), [cursos]);
  const [curso, setCurso] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [fecha, setFecha] = useState(hoyLocal);
  const [estado, setEstado] = useState<Record<string, EstadoCargable>>({});
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enCola, setEnCola] = useState(0);
  const [sincronizandoCola, setSincronizandoCola] = useState(false);
  const usuarioId = usuario?.id ?? "";

  // Cola sin conexión (PWA): contador y reenvío automático al volver la red.
  const enviandoRef = useRef(false);
  const enviarPendientes = useCallback(async () => {
    // Un solo envío a la vez (el evento online y el botón pueden coincidir).
    if (!usuarioId || enviandoRef.current) return;
    enviandoRef.current = true;
    setSincronizandoCola(true);
    try {
      const resultado = await sincronizar(usuarioId);
      if (resultado.enviadas > 0) {
        push(`Se enviaron ${resultado.enviadas} ${resultado.enviadas === 1 ? "marca pendiente" : "marcas pendientes"} de asistencia`);
        reintentarCarga();
      }
      if (resultado.rechazadas.length > 0) {
        push(`El servidor rechazó ${resultado.rechazadas.length} ${resultado.rechazadas.length === 1 ? "marca" : "marcas"}: ${resultado.rechazadas[0].error}`, "error");
      }
    } finally {
      enviandoRef.current = false;
      setSincronizandoCola(false);
    }
  }, [usuarioId, push, reintentarCarga]);

  useEffect(() => {
    if (!usuarioId) return;
    let vigente = true;
    const contar = () => { void pendientes(usuarioId).then((lista) => vigente && setEnCola(lista.length)).catch(() => undefined); };
    contar();
    const quitarSuscripcion = alCambiarCola(contar);
    const alVolver = () => { void enviarPendientes(); };
    window.addEventListener("online", alVolver);
    if (navigator.onLine) alVolver();
    return () => { vigente = false; quitarSuscripcion(); window.removeEventListener("online", alVolver); };
  }, [usuarioId, enviarPendientes]);
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

  useEffect(() => {
    if (!materias.some((m) => m.id === materiaId)) setMateriaId(materias[0]?.id ?? "");
  }, [materiaId, materias]);

  const materia = useMemo(
    () => materias.find((m) => m.id === materiaId) ?? null,
    [materias, materiaId]
  );

  const alumnosCurso = useMemo(
    () => alumnos.filter((a) => a.curso === curso),
    [alumnos, curso]
  );

  useEffect(() => {
    const inicial: Record<string, EstadoCargable> = {};
    for (const alumno of alumnosCurso) {
      const registro = registros.find(
        (r) => materia !== null && r.alumnoId === alumno.id && esMismaMateria(r, materia) && r.fecha === fecha
      );
      // Una ausencia justificada se muestra como Ausente con la marca "Justificada".
      inicial[alumno.id] = registro?.estado === "justificado" ? "ausente" : registro?.estado ?? "presente";
    }
    setEstado(inicial);
  }, [alumnosCurso, materia, fecha, registros]);

  // Alumnos con la ausencia de ese día y materia justificada.
  const justificados = useMemo(() => new Set(
    registros
      .filter((r) => materia !== null && r.fecha === fecha && r.estado === "justificado" && esMismaMateria(r, materia))
      .map((r) => r.alumnoId)
  ), [registros, materia, fecha]);

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
    if (!materia) {
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
      if (esErrorDeRed(error)) {
        // Sin conexión: la clase entera queda en el teléfono (solo ids) y se reenvía sola.
        await encolar(alumnosCurso.map((a) => ({ alumnoId: a.id, materiaId: materia.id, fecha, estado: estado[a.id] ?? "presente", usuarioId })));
        setGuardado(true);
        push("Sin conexión: la asistencia quedó guardada en este dispositivo y se envía sola al volver la red", "info");
      } else {
        push(mensajeError(error), "error");
      }
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
      </div>

      <div className="grid grid-3 attendance-role-kpis" style={{ marginBottom: 18 }}>
        <div className="stat stat--success"><div className="stat__icon">✓</div><div className="stat__label">Presentes</div><div className="stat__value">{conteo.presente}</div><div className="stat__hint">En el curso seleccionado</div></div>
        <div className="stat stat--warning"><div className="stat__icon">◷</div><div className="stat__label">Tardanzas</div><div className="stat__value">{conteo.tarde}</div><div className="stat__hint">En la clase actual</div></div>
        <div className="stat stat--danger"><div className="stat__icon">×</div><div className="stat__label">Ausentes</div><div className="stat__value">{conteo.ausente}</div><div className="stat__hint">Requieren seguimiento</div></div>
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
          <select className="select" value={materiaId} onChange={(e) => { setMateriaId(e.target.value); setGuardado(false); }} disabled={materias.length === 0}>
            {materias.length === 0 && <option value="">Sin materias</option>}
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
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
            <thead><tr><th>Nombre</th><th>Apellido</th><th className="col-secundaria">DNI</th><th className="col-secundaria">Curso</th><th className="col-secundaria">División</th><th className="col-secundaria">Email</th><th>Asistencia</th><th aria-label="Acciones" /></tr></thead>
            <tbody>
              {alumnosCurso.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                  <td>{a.apellido || "—"}</td>
                  <td className="col-secundaria">{a.dni || "—"}</td>
                  <td className="col-secundaria">{a.curso.replace(/\s+[^\s]+$/, "") || a.curso}</td>
                  <td className="col-secundaria">{a.division || "—"}</td>
                  <td className="muted text-sm col-secundaria">{a.email}</td>
                  <td><div className="estado-group">{ESTADOS.map((e) => (
                    <button key={e.key} className={`estado-btn ${e.cls} ${(estado[a.id] ?? "presente") === e.key ? "on" : ""}`} onClick={() => { setEstado((prev) => ({ ...prev, [a.id]: e.key })); setGuardado(false); }}>{e.label}</button>
                  ))}{(estado[a.id] ?? "presente") === "ausente" && justificados.has(a.id) && <span className="badge badge-info" style={{ marginLeft: 8 }}>Justificada</span>}</div></td>
                  <td className="alumno-menu-cell">
                    <button className="btn btn-ghost btn-sm alumno-menu-trigger" aria-label={`Acciones para ${a.nombre} ${a.apellido}`} onClick={() => setMenuId(menuId === a.id ? null : a.id)}>⋮</button>
                    {menuId === a.id && <div className="alumno-menu"><button onClick={() => void abrirHistorial(a)}>Ver historial</button><button onClick={() => abrirAccion("curso", a)}>Cambiar curso</button><button className="danger" onClick={() => abrirAccion("baja", a)}>Dar de baja</button></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {enCola > 0 && (
          <div className="cola-pendiente" role="status">
            <span><strong>{enCola} {enCola === 1 ? "marca pendiente" : "marcas pendientes"} de enviar.</strong> Se envían solas cuando vuelve la conexión.</span>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => void enviarPendientes()} disabled={sincronizandoCola}>{sincronizandoCola ? "Enviando..." : "Reintentar"}</button>
          </div>
        )}
        <div className="spread row" style={{ marginTop: 18 }}>
          <span className={guardado ? "badge badge-success" : "muted text-sm"}>{guardado ? "Registro guardado" : "Los cambios se aplican después de confirmarlos en el sistema."}</span>
          <button className={`btn ${guardado ? "btn-success" : "btn-primary"}`} onClick={guardar} disabled={guardando || guardado || !materia}>{guardando ? "Guardando..." : guardado ? "Guardado" : "Guardar registro"}</button>
        </div>
      </div>

      {puedeSuplir && (
        <section className="suplencias-seccion" aria-labelledby="mis-suplencias-titulo">
          <div className="page-head">
            <div>
              <h2 id="mis-suplencias-titulo">Mis suplencias</h2>
              <p className="sub">Cubrí temporalmente otro curso cuando falta su preceptor.</p>
            </div>
          </div>
          <SuplenciasPanel onCambio={reintentarCarga} />
        </section>
      )}

      {puedeJustificar && (
        <section className="justificaciones-seccion" aria-labelledby="justificaciones-titulo">
          <div className="page-head">
            <div>
              <h2 id="justificaciones-titulo">Justificaciones</h2>
              <p className="sub">Justificá inasistencias de tus alumnos, con certificado si hace falta.</p>
            </div>
          </div>
          <JustificacionesPanel onCambio={reintentarCarga} />
        </section>
      )}

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
                <div className="table-wrap"><table className="table"><thead><tr><th>Materia</th><th>Porcentaje</th><th>Clases</th><th>Presentes</th><th>Tardes</th><th>Ausentes</th><th>Justificadas</th></tr></thead><tbody>{items.map((item) => <tr key={`${ciclo}-${item.materia}`}><td style={{ fontWeight: 600 }}>{item.materia}</td><td>{item.porcentaje}%</td><td>{item.clases}</td><td>{item.presentes}</td><td>{item.tardes}</td><td>{item.ausentes}</td><td>{item.justificadas ?? 0}</td></tr>)}</tbody></table></div>
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
