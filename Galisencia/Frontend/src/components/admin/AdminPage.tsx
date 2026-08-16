import { useMemo } from "react";
import { Link } from "react-router-dom";
import { resumenInstitucional, colorPorPct, REGISTROS } from "../../data/mock";
import { useCountUp } from "../../hooks/useCountUp";
import { Bars, Donut } from "../../components/ui/Chart";

export default function AdminPage() {
  const resumen = useMemo(() => resumenInstitucional(), []);

  const conteo = useMemo(() => {
    const c = { presente: 0, tarde: 0, ausente: 0 };
    REGISTROS.forEach((r) => (c[r.estado] += 1));
    return c;
  }, []);

  const donut = [
    { label: "Presente", value: conteo.presente, color: "var(--success)" },
    { label: "Tarde", value: conteo.tarde, color: "var(--warning)" },
    { label: "Ausente", value: conteo.ausente, color: "var(--danger)" },
  ];

  const alumnos = useCountUp(resumen.totalAlumnos);
  const promedio = useCountUp(resumen.promedio);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Panel administrativo</h1>
          <p className="sub">Indicadores y accesos de gestión.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat__icon">👥</div>
          <div className="stat__label">Alumnos</div>
          <div className="stat__value">{alumnos}</div>
        </div>
        <div className="stat">
          <div className="stat__icon">🏫</div>
          <div className="stat__label">Cursos</div>
          <div className="stat__value">{resumen.porCurso.length}</div>
        </div>
        <div className="stat">
          <div className="stat__icon">📈</div>
          <div className="stat__label">Asistencia prom.</div>
          <div className="stat__value" style={{ color: colorPorPct(resumen.promedio) }}>
            {promedio}%
          </div>
        </div>
        <div className="stat">
          <div className="stat__icon">⚠️</div>
          <div className="stat__label">En riesgo</div>
          <div className="stat__value" style={{ color: "var(--danger)" }}>
            {resumen.enRiesgo}
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Asistencia por curso</h3>
          <Bars data={resumen.porCurso.map((c) => ({ label: c.curso, value: c.promedio }))} max={100} />
        </div>
        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Distribución de estados</h3>
          <Donut data={donut} />
        </div>
        <div className="card card-pad-lg" style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
          <Link to="/gestion" className="quick-card">
            <span className="quick-card__icon">👥</span>
            <span>
              <strong>Gestión académica</strong>
              <span className="muted text-sm">Altas, bajas y cambios de curso.</span>
            </span>
          </Link>
          <Link to="/reportes" className="quick-card">
            <span className="quick-card__icon">📊</span>
            <span>
              <strong>Reportes</strong>
              <span className="muted text-sm">Filtros y exportación.</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
