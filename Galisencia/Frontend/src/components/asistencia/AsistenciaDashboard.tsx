import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useStore } from "../../data/StoreContext";
import { porcentajeAsistencia } from "../../data/types";
import type { EstadisticaAlumno } from "../../data/mock";
import "./attendance.css";

interface Props {
  alumnoId: string;
  nombre: string;
  curso: string;
}

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#059669", "#0284c7", "#34d399", "#8b5cf6"];

function horaActualizada(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function AsistenciaDashboard({ alumnoId, nombre, curso }: Props) {
  const { getRegistrosDeAlumno, reglas } = useStore();
  const umbral = reglas.umbral;
  const [ciclo, setCiclo] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date().toISOString());
  const [actualizando, setActualizando] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

  const registros = useMemo(() => getRegistrosDeAlumno(alumnoId), [getRegistrosDeAlumno, alumnoId]);
  const ciclos = useMemo(
    () => [...new Set(registros.map((registro) => registro.fecha.slice(0, 4)).filter((anio) => /^\d{4}$/.test(anio)))].sort((a, b) => b.localeCompare(a)),
    [registros]
  );

  useEffect(() => {
    if (!ciclos.includes(ciclo)) setCiclo(ciclos[0] ?? "");
  }, [ciclo, ciclos]);

  const registrosCiclo = useMemo(
    () => registros.filter((registro) => !ciclo || registro.fecha.startsWith(`${ciclo}-`)),
    [registros, ciclo]
  );
  const materias = useMemo(() => [...new Set(registrosCiclo.map((registro) => registro.materia))], [registrosCiclo]);

  const stats = useMemo<EstadisticaAlumno>(() => {
    const porcentaje = (items: typeof registrosCiclo) => porcentajeAsistencia(items, reglas);
    return {
      alumnoId,
      nombre,
      curso,
      general: porcentaje(registrosCiclo),
      porMateria: materias.map((materia) => {
        const items = registrosCiclo.filter((registro) => registro.materia === materia);
        return {
          materia,
          total: items.length,
          presentes: items.filter((registro) => registro.estado === "presente").length,
          tardes: items.filter((registro) => registro.estado === "tarde").length,
          ausencias: items.filter((registro) => registro.estado === "ausente").length,
          justificadas: items.filter((registro) => registro.estado === "justificado").length,
          pct: porcentaje(items),
        };
      }),
    };
  }, [alumnoId, nombre, curso, registrosCiclo, materias, reglas]);

  const resumen = useMemo(() => stats.porMateria.reduce(
    (total, materia) => ({ presentes: total.presentes + materia.presentes, tardes: total.tardes + materia.tardes, ausencias: total.ausencias + materia.ausencias, justificadas: total.justificadas + materia.justificadas, clases: total.clases + materia.total }),
    { presentes: 0, tardes: 0, ausencias: 0, justificadas: 0, clases: 0 }
  ), [stats.porMateria]);

  useEffect(() => setUltimaActualizacion(new Date().toISOString()), [registros]);

  function refrescar() {
    setActualizando(true);
    setUltimaActualizacion(new Date().toISOString());
    window.setTimeout(() => setActualizando(false), 600);
  }

  const general = stats.general ?? 0;
  const regular = stats.general !== null && general >= umbral;

  return (
    <div className="asistencia-dashboard">
      <div className="asistencia-dashboard__header">
        <div><h1>Hola, {nombre.split(" ")[0]} <span aria-hidden="true">👋</span></h1><p>Revisá tu asistencia y rendimiento del ciclo lectivo{curso ? ` · ${curso}` : ""}</p></div>
        <div className="asistencia-dashboard__controls">
          <button className="asistencia-refresh" onClick={refrescar} disabled={actualizando}><svg className={actualizando ? "spin" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>{actualizando ? "Actualizando" : "Actualizar"}</button>
          <label className="asistencia-year"><span>Ciclo lectivo</span><select value={ciclo} onChange={(event) => setCiclo(event.target.value)} disabled={ciclos.length === 0}>{ciclos.length === 0 && <option value="">Sin registros</option>}{ciclos.map((anio) => <option key={anio} value={anio}>{anio}</option>)}</select></label>
        </div>
      </div>

      <div className="asistencia-kpis">
        <KpiCard value={resumen.presentes} label="Clases presentes" tone="sky" icon={<CheckIcon />} />
        <KpiCard value={resumen.clases} label="Total de clases" tone="green" icon={<CalendarIcon />} />
        <KpiCard value={resumen.ausencias} label="Ausencias" tone="danger" icon={<XIcon />} muted={resumen.ausencias === 0} />
      </div>

      <section className="asistencia-hero">
        <div className="asistencia-ring" style={{ "--progress": `${general}` } as CSSProperties}><svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="46" className="track"/><circle cx="55" cy="55" r="46" className="progress"/></svg><strong>{stats.general === null ? "—" : `${general}%`}</strong></div>
        <div className="asistencia-hero__copy"><h2>Asistencia general</h2><p>Mantené tu asistencia por encima del <strong>{umbral}%</strong> en cada materia para conservar la regularidad.</p><span className={`asistencia-status ${regular ? "ok" : "risk"}`}><i />{stats.general === null ? "Sin clases registradas" : regular ? "Regular · Cumpliendo el mínimo requerido" : "En riesgo · Por debajo del mínimo"}</span></div>
        <div className="asistencia-mini-chart" aria-label="Asistencia por materia">{stats.porMateria.slice(0, 7).map((materia) => <div key={materia.materia}><span><i style={{ height: `${materia.pct ?? 0}%` }}/></span><small>{materia.materia.slice(0, 3).toUpperCase()}</small></div>)}</div>
      </section>

      <section className="materia-section">
        <div className="materia-section__head"><div><h2>Asistencia por materia</h2><p>Seleccioná una materia para ver su detalle.</p></div><div className="materia-legend"><span><i className="ok"/> Regular</span><span><i className="risk"/> En riesgo</span></div></div>
        {stats.porMateria.length === 0 ? <div className="asistencia-empty"><CalendarIcon/><strong>Todavía no hay clases registradas</strong><span>Cuando el preceptor cargue asistencia, vas a verla en este panel.</span></div> : (
          <div className="materia-list">{stats.porMateria.map((materia, index) => {
            const abierta = expandida === materia.materia;
            const pct = materia.pct ?? 0;
            const ok = materia.pct !== null && pct >= umbral;
            const color = COLORS[index % COLORS.length];
            return <article className={`materia-card${abierta ? " open" : ""}`} key={materia.materia}>
              <button className="materia-card__summary" onClick={() => setExpandida(abierta ? null : materia.materia)} aria-expanded={abierta}><span className="materia-card__mark" style={{ "--subject-color": color } as CSSProperties}><i/></span><strong className="materia-card__name">{materia.materia}</strong><span className="materia-card__quick"><QuickStat label="Pres." value={materia.presentes} tone="success"/><QuickStat label="Tard." value={materia.tardes} tone="warning"/><QuickStat label="Aus." value={materia.ausencias} tone="danger"/><QuickStat label="Cls." value={materia.total} tone="muted"/></span><span className={`materia-card__pct ${ok ? "ok" : "risk"}`}><strong>{materia.pct === null ? "—" : `${pct}%`}</strong><i><b style={{ width: `${pct}%` }}/></i></span><svg className="materia-card__chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg></button>
              {abierta && <div className="materia-card__detail"><DetailCard label="Asistencias" value={materia.presentes} total={materia.total} tone="success" icon={<CheckIcon/>}/><DetailCard label="Tardanzas" value={materia.tardes} total={materia.total} tone="warning" icon={<ClockIcon/>}/><DetailCard label="Ausencias" value={materia.ausencias} total={materia.total} tone="danger" icon={<XIcon/>}/>{materia.justificadas > 0 && <DetailCard label="Justificadas" value={materia.justificadas} total={materia.total} tone="sky" icon={<CheckIcon/>}/>}<DetailCard label="Clases totales" value={materia.total} total={materia.total} tone="sky" icon={<CalendarIcon/>}/><div className={`materia-card__note ${ok ? "ok" : "risk"}`}><strong>{ok ? "✓ Regular" : "✕ En riesgo"}</strong><span>{ok ? `Superás el mínimo con ${pct}% de asistencia.` : `Estás al ${pct}%; el mínimo requerido es ${umbral}%.`}</span></div></div>}
            </article>;
          })}</div>
        )}
      </section>

      <footer className="asistencia-footer"><span>{stats.porMateria.length} materias · Ciclo {ciclo || "sin registros"}</span><span>Última actualización: hoy, {horaActualizada(ultimaActualizacion)}</span></footer>
    </div>
  );
}

function KpiCard({ value, label, tone, icon, muted }: { value: number; label: string; tone: string; icon: ReactNode; muted?: boolean }) { return <div className={`asistencia-kpi ${tone}${muted ? " muted" : ""}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }
function QuickStat({ label, value, tone }: { label: string; value: number; tone: string }) { return <span className={tone}><strong>{value}</strong><small>{label}</small></span>; }
function DetailCard({ label, value, total, tone, icon }: { label: string; value: number; total: number; tone: string; icon: ReactNode }) { const pct = total ? Math.round(value / total * 100) : 0; return <div className={`materia-detail ${tone}`}><span>{icon}<small>{label}</small></span><strong>{value}</strong><i><b style={{ width: `${pct}%` }}/></i><small>{pct}% del total</small></div>; }
function CheckIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>; }
function CalendarIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>; }
function XIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>; }
function ClockIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>; }
