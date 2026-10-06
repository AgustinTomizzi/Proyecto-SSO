import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { ESTADO_ASISTENCIA, porcentajeAsistencia } from "../../data/types";
import { useToast } from "../../components/ui/Toast";
import EmptyState from "../../components/ui/EmptyState";
import { useAuth } from "../../auth/AuthContext";
import ReglasAsistenciaCard from "./ReglasAsistenciaCard";
import { exportarReporteAsistencia, type ResumenAlumnoReporte } from "./exportarReporte";
import { useImpresionReporte } from "./useImpresionReporte";
import { hoyLocal } from "../../data/fecha";
import "./reportes.css";

type FiltroRiesgo = "todos" | "general" | "materia";

export default function ReportesPage() {
  const { alumnos, registros, cursos, materias, reglas } = useStore();
  const { usuario } = useAuth();
  const puedeConfigurar = usuario?.permisos.includes("config.gestionar") ?? false;
  const { push } = useToast();
  const umbral = reglas.umbral;
  const [curso, setCurso] = useState("todos");
  const [materia, setMateria] = useState("todas");
  const [riesgo, setRiesgo] = useState<FiltroRiesgo>("todos");
  const [ciclo, setCiclo] = useState("");
  const [exportando, setExportando] = useState(false);
  useImpresionReporte();

  const cursosOpciones = useMemo(() => cursos.map((c) => `${c.anio} ${c.division}`), [cursos]);
  const ciclos = useMemo(
    () => [...new Set(registros.map((r) => r.fecha.slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort((a, b) => b.localeCompare(a)),
    [registros]
  );
  useEffect(() => {
    if (!ciclos.includes(ciclo)) setCiclo(ciclos[0] ?? "");
  }, [ciclo, ciclos]);

  const alumnoMap = useMemo(() => new Map(alumnos.map((a) => [a.id, a])), [alumnos]);
  const calculo = useMemo(() => {
    const porcentaje = (lista: typeof registros) => porcentajeAsistencia(lista, reglas);
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
      if (riesgo === "general" && general !== null && general < reglas.umbral) admitidos.add(alumno.id);
      if (riesgo === "materia" && materiaElegida !== null && materiaElegida < reglas.umbral) admitidos.add(alumno.id);
    }

    const filas = porCicloCurso.filter((r) => admitidos.has(r.alumnoId) && (materia === "todas" || r.materia === materia));
    const valores = [...admitidos].map((id) => porcentajes.get(id)).filter((v): v is number => v !== null && v !== undefined);
    // Resumen por alumno (para Excel e impresión) con los registros del filtro.
    const resumenAlumnos: ResumenAlumnoReporte[] = alumnosDelCurso
      .filter((a) => admitidos.has(a.id))
      .map((a) => {
        const propios = filas.filter((r) => r.alumnoId === a.id);
        const pct = porcentajes.get(a.id) ?? null;
        return {
          nombre: `${a.apellido}, ${a.nombre}`.replace(/^, /, ""),
          curso: a.curso,
          total: propios.length,
          presentes: propios.filter((r) => r.estado === "presente").length,
          tardes: propios.filter((r) => r.estado === "tarde").length,
          ausentes: propios.filter((r) => r.estado === "ausente").length,
          justificadas: propios.filter((r) => r.estado === "justificado").length,
          pct,
          enRiesgo: pct !== null && pct < reglas.umbral,
        };
      })
      .sort((x, y) => x.curso.localeCompare(y.curso, "es", { numeric: true }) || x.nombre.localeCompare(y.nombre, "es"));
    return {
      filas,
      resumenAlumnos,
      porcentajes,
      alumnos: admitidos.size,
      promedio: valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null,
    };
  }, [registros, alumnos, alumnoMap, ciclo, curso, materia, riesgo, reglas]);

  function exportarCSV() {
    if (calculo.filas.length === 0) {
      push("No hay registros para exportar", "info");
      return;
    }
    const header = "Fecha,Alumno,Curso,Materia,Estado,Porcentaje\n";
    const rows = calculo.filas.map((r) => {
      const a = alumnoMap.get(r.alumnoId);
      return `${r.fecha},"${a ? `${a.nombre} ${a.apellido}`.trim() : r.alumnoId}",${a?.curso ?? ""},${r.materia},${ESTADO_ASISTENCIA[r.estado]?.label ?? r.estado},${calculo.porcentajes.get(r.alumnoId) ?? ""}`;
    }).join("\n");
    const url = URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-asistencia-${ciclo || "sin-ciclo"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    push("Reporte exportado en CSV");
  }

  const descripcion = [
    ciclo ? `Ciclo ${ciclo}` : "Todos los ciclos",
    curso === "todos" ? "todos los cursos" : curso,
    materia === "todas" ? "todas las materias" : materia,
    riesgo === "general" ? "en riesgo general" : riesgo === "materia" ? "en riesgo por materia" : "todos los alumnos",
  ].join(" · ") + `. Mínimo ${reglas.umbral}%, tarde ${Math.round(reglas.valorTarde * 100)}%, justificada ${Math.round(reglas.valorJustificado * 100)}%.`;

  async function exportarExcel() {
    if (calculo.resumenAlumnos.length === 0) {
      push("No hay datos para exportar", "info");
      return;
    }
    setExportando(true);
    try {
      const filas = calculo.filas.map((r) => {
        const a = alumnoMap.get(r.alumnoId);
        return { fecha: r.fecha, alumno: a ? `${a.apellido}, ${a.nombre}`.replace(/^, /, "") : r.alumnoId, curso: a?.curso ?? "", materia: r.materia, estado: ESTADO_ASISTENCIA[r.estado]?.label ?? r.estado, pct: calculo.porcentajes.get(r.alumnoId) ?? null };
      });
      await exportarReporteAsistencia(descripcion, calculo.resumenAlumnos, filas, `reporte-asistencia-${ciclo || "sin-ciclo"}-${hoyLocal()}.xlsx`);
      push("Reporte exportado en Excel");
    } catch (e) {
      push(e instanceof Error ? `No se pudo exportar: ${e.message}` : "No se pudo exportar el reporte", "error");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="page reportes-page">
      <div className="page-head">
        <div><h1>Reportes de asistencia</h1><p className="sub">Filtrá por ciclo y situación de regularidad.</p></div>
        <div className="row row-wrap reportes-acciones">
          <button className="btn btn-ghost" onClick={() => window.print()} disabled={calculo.resumenAlumnos.length === 0}>Imprimir / PDF</button>
          <button className="btn btn-soft" onClick={exportarCSV}>CSV</button>
          <button className="btn btn-primary" onClick={() => void exportarExcel()} disabled={exportando}>{exportando ? "Exportando..." : "Excel"}</button>
        </div>
      </div>

      <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
        <div className="grid grid-4">
          <div className="field" style={{ margin: 0 }}><label>Ciclo</label><select className="select" value={ciclo} onChange={(e) => setCiclo(e.target.value)} disabled={!ciclos.length}>{!ciclos.length && <option value="">Sin registros</option>}{ciclos.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label>Curso</label><select className="select" value={curso} onChange={(e) => setCurso(e.target.value)}><option value="todos">Todos los cursos</option>{cursosOpciones.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label>Materia</label><select className="select" value={materia} onChange={(e) => setMateria(e.target.value)}><option value="todas">Todas las materias</option>{materias.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label>Situación</label><select className="select" value={riesgo} onChange={(e) => setRiesgo(e.target.value as FiltroRiesgo)}><option value="todos">Todos</option><option value="general">En riesgo general</option><option value="materia">En riesgo por materia</option></select></div>
        </div>
        <div className="row row-wrap" style={{ marginTop: 14 }}><span className="badge">{calculo.alumnos} alumnos</span><span className="badge">{calculo.filas.length} registros</span><span className={`badge ${calculo.promedio !== null && calculo.promedio < umbral ? "badge-danger" : "badge-success"}`}>Promedio: {calculo.promedio === null ? "—" : `${calculo.promedio}%`}</span><span className="muted text-sm">Mínimo de regularidad: {umbral}% · Tarde vale {Math.round(reglas.valorTarde * 100)}% · Justificada vale {Math.round(reglas.valorJustificado * 100)}%</span></div>
      </div>

      <div className="card card-pad-lg">
        {calculo.filas.length === 0 ? <EmptyState icon="" title="No hay registros para este filtro" description="Probá con otro ciclo, curso, materia o situación." /> : <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Alumno</th><th>Curso</th><th>Materia</th><th>Estado</th><th>Porcentaje</th></tr></thead><tbody>{calculo.filas.slice(0, 80).map((r) => {
          const a = alumnoMap.get(r.alumnoId);
          const pct = calculo.porcentajes.get(r.alumnoId);
          const estado = ESTADO_ASISTENCIA[r.estado] ?? { label: r.estado, badge: "" };
          return <tr key={r.id}><td>{r.fecha}</td><td style={{ fontWeight: 600 }}>{a ? `${a.nombre} ${a.apellido}`.trim() : r.alumnoId}</td><td>{a?.curso}</td><td>{r.materia}</td><td><span className={`badge ${estado.badge}`}>{estado.label}</span></td><td>{pct === null || pct === undefined ? "—" : `${pct}%`}</td></tr>;
        })}</tbody></table></div>}
      </div>

      <section className="reporte-hoja" aria-hidden="true">
        <h2>Reporte de asistencia</h2>
        <p>{descripcion} Generado el {hoyLocal().split("-").reverse().join("/")}. {calculo.resumenAlumnos.length} alumnos, promedio {calculo.promedio === null ? "—" : `${calculo.promedio}%`}.</p>
        <table>
          <thead><tr><th>Alumno</th><th>Curso</th><th>Clases</th><th>Pres.</th><th>Tardes</th><th>Aus.</th><th>Just.</th><th>Asistencia</th><th>Situación</th></tr></thead>
          <tbody>{calculo.resumenAlumnos.map((r) => <tr key={`${r.curso}-${r.nombre}`}><td>{r.nombre}</td><td>{r.curso}</td><td>{r.total}</td><td>{r.presentes}</td><td>{r.tardes}</td><td>{r.ausentes}</td><td>{r.justificadas}</td><td>{r.pct === null ? "—" : `${r.pct}%`}</td><td>{r.pct === null ? "Sin datos" : r.enRiesgo ? "En riesgo" : "Regular"}</td></tr>)}</tbody>
        </table>
      </section>

      {puedeConfigurar && <ReglasAsistenciaCard key={`${reglas.valorTarde}-${reglas.valorJustificado}-${reglas.umbral}`} />}
    </div>
  );
}
