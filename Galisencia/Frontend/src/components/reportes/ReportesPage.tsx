import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { MATERIAS, PESO_ASISTENCIA, UMBRAL_REGULARIDAD } from "../../data/types";
import { useToast } from "../../components/ui/Toast";
import EmptyState from "../../components/ui/EmptyState";

type FiltroRiesgo = "todos" | "general" | "materia";

export default function ReportesPage() {
  const { alumnos, registros, cursos } = useStore();
  const { push } = useToast();
  const [curso, setCurso] = useState("todos");
  const [materia, setMateria] = useState("todas");
  const [riesgo, setRiesgo] = useState<FiltroRiesgo>("todos");
  const [ciclo, setCiclo] = useState("");

  const cursosOpciones = useMemo(() => cursos.map((c) => `${c.anio} ${c.division}`), [cursos]);
  const ciclos = useMemo(
    () => [...new Set(registros.map((r) => r.fecha.slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort((a, b) => b.localeCompare(a)),
    [registros]
  );
  useEffect(() => {
    if (!ciclos.includes(ciclo)) setCiclo(ciclos[0] ?? "");
  }, [ciclo, ciclos]);

  const alumnoMap = useMemo(() => new Map(alumnos.map((a) => [a.id, a])), [alumnos]);
  const porcentaje = (lista: typeof registros) => lista.length
    ? Math.round(lista.reduce((s, r) => s + PESO_ASISTENCIA[r.estado], 0) / lista.length * 100)
    : null;

  const calculo = useMemo(() => {
    const porCicloCurso = registros.filter((r) => {
      const alumno = alumnoMap.get(r.alumnoId);
      return (!ciclo || r.fecha.startsWith(`${ciclo}-`)) && (curso === "todos" || alumno?.curso === curso);
    });
    const alumnosDelCurso = alumnos.filter((a) => curso === "todos" || a.curso === curso);
    const porcentajes = new Map<string, number | null>();
    const admitidos = new Set<string>();

    for (const alumno of alumnosDelCurso) {
      const propios = porCicloCurso.filter((r) => r.alumnoId === alumno.id);
      const general = porcentaje(propios);
      const porMateria = [...new Set(propios.map((r) => r.materia))].map((nombre) => ({
        nombre,
        valor: porcentaje(propios.filter((r) => r.materia === nombre)),
      }));
      const materiaElegida = materia === "todas"
        ? porMateria.reduce<number | null>((min, actual) => actual.valor !== null && (min === null || actual.valor < min) ? actual.valor : min, null)
        : porcentaje(propios.filter((r) => r.materia === materia));
      const valorMostrado = materia !== "todas" ? materiaElegida : general;
      porcentajes.set(alumno.id, riesgo === "general" ? general : riesgo === "materia" ? materiaElegida : valorMostrado);

      if (riesgo === "todos") admitidos.add(alumno.id);
      if (riesgo === "general" && general !== null && general < UMBRAL_REGULARIDAD) admitidos.add(alumno.id);
      if (riesgo === "materia" && materiaElegida !== null && materiaElegida < UMBRAL_REGULARIDAD) admitidos.add(alumno.id);
    }

    const filas = porCicloCurso.filter((r) => admitidos.has(r.alumnoId) && (materia === "todas" || r.materia === materia));
    const valores = [...admitidos].map((id) => porcentajes.get(id)).filter((v): v is number => v !== null && v !== undefined);
    return {
      filas,
      porcentajes,
      alumnos: admitidos.size,
      promedio: valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null,
    };
  }, [registros, alumnos, alumnoMap, ciclo, curso, materia, riesgo]);

  function exportarCSV() {
    if (calculo.filas.length === 0) {
      push("No hay registros para exportar", "info");
      return;
    }
    const header = "Fecha,Alumno,Curso,Materia,Estado,Porcentaje\n";
    const rows = calculo.filas.map((r) => {
      const a = alumnoMap.get(r.alumnoId);
      return `${r.fecha},"${a ? `${a.nombre} ${a.apellido}`.trim() : r.alumnoId}",${a?.curso ?? ""},${r.materia},${r.estado},${calculo.porcentajes.get(r.alumnoId) ?? ""}`;
    }).join("\n");
    const url = URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-asistencia-${ciclo || "sin-ciclo"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    push("Reporte exportado en CSV");
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Reportes de asistencia</h1><p className="sub">Filtrá por ciclo y situación de regularidad.</p></div>
        <button className="btn btn-primary" onClick={exportarCSV}>Exportar CSV</button>
      </div>

      <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
        <div className="grid grid-4">
          <div className="field" style={{ margin: 0 }}><label>Ciclo</label><select className="select" value={ciclo} onChange={(e) => setCiclo(e.target.value)} disabled={!ciclos.length}>{!ciclos.length && <option value="">Sin registros</option>}{ciclos.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label>Curso</label><select className="select" value={curso} onChange={(e) => setCurso(e.target.value)}><option value="todos">Todos los cursos</option>{cursosOpciones.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label>Materia</label><select className="select" value={materia} onChange={(e) => setMateria(e.target.value)}><option value="todas">Todas las materias</option>{MATERIAS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label>Situación</label><select className="select" value={riesgo} onChange={(e) => setRiesgo(e.target.value as FiltroRiesgo)}><option value="todos">Todos</option><option value="general">En riesgo general</option><option value="materia">En riesgo por materia</option></select></div>
        </div>
        <div className="row row-wrap" style={{ marginTop: 14 }}><span className="badge">{calculo.alumnos} alumnos</span><span className="badge">{calculo.filas.length} registros</span><span className={`badge ${calculo.promedio !== null && calculo.promedio < UMBRAL_REGULARIDAD ? "badge-danger" : "badge-success"}`}>Promedio: {calculo.promedio === null ? "—" : `${calculo.promedio}%`}</span></div>
      </div>

      <div className="card card-pad-lg">
        {calculo.filas.length === 0 ? <EmptyState icon="" title="No hay registros para este filtro" description="Probá con otro ciclo, curso, materia o situación." /> : <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Alumno</th><th>Curso</th><th>Materia</th><th>Estado</th><th>Porcentaje</th></tr></thead><tbody>{calculo.filas.slice(0, 80).map((r) => {
          const a = alumnoMap.get(r.alumnoId);
          const pct = calculo.porcentajes.get(r.alumnoId);
          const cls = r.estado === "presente" ? "badge-success" : r.estado === "tarde" ? "badge-warning" : "badge-danger";
          return <tr key={r.id}><td>{r.fecha}</td><td style={{ fontWeight: 600 }}>{a ? `${a.nombre} ${a.apellido}`.trim() : r.alumnoId}</td><td>{a?.curso}</td><td>{r.materia}</td><td><span className={`badge ${cls}`}>{r.estado}</span></td><td>{pct === null || pct === undefined ? "—" : `${pct}%`}</td></tr>;
        })}</tbody></table></div>}
      </div>
    </div>
  );
}
