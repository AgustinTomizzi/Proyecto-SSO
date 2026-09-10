import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { calcularEstadisticasAlumno, colorPorPct } from "../../data/mock";
import { UMBRAL_REGULARIDAD } from "../../data/types";
import AsistenciaCard from "./asistenciaCard";
import SubjectFilter from "./subjectFilter";
import YearFilter from "./yearFilter";
import HistoryTable from "./HistoryTable";
import RealtimeIndicador from "./RealtimeIndicador";
import "./attendance.css";

interface Props {
  alumnoId: string;
  nombre: string;
  curso: string;
}

function anioDe(r: { anio?: number; fecha: string }): number | undefined {
  return r.anio ?? Number(String(r.fecha).slice(0, 4));
}

export default function AsistenciaDashboard({ alumnoId, nombre, curso }: Props) {
  const { getRegistrosDeAlumno, alumnos } = useStore();
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<string | null>(null);
  const [anioSeleccionado, setAnioSeleccionado] = useState<number | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date().toISOString());
  const [actualizando, setActualizando] = useState(false);

  const registros = useMemo(
    () => getRegistrosDeAlumno(alumnoId),
    [getRegistrosDeAlumno, alumnoId]
  );

  const anios = useMemo(
    () => [...new Set(registros.map(anioDe).filter((a): a is number => a != null))],
    [registros]
  );

  // Recálculo por ciclo: si el usuario elige un año, se filtran los registros
  // para no mezclar períodos lectivos distintos.
  const registrosDelAnio = useMemo(() => {
    if (anioSeleccionado === null) return registros;
    return registros.filter((r) => anioDe(r) === anioSeleccionado);
  }, [registros, anioSeleccionado]);

  const alumno = useMemo(
    () =>
      alumnos.find((a) => a.id === alumnoId) ?? {
        id: alumnoId,
        nombre,
        curso,
        email: "",
      },
    [alumnos, alumnoId, nombre, curso]
  );

  const stats = useMemo(
    () =>
      calcularEstadisticasAlumno([alumno], registrosDelAnio, alumnoId) ?? {
        alumnoId,
        nombre,
        curso,
        general: null,
        porMateria: [],
      },
    [alumno, registrosDelAnio, alumnoId, nombre, curso]
  );

  const materias = useMemo(
    () => [...new Set(registrosDelAnio.map((r) => r.materia))],
    [registrosDelAnio]
  );

  const registrosFiltrados = useMemo(
    () =>
      (materiaSeleccionada
        ? registrosDelAnio.filter((r) => r.materia === materiaSeleccionada)
        : registrosDelAnio
      ).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [registrosDelAnio, materiaSeleccionada]
  );

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

      <YearFilter
        anios={anios}
        anioSeleccionado={anioSeleccionado}
        onCambiar={setAnioSeleccionado}
      />

      {stats.porMateria.length > 0 && (
        <div className="materia-resumen">
          <h3>Por materia</h3>
          <div className="materia-resumen__grid">
            {stats.porMateria.map((m) => (
              <div className="materia-resumen__card" key={m.materia}>
                <div className="materia-resumen__nombre">{m.materia}</div>
                <div
                  className="materia-resumen__pct"
                  style={{ color: colorPorPct(m.pct) }}
                >
                  {m.pct === null ? "—" : `${m.pct}%`}
                </div>
                <div className="materia-resumen__totales">
                  {m.total} clases · {m.presentes} presentes · {m.tardes} tardes ·{" "}
                  {m.ausencias} ausencias
                </div>
                {m.pct !== null && m.pct < UMBRAL_REGULARIDAD && (
                  <div className="materia-resumen__riesgo">En riesgo de regularidad</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <SubjectFilter
        materias={materias}
        materiaSeleccionada={materiaSeleccionada}
        onCambiar={setMateriaSeleccionada}
      />

      <HistoryTable registros={registrosFiltrados} />
    </div>
  );
}