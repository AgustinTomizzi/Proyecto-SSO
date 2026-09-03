import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { MATERIAS } from "../../data/types";
import { useToast } from "../../components/ui/Toast";
import EmptyState from "../../components/ui/EmptyState";
import { apiGet } from "../../data/apiClient";

interface ResumenBackend {
  promedio: number;
  totalAlumnos: number;
  enRiesgo: number;
  porCurso: { curso: string; promedio: number; enRiesgo: number }[];
  alumnosEnRiesgo: { alumno: { id: string; nombre: string; curso: string; email: string }; general: number }[];
}

export default function ReportesPage() {
  const { alumnos, registros, cursos } = useStore();
  const [curso, setCurso] = useState("todos");
  const [materia, setMateria] = useState("todas");
  const { push } = useToast();
  const [backendData, setBackendData] = useState<ResumenBackend | null>(null);
  const [usingBackend, setUsingBackend] = useState(false);
  const [loadingBackend, setLoadingBackend] = useState(true);

  const CURSO_OPCIONES = useMemo(
    () => cursos.map((c) => `${c.anio} ${c.division}`),
    [cursos]
  );

  const alumnoMap = useMemo(() => {
    const m = new Map<string, (typeof alumnos)[number]>();
    alumnos.forEach((a) => m.set(a.id, a));
    return m;
  }, [alumnos]);

  // Cargar datos del backend si está disponible
  useEffect(() => {
    let cancelled = false;
    apiGet<{ ok: true; resumen: ResumenBackend }>("/reportes.php")
      .then((data) => {
        if (!cancelled) {
          setBackendData(data.resumen);
          setUsingBackend(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsingBackend(false);
          setBackendData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBackend(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      const a = alumnoMap.get(r.alumnoId);
      if (curso !== "todos" && a?.curso !== curso) return false;
      if (materia !== "todas" && r.materia !== materia) return false;
      return true;
    });
  }, [curso, materia, registros, alumnoMap]);

  const conteo = useMemo(() => {
    const c = { presente: 0, tarde: 0, ausente: 0 };
    for (const r of filtrados) c[r.estado]++;
    return c;
  }, [filtrados]);

  const exportarCSV = () => {
    if (filtrados.length === 0) {
      push("No hay registros para exportar", "info");
      return;
    }
    const header = "Fecha,Alumno,Curso,Materia,Estado\n";
    const rows = filtrados
      .map((r) => {
        const a = alumnoMap.get(r.alumnoId);
        return `${r.fecha},"${a?.nombre ?? r.alumnoId}",${a?.curso ?? ""},${r.materia},${r.estado}`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-asistencia-${curso}-${materia}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    push("Reporte exportado en CSV");
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reportes de asistencia</h1>
          <p className="sub">Filtra y exporta el registro de asistencia.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {usingBackend && (
            <span className="badge badge-success">Datos del backend</span>
          )}
          {!usingBackend && !loadingBackend && (
            <span className="badge badge-warning">Modo demo (mock)</span>
          )}
          <button className="btn btn-primary" onClick={exportarCSV}>
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label>Curso</label>
            <select className="select" value={curso} onChange={(e) => setCurso(e.target.value)}>
              <option value="todos">Todos los cursos</option>
              {CURSO_OPCIONES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Materia</label>
            <select className="select" value={materia} onChange={(e) => setMateria(e.target.value)}>
              <option value="todas">Todas las materias</option>
              {MATERIAS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row row-wrap" style={{ marginTop: 14 }}>
          <span className="badge badge-success">{conteo.presente} presentes</span>
          <span className="badge badge-warning">{conteo.tarde} tardes</span>
          <span className="badge badge-danger">{conteo.ausente} ausentes</span>
          <span className="badge">{filtrados.length} registros</span>
        </div>
      </div>

      {/* Resumen institucional del backend */}
      {usingBackend && backendData && (
        <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 16px" }}>Resumen institucional (backend)</h3>
          <div className="grid grid-4">
            <div className="stat">
              <div className="stat__label">Promedio general</div>
              <div className="stat__value">{backendData.promedio}%</div>
            </div>
            <div className="stat">
              <div className="stat__label">Total alumnos</div>
              <div className="stat__value">{backendData.totalAlumnos}</div>
            </div>
            <div className="stat">
              <div className="stat__label">En riesgo (&lt;75%)</div>
              <div className="stat__value" style={{ color: "var(--danger)" }}>{backendData.enRiesgo}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Cursos</div>
              <div className="stat__value">{backendData.porCurso.length}</div>
            </div>
          </div>
          {backendData.porCurso.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Por curso</h4>
              <div className="grid grid-3">
                {backendData.porCurso.map((c) => (
                  <div key={c.curso} className="stat">
                    <div className="stat__label">{c.curso}</div>
                    <div className="stat__value">{c.promedio}%</div>
                    <div className="stat__hint">{c.enRiesgo} en riesgo</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card card-pad-lg">
        {filtrados.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title="No hay registros para este filtro"
            description="Probá con otro curso o materia, o marcá asistencia desde el módulo del preceptor."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Alumno</th>
                    <th>Curso</th>
                    <th>Materia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 80).map((r) => {
                    const a = alumnoMap.get(r.alumnoId);
                    const cls =
                      r.estado === "presente"
                        ? "badge-success"
                        : r.estado === "tarde"
                        ? "badge-warning"
                        : "badge-danger";
                    return (
                      <tr key={r.id}>
                        <td>{r.fecha}</td>
                        <td style={{ fontWeight: 600 }}>{a?.nombre ?? r.alumnoId}</td>
                        <td>{a?.curso}</td>
                        <td>{r.materia}</td>
                        <td>
                          <span className={`badge ${cls}`}>{r.estado}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtrados.length > 80 && (
              <p className="muted text-sm" style={{ marginTop: 12 }}>
                Mostrando 80 de {filtrados.length} registros (el CSV incluye todos).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
