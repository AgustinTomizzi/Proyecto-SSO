import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { useToast } from "../../components/ui/Toast";
import { MATERIAS } from "../../data/types";
import type { EstadoAsistencia } from "../../data/types";
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
  const { cursos, alumnos, registros, marcarAsistencia } = useStore();
  const { push } = useToast();

  const [curso, setCurso] = useState(cursos[0].anio + " " + cursos[0].division);
  const [materia, setMateria] = useState(MATERIAS[0]);
  const [fecha, setFecha] = useState(hoy());
  const [estado, setEstado] = useState<Record<string, EstadoAsistencia>>({});
  const [guardado, setGuardado] = useState(false);

  const alumnosCurso = useMemo(
    () => alumnos.filter((a) => a.curso === curso),
    [alumnos, curso]
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
    for (const a of alumnosCurso) {
      marcarAsistencia(a.id, fecha, materia, estado[a.id] ?? "presente");
    }
    setGuardado(true);
    push("Registro de asistencia guardado");
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
          <select className="select" value={materia} onChange={(e) => setMateria(e.target.value)}>
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
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="card card-pad-lg">
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

        <div className="spread row" style={{ marginTop: 18 }}>
          {guardado ? (
            <span className="badge badge-success">✓ Registro guardado</span>
          ) : (
            <span className="muted text-sm">
              Los cambios se guardan en el sistema y se reflejan en los demás módulos.
            </span>
          )}
          <button className="btn btn-primary" onClick={guardar}>
            Guardar registro
          </button>
        </div>
      </div>
    </div>
  );
}
