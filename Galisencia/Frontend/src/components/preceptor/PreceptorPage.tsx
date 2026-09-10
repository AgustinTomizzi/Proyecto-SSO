import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { useToast } from "../../components/ui/Toast";
import { MATERIAS } from "../../data/types";
import type { EstadoAsistencia, Alumno } from "../../data/types";
import ReauthDialog from "../ui/ReauthDialog";
import { esErrorDeRed } from "../../data/apiClient";
import "./PreceptorPage.css";

const ESTADOS: { key: EstadoAsistencia; label: string; cls: string }[] = [
  { key: "presente", label: "Presente", cls: "presente" },
  { key: "tarde", label: "Tarde", cls: "tarde" },
  { key: "ausente", label: "Ausente", cls: "ausente" },
];

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PreceptorPage() {
  const { cursos, alumnos, registros, marcarAsistencia, editarAlumno, borrarAlumno } =
    useStore();
  const { push } = useToast();

  const [curso, setCurso] = useState(
    cursos[0] ? `${cursos[0].anio} ${cursos[0].division}` : ""
  );
  const [materia, setMateria] = useState(MATERIAS[0]);
  const [fecha, setFecha] = useState(hoy());
  const [estado, setEstado] = useState<Record<string, EstadoAsistencia>>({});
  const [guardado, setGuardado] = useState(false);

  // Menú de acciones por alumno (⋮)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<"baja" | "curso" | null>(null);
  const [alumnoActivo, setAlumnoActivo] = useState<Alumno | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [errorReauth, setErrorReauth] = useState<string | null>(null);

  const alumnosCurso = useMemo(
    () => alumnos.filter((a) => a.curso === curso),
    [alumnos, curso]
  );

  const cursosDisponibles = useMemo(
    () => cursos.map((c) => ({ value: `${c.anio} ${c.division}`, label: `${c.anio} ${c.division} · ${c.turno}` })),
    [cursos]
  );

  // Inicializa el estado de cada alumno a partir de lo ya guardado en el store
  useEffect(() => {
    const init: Record<string, EstadoAsistencia> = {};
    for (const a of alumnosCurso) {
      const r = registros.find(
        (x) => x.alumnoId === a.id && x.materia === materia && x.fecha === fecha
      );
      init[a.id] = r ? r.estado : "presente";
    }
    setEstado(init);
    setGuardado(false);
  }, [alumnosCurso, materia, fecha, registros]);

  const marcar = (id: string, e: EstadoAsistencia) =>
    setEstado((prev) => ({ ...prev, [id]: e }));

  const conteo = useMemo(() => {
    const c = { presente: 0, tarde: 0, ausente: 0 };
    for (const a of alumnosCurso) {
      c[estado[a.id] ?? "presente"]++;
    }
    return c;
  }, [alumnosCurso, estado]);

  const guardar = () => {
    if (!fecha) {
      push("Elegí una fecha antes de guardar el registro", "error");
      return;
    }
    for (const a of alumnosCurso) {
      marcarAsistencia(a.id, fecha, materia, estado[a.id] ?? "presente");
    }
    setGuardado(true);
    push("Registro de asistencia guardado");
    setTimeout(() => setGuardado(false), 2000);
  };

  const abrirDialogo = (accion: "baja" | "curso", alumno: Alumno) => {
    setAlumnoActivo(alumno);
    setDialogo(accion);
    setErrorReauth(null);
    setMenuAbierto(null);
  };

  const confirmarDialogo = async (contrasena: string, nuevoCurso?: string) => {
    if (!alumnoActivo) return;
    setConfirmando(true);
    setErrorReauth(null);
    try {
      if (dialogo === "baja") {
        await borrarAlumno(alumnoActivo.id, contrasena);
        push("Alumno dado de baja correctamente");
      } else if (nuevoCurso) {
        const aux = nuevoCurso.split(" ");
        await editarAlumno(
          alumnoActivo.id,
          { curso: nuevoCurso, anio: aux[0], division: aux[1] },
          contrasena
        );
        push("El alumno fue cambiado de curso");
      }
      setDialogo(null);
      setAlumnoActivo(null);
    } catch (err) {
      if (err instanceof Error && !esErrorDeRed(err)) {
        setErrorReauth(err.message);
      } else {
        setDialogo(null);
        setAlumnoActivo(null);
      }
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Registrar asistencia</h1>
          <p className="sub">Marcá la clase de hoy por curso.</p>
        </div>
        <div className="row row-wrap">
          <span className="badge badge-success">
            <span className="dot dot-success" /> {conteo.presente} presentes
          </span>
          <span className="badge badge-warning">{conteo.tarde} tardes</span>
          <span className="badge badge-danger">{conteo.ausente} ausentes</span>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Curso</label>
          <select
            className="select"
            value={curso}
            onChange={(e) => {
              setCurso(e.target.value);
              setGuardado(false);
            }}
          >
            {cursos.map((c) => {
              const label = `${c.anio} ${c.division}`;
              return (
                <option key={c.id} value={label}>
                  {label} · {c.turno}
                </option>
              );
            })}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Materia</label>
          <select className="select" value={materia} onChange={(e) => { setMateria(e.target.value); setGuardado(false); }}>
            {MATERIAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Fecha</label>
          <input
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => { setFecha(e.target.value); setGuardado(false); }}
          />
        </div>
      </div>

      <div className="card card-pad-lg">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th style={{ width: 320 }}>Asistencia de hoy</th>
              </tr>
            </thead>
            <tbody>
              {alumnosCurso.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.nombre}</div>
                    <div className="muted text-sm">{a.email}</div>
                  </td>
                  <td>
                    <div className="estado-group">
                      {ESTADOS.map((e) => (
                        <button
                          key={e.key}
                          className={`estado-btn ${e.cls} ${
                            (estado[a.id] ?? "presente") === e.key ? "on" : ""
                          }`}
                          onClick={() => marcar(a.id, e.key)}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="spread row" style={{ marginTop: 18 }}>
          {guardado ? (
            <span className="badge badge-success">✓ Registro guardado</span>
          ) : (
            <span className="muted text-sm">
              Los cambios se guardan en el sistema y se reflejan en los demás módulos.
            </span>
          )}
          <button
            className={`btn ${guardado ? "btn-success" : "btn-primary"}`}
            onClick={guardar}
            disabled={guardado}
          >
            {guardado ? "✓ Guardado" : "Guardar registro"}
          </button>
        </div>
      </div>

      <div className="card card-pad-lg" style={{ marginTop: 18 }}>
        <div className="row spread row-wrap" style={{ marginBottom: 14 }}>
          <div>
            <h3>Alumnos de mis cursos</h3>
            <p className="muted text-sm">
              Acciones sensibles (cambiar curso / dar de baja) requieren reingresar
              tu contraseña.
            </p>
          </div>
          <span className="badge badge-brand">{alumnos.length} alumnos</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>DNI</th>
                <th>Curso</th>
                <th>División</th>
                <th>Email</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.nombreSolo || a.nombre}</td>
                  <td>{a.apellido || "—"}</td>
                  <td>{a.dni || "—"}</td>
                  <td>{a.anio || "—"}</td>
                  <td>{a.division || "—"}</td>
                  <td className="muted text-sm">{a.email}</td>
                  <td>
                    <div className="acciones">
                      <button
                        className="acciones__btn"
                        title="Acciones"
                        onClick={() =>
                          setMenuAbierto((id) => (id === a.id ? null : a.id))
                        }
                      >
                        ⋮
                      </button>
                      {menuAbierto === a.id && (
                        <div className="acciones__menu">
                          <button onClick={() => abrirDialogo("curso", a)}>
                            🔄 Cambiar curso
                          </button>
                          <button
                            className="acciones__menu--danger"
                            onClick={() => abrirDialogo("baja", a)}
                          >
                            ⤓ Dar de baja
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {alumnos.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted text-center">
                    No tenés alumnos asignados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReauthDialog
        open={dialogo !== null}
        mode={dialogo ?? "baja"}
        alumnoNombre={alumnoActivo?.nombre ?? ""}
        cursos={dialogo === "curso" ? cursosDisponibles : undefined}
        error={errorReauth}
        loading={confirmando}
        onConfirm={confirmarDialogo}
        onCancel={() => {
          setDialogo(null);
          setAlumnoActivo(null);
        }}
      />
    </div>
  );
}