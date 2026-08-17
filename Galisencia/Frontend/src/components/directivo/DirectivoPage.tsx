import { useMemo } from "react";
import { colorPorPct } from "../../data/mock";
import { UMBRAL_REGULARIDAD, PESO_ASISTENCIA } from "../../data/types";
import { useStore } from "../../data/StoreContext";
import { useCountUp } from "../../hooks/useCountUp";
import { Bars, Donut, Trend } from "../../components/ui/Chart";

export default function DirectivoPage() {
  const { resumen, registros } = useStore();

  const conteo = useMemo(() => {
    const c = { presente: 0, tarde: 0, ausente: 0 };
    registros.forEach((r) => (c[r.estado] += 1));
    return c;
  }, [registros]);

  const donut = [
    { label: "Presente", value: conteo.presente, color: "var(--success)" },
    { label: "Tarde", value: conteo.tarde, color: "var(--warning)" },
    { label: "Ausente", value: conteo.ausente, color: "var(--danger)" },
  ];

  const trend = useMemo(() => {
    const fechas = [...new Set(registros.map((r) => r.fecha))].sort();
    return fechas.map((f) => {
      const regs = registros.filter((r) => r.fecha === f);
      const puntos = regs.reduce((s, r) => s + PESO_ASISTENCIA[r.estado], 0);
      return Math.round((puntos / regs.length) * 100);
    });
  }, [registros]);

  const promedio = useCountUp(resumen.promedio);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Panel institucional</h1>
          <p className="sub">Seguimiento de asistencia de toda la escuela.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat__icon">📈</div>
          <div className="stat__label">Asistencia promedio</div>
          <div className="stat__value" style={{ color: colorPorPct(resumen.promedio) }}>
            {promedio}%
          </div>
          <div className="stat__hint">Toda la institución</div>
        </div>
        <div className="stat">
          <div className="stat__icon">👥</div>
          <div className="stat__label">Total alumnos</div>
          <div className="stat__value">{resumen.totalAlumnos}</div>
          <div className="stat__hint">En 5 cursos</div>
        </div>
        <div className="stat">
          <div className="stat__icon">⚠️</div>
          <div className="stat__label">En riesgo</div>
          <div className="stat__value" style={{ color: "var(--danger)" }}>
            {resumen.enRiesgo}
          </div>
          <div className="stat__hint">Debajo del {UMBRAL_REGULARIDAD}%</div>
        </div>
        <div className="stat">
          <div className="stat__icon">🏫</div>
          <div className="stat__label">Cursos</div>
          <div className="stat__value">{resumen.porCurso.length}</div>
          <div className="stat__hint">Técnica secundaria</div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Asistencia por curso</h3>
          <Bars
            data={resumen.porCurso.map((c) => ({ label: c.curso, value: c.promedio }))}
            max={100}
          />
        </div>

        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Distribución de estados</h3>
          <Donut data={donut} />
        </div>

        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Tendencia (por clase)</h3>
          <Trend points={trend} />
          <p className="muted text-sm" style={{ marginTop: 10 }}>
            Promedio de asistencia en cada jornada registrada.
          </p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Alumnos en riesgo</h3>
          <div className="stack" style={{ gap: 10 }}>
            {resumen.alumnosEnRiesgo.length === 0 && (
              <p className="muted">No hay alumnos en riesgo. 🎉</p>
            )}
            {resumen.alumnosEnRiesgo.map(({ alumno, general }) => (
              <div
                key={alumno.id}
                className="row spread"
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{alumno.nombre}</div>
                  <div className="muted text-sm">{alumno.curso}</div>
                </div>
                <span className="badge badge-danger" style={{ fontSize: 13 }}>
                  {general}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad-lg">
          <h3 style={{ marginBottom: 14 }}>Detalle por curso</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Promedio</th>
                  <th>En riesgo</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porCurso.map((c) => (
                  <tr key={c.curso}>
                    <td style={{ fontWeight: 600 }}>{c.curso}</td>
                    <td style={{ color: colorPorPct(c.promedio), fontWeight: 700 }}>
                      {c.promedio}%
                    </td>
                    <td>
                      {c.enRiesgo > 0 ? (
                        <span className="badge badge-danger">{c.enRiesgo}</span>
                      ) : (
                        <span className="badge badge-success">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
