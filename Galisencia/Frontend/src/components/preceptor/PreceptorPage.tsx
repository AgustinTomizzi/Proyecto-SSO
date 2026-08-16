import { useMemo, useState } from "react";
import { getAlumnosPorCurso, getCursos } from "../../data/mock";
import type { EstadoAsistencia } from "../../data/types";
import { useToast } from "../../components/ui/Toast";
import "./PreceptorPage.css";

const ESTADOS: { key: EstadoAsistencia; label: string; cls: string }[] = [
  { key: "presente", label: "Presente", cls: "presente" },
  { key: "tarde", label: "Tarde", cls: "tarde" },
  { key: "ausente", label: "Ausente", cls: "ausente" },
];

export default function PreceptorPage() {
  const cursos = getCursos();
  const [curso, setCurso] = useState(cursos[0].anio + " " + cursos[0].division);
  const [estado, setEstado] = useState<Record<string, EstadoAsistencia>>({});
  const [guardado, setGuardado] = useState(false);

  const alumnos = useMemo(() => getAlumnosPorCurso(curso), [curso]);
  const { push } = useToast();

  const marcar = (id: string, e: EstadoAsistencia) =>
    setEstado((prev) => ({ ...prev, [id]: e }));

  const conteo = useMemo(() => {
    const c = { presente: 0, tarde: 0, ausente: 0 };
    for (const a of alumnos) c[estado[a.id] ?? "presente"]++;
    return c;
  }, [alumnos, estado]);

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

      <div className="subject-filter" style={{ marginBottom: 18 }}>
        {cursos.map((c) => {
          const label = `${c.anio} ${c.division}`;
          return (
            <button
              key={c.id}
              className={curso === label ? "on" : ""}
              onClick={() => {
                setCurso(label);
                setGuardado(false);
              }}
            >
              {label} · {c.turno}
            </button>
          );
        })}
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
            {alumnos.map((a) => (
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
            <span className="badge badge-success">✓ Registro guardado (demo)</span>
          ) : (
            <span className="muted text-sm">Los cambios son locales en esta demo.</span>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              setGuardado(true);
              push("Registro de asistencia guardado");
            }}
          >
            Guardar registro
          </button>
        </div>
      </div>
    </div>
  );
}
