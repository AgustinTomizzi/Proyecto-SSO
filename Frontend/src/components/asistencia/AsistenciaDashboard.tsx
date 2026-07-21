import { useState, useEffect, useCallback, useMemo } from "react";
import { obtenerRegistros, calcularEstadisticas } from "./attendance.service";
import type { RegistroAsistencia } from "./attendance.types";
import AsistenciaCard from "./asistenciaCard";
import SubjectFilter from "./subjectFilter";
import HistoryTable from "./HistoryTable";
import RealtimeIndicador from "./RealtimeIndicador";
import "./attendance.css";
const POLLING_MS = 30000; // 30s, ajustable

interface Props {
  alumnoId: string;
  nombre: string;
  curso: string;
}

export default function AsistenciaDashboard({ alumnoId, nombre, curso }: Props) {
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date().toISOString());
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setActualizando(true);
    try {
      const data = await obtenerRegistros(alumnoId);
      setRegistros(data);
      setUltimaActualizacion(new Date().toISOString());
      setError(null);
    } catch {
      setError("No se pudo actualizar la asistencia. Reintentando en el próximo refresco.");
    } finally {
      setActualizando(false);
    }
  }, [alumnoId]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, POLLING_MS);
    return () => clearInterval(id);
  }, [cargar]);

  const stats = useMemo(
    () => calcularEstadisticas(alumnoId, nombre, curso, registros),
    [alumnoId, nombre, curso, registros]
  );

  const materias = useMemo(() => [...new Set(registros.map((r) => r.materia))], [registros]);

  const registrosFiltrados = useMemo(
    () =>
      materiaSeleccionada
        ? registros.filter((r) => r.materia === materiaSeleccionada)
        : registros,
    [registros, materiaSeleccionada]
  );

  return (
    <div className="asistencia-dashboard">
      <div className="asistencia-dashboard__header">
        <h2>Hola, {nombre.split(" ")[0]}</h2>
        <RealtimeIndicador
          ultimaActualizacion={ultimaActualizacion}
          actualizando={actualizando}
          onRefrescar={cargar}
        />
      </div>

      {error && <p className="asistencia-dashboard__error">{error}</p>}

      <AsistenciaCard stats={stats} />

      <SubjectFilter
        materias={materias}
        materiaSeleccionada={materiaSeleccionada}
        onCambiar={setMateriaSeleccionada}
      />

      <HistoryTable registros={registrosFiltrados} />
    </div>
  );
}