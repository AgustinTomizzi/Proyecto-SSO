import { useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { MATERIAS } from "../../data/types";
import { useToast } from "../../components/ui/Toast";
import EmptyState from "../../components/ui/EmptyState";

export default function ReportesPage() {
  const { alumnos, registros, cursos } = useStore();
  const [curso, setCurso] = useState("todos");
  const { push } = useToast();
  const [materia, setMateria] = useState("todas");

  const CURSO_OPCIONES = useMemo(
    () => cursos.map((c) => `${c.anio} ${c.division}`),
    [cursos]
  );

  const alumnoMap = useMemo(() => {
    const m = new Map<string, (typeof alumnos)[number]>();
    alumnos.forEach((a) => m.set(a.id, a));
    return m;
  }, [alumnos]);

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
        <button className="btn btn-primary" onClick={exportarCSV}>
          ⬇ Exportar CSV
        </button>
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
