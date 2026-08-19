import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
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
  const { getRegistrosDeAlumno, estadisticasAlumno } = useStore();
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date().toISOString());
  const [actualizando, setActualizando] = useState(false);

  const registros = useMemo(
    () => getRegistrosDeAlumno(alumnoId),
    [getRegistrosDeAlumno, alumnoId]
  );

  const stats = useMemo(
    () =>
      estadisticasAlumno(alumnoId) ?? {
        alumnoId,
        nombre,
        curso,
        general: null,
        porMateria: [],
      },
    [estadisticasAlumno, alumnoId, nombre, curso]
  );

  const materias = useMemo(
    () => [...new Set(registros.map((r) => r.materia))],
    [registros]
  );

  const registrosFiltrados = useMemo(
    () =>
      materiaSeleccionada
        ? registros.filter((r) => r.materia === materiaSeleccionada)
        : registros,
    [registros, materiaSeleccionada]
  );

  // Refresco manual (el store ya es reactivo, esto solo actualiza el indicador)
  function refrescar() {
    setActualizando(true);
    setUltimaActualizacion(new Date().toISOString());
    setTimeout(() => setActualizando(false), 450);
  }

  useEffect(() => {
    setUltimaActualizacion(new Date().toISOString());
  }, [registros]);

  return (
    <div className="asistencia-dashboard">
      <div className="asistencia-dashboard__header">
        <h2>Hola, {nombre.split(" ")[0]}</h2>
        <RealtimeIndicador
          ultimaActualizacion={ultimaActualizacion}
          actualizando={actualizando}
          onRefrescar={refrescar}
        />
      </div>

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
