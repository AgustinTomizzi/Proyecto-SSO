import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { apiGet, apiSend } from "../../data/apiClient";
import type { Rol } from "../../data/types";
import { ROL_LABEL } from "../../data/types";
import "./UsuariosPage.css";

interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rolId: number;
  rol: string;
}

interface RolOption {
  id: number;
  nombre: string;
}

export default function UsuariosPage() {
  const { usuario } = useAuth();
  const { push } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRolId, setEditRolId] = useState<number>(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ ok: true; usuarios: Usuario[]; roles: RolOption[] }>("/usuarios.php");
      setUsuarios(data.usuarios);
      setRoles(data.roles);
    } catch (err) {
      push("Error al cargar usuarios: " + (err instanceof Error ? err.message : "Error desconocido"));
      setUsuarios([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRolChange = (id: string, rolId: number) => {
    setEditingId(id);
    setEditRolId(rolId);
  };

  const saveRol = async (id: string, rolId: number) => {
    try {
      await apiSend("/usuarios.php", "PUT", { id, rolId });
      push("Rol actualizado correctamente");
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, rolId, rol: roles.find((r) => r.id === rolId)?.nombre || "" } : u))
      );
    } catch (err) {
      push("Error al actualizar rol: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setEditingId(null);
      setEditRolId(0);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRolId(0);
  };

  if (!usuario || usuario.rol !== "admin") {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <h3>Acceso restringido</h3>
          <p>Solo los administradores pueden gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p className="sub">Administrá los usuarios del sistema</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="skeleton-table">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton skeleton-text" style={{ width: "50px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "180px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "200px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "120px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "150px" }} />
                </div>
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-state__icon">👥</div>
              <h3>Sin usuarios</h3>
              <p>No hay usuarios registrados en el sistema.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol actual</th>
                  <th>Cambiar rol</th>
                </tr>
              </thead>
              <tbody>
                {[...usuarios].sort((a, b) => Number(a.id) - Number(b.id)).map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-info">{ROL_LABEL[u.rol as Rol] || u.rol}</span>
                    </td>
                    <td>
                      {editingId === u.id ? (
                        <div className="inline-edit">
                          <select
                            className="select"
                            value={editRolId}
                            onChange={(e) => setEditRolId(Number(e.target.value))}
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre}
                              </option>
                            ))}
                          </select>
                          <div className="inline-edit-actions">
                            <button className="btn btn-sm btn-success" onClick={() => saveRol(u.id, editRolId)}>✓</button>
                            <button className="btn btn-sm btn-secondary" onClick={cancelEdit}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <select
                          className="select"
                          value={u.rolId}
                          onChange={(e) => handleRolChange(u.id, Number(e.target.value))}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
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
