import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../data/apiClient";

interface EstadoSistema {
  generadoEn: string;
  entorno: string;
  version: string;
  base: { version: string; tamanioMb: number; alumnos: number; usuarios: number };
  backup: { ultimo?: string; archivo?: string; bytes?: number; ok?: boolean; error?: string; diarios?: number; mensuales?: number; horasDesdeUltimo?: number | null } | null;
  disco: { libreGb: number; totalGb: number; usoPct: number } | null;
  notificaciones: { smtpConfigurado: boolean; porEstado: Record<string, number>; horasPendienteMasViejo: number | null };
  retencion: { ultima: string | null };
  sesionesActivas: number;
  alertas: string[];
}

const fechaHora = (valor?: string | null) => {
  if (!valor) return "—";
  const [fecha, hora = ""] = valor.split(" ");
  return `${fecha.split("-").reverse().join("/")} ${hora.slice(0, 5)}`.trim();
};

/** Monitoreo para el Administrador (permiso config.gestionar). */
export default function EstadoSistemaPage() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setEstado(await apiGet<EstadoSistema>("/estado_sistema.php", 10000));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el estado del sistema.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    const cada = window.setInterval(() => void cargar(), 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(cada); };
  }, [cargar]);

  const backupOk = estado?.backup?.ok && (estado.backup.horasDesdeUltimo ?? 99) <= 26;

  return (
    <div className="page" style={{ display: "grid", gap: 18, alignContent: "start" }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Estado del sistema</h1>
          <p className="sub">Base de datos, backups, emails y espacio. Se actualiza cada minuto.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void cargar()} disabled={cargando}>{cargando ? "Actualizando..." : "Actualizar"}</button>
      </div>

      {error && <p className="asistencia-dashboard__error" role="alert">{error}</p>}

      {estado && (
        <>
          <div className={`card card-pad-lg`} role="status">
            {estado.alertas.length === 0 ? (
              <p style={{ margin: 0 }}><span className="badge badge-success">Todo en orden</span> <span className="muted text-sm">Revisado el {fechaHora(estado.generadoEn)}{estado.version ? ` · versión ${estado.version}` : ""} · entorno {estado.entorno}</span></p>
            ) : (
              <>
                <p style={{ margin: "0 0 8px" }}><span className="badge badge-danger">{estado.alertas.length === 1 ? "1 alerta" : `${estado.alertas.length} alertas`}</span></p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>{estado.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
              </>
            )}
          </div>

          <div className="grid grid-2">
            <div className="stat">
              <div className="stat__label">Último backup</div>
              <div className="stat__value" style={{ fontSize: 20 }}>{estado.backup?.ultimo ? fechaHora(estado.backup.ultimo) : "Sin backups"}</div>
              <div className="stat__hint">
                {estado.backup ? <><span className={`badge ${backupOk ? "badge-success" : "badge-danger"}`}>{backupOk ? "Al día" : "Revisar"}</span> {estado.backup.diarios ?? 0} diarios · {estado.backup.mensuales ?? 0} mensuales{estado.backup.bytes ? ` · ${(estado.backup.bytes / 1048576).toFixed(1)} MB` : ""}</> : "El servicio backup todavía no corrió."}
              </div>
            </div>
            <div className="stat">
              <div className="stat__label">Base de datos</div>
              <div className="stat__value" style={{ fontSize: 20 }}>{estado.base.tamanioMb} MB</div>
              <div className="stat__hint">MySQL {estado.base.version} · {estado.base.alumnos} alumnos activos · {estado.base.usuarios} usuarios</div>
            </div>
            <div className="stat">
              <div className="stat__label">Disco (backups)</div>
              <div className="stat__value" style={{ fontSize: 20 }}>{estado.disco ? `${estado.disco.usoPct} % usado` : "—"}</div>
              <div className="stat__hint">{estado.disco ? `${estado.disco.libreGb} GB libres de ${estado.disco.totalGb} GB` : "Sin datos del disco."}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Emails</div>
              <div className="stat__value" style={{ fontSize: 20 }}>{estado.notificaciones.porEstado.pendiente} en cola</div>
              <div className="stat__hint">{estado.notificaciones.smtpConfigurado ? "Envío activo" : "Envío deshabilitado (sin SMTP)"} · {estado.notificaciones.porEstado.enviada} enviados · {estado.notificaciones.porEstado.error} con error</div>
            </div>
            <div className="stat">
              <div className="stat__label">Sesiones activas</div>
              <div className="stat__value" style={{ fontSize: 20 }}>{estado.sesionesActivas}</div>
              <div className="stat__hint">Con actividad en los últimos 30 minutos</div>
            </div>
            <div className="stat">
              <div className="stat__label">Retención de datos</div>
              <div className="stat__value" style={{ fontSize: 20 }}>{fechaHora(estado.retencion.ultima)}</div>
              <div className="stat__hint">Última aplicación de los plazos de conservación</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
