import type { EstadisticaAlumno } from "../../data/mock";
import { UMBRAL_REGULARIDAD } from "../../data/types";
import { colorPorPct } from "./attendance.service";

interface Props {
  stats: EstadisticaAlumno;
}

export default function AsistenciaCard({ stats }: Props) {
  const { general } = stats;
  const enRiesgo = general !== null && general < UMBRAL_REGULARIDAD;

  return (
    <div className="asistencia-card">
      <div className="asistencia-card__num" style={{ color: colorPorPct(general) }}>
        {general === null ? "—" : `${general}%`}
      </div>
      <div className="asistencia-card__label">Asistencia general</div>

      <span
        className="asistencia-card__pill"
        style={{
          color: enRiesgo ? "#B23B2B" : "#2E7D52",
          background: enRiesgo ? "#F6E6E1" : "#E8F1EB",
        }}
      >
        {enRiesgo ? "En riesgo de regularidad" : "Regular"}
      </span>

      <p className="asistencia-card__nota">
        {enRiesgo
          ? `Estás por debajo del ${UMBRAL_REGULARIDAD}% mínimo. Acercate a preceptoría.`
          : `Mantené tu asistencia por encima del ${UMBRAL_REGULARIDAD}% en cada materia.`}
      </p>
    </div>
  );
}