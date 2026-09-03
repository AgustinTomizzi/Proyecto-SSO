import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { apiGet } from "../../data/apiClient";
import "./AuditoriaPage.css";

interface AuditoriaRegistro {
  id: string;
  usuarioId: number | null;
  usuarioNombre: string | null;
  rol: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
  fecha: string;
}

interface AuditoriaFilters {
  usuarioId?: string;
  entidad?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  limit: number;
}

const ENTIDADES = ["alumno", "curso", "usuario", "asistencia", "nota", "rol"];
const ACCIONES = ["alumnos.crear", "alumnos.editar", "alumnos.dar_baja", "cursos.asignar", "usuarios.editar_rol"];

const fieldStyle: CSSProperties = { margin: 0 };
const fieldFlexEnd: CSSProperties = { margin: 0, display: "flex", alignItems: "flex-end", gap: 8 };
const gridStyle: CSSProperties = { marginBottom: 16 };

const formatFecha = (fecha: string) => {
  const d = new Date(fecha);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDetalle = (detalle: Record<string, unknown> | null) => {
  if (!detalle) return "—";
  return Object.entries(detalle)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("; ");
};

export default function AuditoriaPage() {
  const { usuario } = useAuth();
  const { push } = useToast();
  const [registros, setRegistros] = useState<AuditoriaRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditoriaFilters>({
    usuarioId: "",
    entidad: "",
    accion: "",
    desde: "",
    hasta: "",
    limit: 100,
  });

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.usuarioId) params.append("usuarioId", filters.usuarioId);
      if (filters.entidad) params.append("entidad", filters.entidad);
      if (filters.accion) params.append("accion", filters.accion);
      if (filters.desde) params.append("desde", filters.desde);
      if (filters.hasta) params.append("hasta", filters.hasta);
      params.append("limit", String(filters.limit));

      const data = await apiGet<{ ok: true; registros: AuditoriaRegistro[] }>(
        `/auditoria.php?${params.toString()}`
      );
      setRegistros(data.registros);
    } catch (err) {
      push("Error al cargar auditoría: " + (err instanceof Error ? err.message : "Error desconocido"));
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();
  }, []);

  const handleFilterChange = (key: keyof AuditoriaFilters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRegistros();
  };

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <h3>Acceso restringido</h3>
          <p>Solo los administradores pueden ver el registro de auditoría.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Registro de Auditoría</h1>
          <p className="sub">Historial de acciones del sistema</p>
        </div>
      </div>

      <form className="card card-pad-lg" onSubmit={handleSearch}>
        <div className="grid grid-4" style={gridStyle}>
          <div className="field" style={fieldStyle}>
            <label>Usuario ID</label>
            <input
              className="input"
              type="number"
              placeholder="Filtrar por usuario"
              value={filters.usuarioId}
              onChange={(e) => handleFilterChange("usuarioId", e.target.value)}
            />
          </div>
          <div className="field" style={fieldStyle}>
            <label>Entidad</label>
            <select className="select" value={filters.entidad} onChange={(e) => handleFilterChange("entidad", e.target.value)}>
              <option value="">Todas</option>
              {ENTIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="field" style={fieldStyle}>
            <label>Acción</label>
            <select className="select" value={filters.accion} onChange={(e) => handleFilterChange("accion", e.target.value)}>
              <option value="">Todas</option>
              {ACCIONES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="field" style={fieldFlexEnd}>
            <label style={{ marginBottom: 4 }}>Límite</label>
            <select className="select" style={{ width: "100px" }} value={filters.limit} onChange={(e) => handleFilterChange("limit", Number(e.target.value))}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
        <div className="grid grid-4" style={gridStyle}>
          <div className="field" style={fieldStyle}>
            <label>Desde</label>
            <input className="input" type="date" value={filters.desde} onChange={(e) => handleFilterChange("desde", e.target.value)} />
          </div>
          <div className="field" style={fieldStyle}>
            <label>Hasta</label>
            <input className="input" type="date" value={filters.hasta} onChange={(e) => handleFilterChange("hasta", e.target.value)} />
          </div>
          <div className="field" style={fieldFlexEnd}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Buscando…" : "Filtrar"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => {
              setFilters({ usuarioId: "", entidad: "", accion: "", desde: "", hasta: "", limit: 100 });
              fetchRegistros();
            }}>
              Limpiar
            </button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="skeleton-table">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton skeleton-text" style={{ width: "60px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "120px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "80px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "100px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "150px" }} />
                </div>
              ))}
            </div>
          ) : registros.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state__icon">📋</div>
              <h3>Sin registros</h3>
              <p>No hay registros de auditoría con los filtros actuales.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Entidad ID</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{formatFecha(r.fecha)}</td>
                    <td>{r.usuarioNombre || "—"}</td>
                    <td>{r.rol || "—"}</td>
                    <td><code>{r.accion}</code></td>
                    <td>{r.entidad}</td>
                    <td>{r.entidadId || "—"}</td>
                    <td><code style={{ fontSize: 11 }}>{formatDetalle(r.detalle)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}