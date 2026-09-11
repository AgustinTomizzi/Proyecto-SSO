import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { PESO_ASISTENCIA } from "../../data/types";
import type { EstadisticaAlumno } from "../../data/mock";
import AsistenciaCard from "./asistenciaCard";
import SubjectFilter from "./subjectFilter";
import HistoryTable from "./HistoryTable";
import RealtimeIndicador from "./RealtimeIndicador";
import "./attendance.css";

interface Props {
  alumnoId: string;
  nombre: string;
  curso: string;
}

export default function AsistenciaDashboard({ alumnoId, nombre, curso }: Props) {
  const { getRegistrosDeAlumno } = useStore();
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date().toISOString());
  const [actualizando, setActualizando] = useState(false);

  const registros = useMemo(() => getRegistrosDeAlumno(alumnoId), [getRegistrosDeAlumno, alumnoId]);
  const ciclos = useMemo(
    () => [...new Set(registros.map((r) => r.fecha.slice(0, 4)).filter((a) => /^\d{4}$/.test(a)))].sort((a, b) => b.localeCompare(a)),
    [registros]
  );

  useEffect(() => {
    if (!ciclos.includes(ciclo)) setCiclo(ciclos[0] ?? "");
  }, [ciclo, ciclos]);

  const registrosCiclo = useMemo(
    () => registros.filter((r) => !ciclo || r.fecha.startsWith(`${ciclo}-`)),
    [registros, ciclo]
  );
  const materias = useMemo(() => [...new Set(registrosCiclo.map((r) => r.materia))], [registrosCiclo]);

  useEffect(() => {
    if (materiaSeleccionada && !materias.includes(materiaSeleccionada)) setMateriaSeleccionada(null);
  }, [materiaSeleccionada, materias]);

  const stats = useMemo<EstadisticaAlumno>(() => {
    const porcentaje = (total: typeof registrosCiclo) => total.length
      ? Math.round(total.reduce((s, r) => s + PESO_ASISTENCIA[r.estado], 0) / total.length * 100)
      : null;
    return {
      alumnoId,
      nombre,
      curso,
      general: porcentaje(registrosCiclo),
      porMateria: materias.map((materia) => {
        const regs = registrosCiclo.filter((r) => r.materia === materia);
        return {
          materia,
          total: regs.length,
          presentes: regs.filter((r) => r.estado === "presente").length,
          tardes: regs.filter((r) => r.estado === "tarde").length,
          ausencias: regs.filter((r) => r.estado === "ausente").length,
          pct: porcentaje(regs),
        };
      }),
    };
  }, [alumnoId, nombre, curso, registrosCiclo, materias]);

  const registrosFiltrados = useMemo(
    () => materiaSeleccionada ? registrosCiclo.filter((r) => r.materia === materiaSeleccionada) : registrosCiclo,
    [registrosCiclo, materiaSeleccionada]
  );

  function refrescar() {
    setActualizando(true);
    setUltimaActualizacion(new Date().toISOString());
    setTimeout(() => setActualizando(false), 450);
  }

  useEffect(() => setUltimaActualizacion(new Date().toISOString()), [registros]);

  return (
    <div className="asistencia-dashboard">
      <div className="asistencia-dashboard__header">
        <h2>Hola, {nombre.split(" ")[0]}</h2>
        <RealtimeIndicador ultimaActualizacion={ultimaActualizacion} actualizando={actualizando} onRefrescar={refrescar} />
      </div>

      <div className="field ciclo-selector">
        <label>Ciclo lectivo</label>
        <select className="select" value={ciclo} onChange={(e) => setCiclo(e.target.value)} disabled={ciclos.length === 0}>
          {ciclos.length === 0 && <option value="">Sin registros</option>}
          {ciclos.map((anio) => <option key={anio} value={anio}>{anio}</option>)}
        </select>
      </div>

      <AsistenciaCard stats={stats} />

      <div className="card card-pad-lg materia-resumen">
        <h3>Asistencia por materia</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Materia</th><th>Porcentaje</th><th>Presentes</th><th>Tardes</th><th>Ausentes</th><th>Clases</th></tr></thead>
            <tbody>{stats.porMateria.map((m) => <tr key={m.materia}><td style={{ fontWeight: 600 }}>{m.materia}</td><td><strong>{m.pct === null ? "—" : `${m.pct}%`}</strong></td><td>{m.presentes}</td><td>{m.tardes}</td><td>{m.ausencias}</td><td>{m.total}</td></tr>)}</tbody>
          </table>
        </div>
        {stats.porMateria.length === 0 && <p className="muted text-sm">No hay asistencias en este ciclo.</p>}
      </div>

      <SubjectFilter materias={materias} materiaSeleccionada={materiaSeleccionada} onCambiar={setMateriaSeleccionada} />
      <HistoryTable registros={registrosFiltrados} />
    </div>
  );
}
