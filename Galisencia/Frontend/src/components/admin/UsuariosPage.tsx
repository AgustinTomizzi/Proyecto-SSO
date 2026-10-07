import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { apiGet, apiSend } from "../../data/apiClient";
import type { Rol } from "../../data/types";
import { ROL_LABEL } from "../../data/types";
import ConfirmDialog from "../ui/ConfirmDialog";
import "./UsuariosPage.css";

/** Contraseña temporal aleatoria (la cuenta la cambia en el próximo ingreso). */
function generarTemporal(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => alfabeto[b % alfabeto.length]).join("");
}

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
  const puedeRestablecer = usuario?.permisos.includes("usuarios.restablecer_password") ?? false;
  const [aRestablecer, setARestablecer] = useState<Usuario | null>(null);
  const [temporales, setTemporales] = useState<Record<string, string>>({});

  const restablecer = async () => {
    if (!aRestablecer) return;
    const temporal = generarTemporal();
    try {
      await apiSend("/usuarios.php", "PUT", { accion: "restablecer_password", id: aRestablecer.id, passwordTemporal: temporal });
      setTemporales((prev) => ({ ...prev, [aRestablecer.id]: temporal }));
      push("Contraseña restablecida: pasale la temporal a la persona");
    } catch (err) {
      push(err instanceof Error ? err.message : "No se pudo restablecer la contraseña", "error");
    } finally {
      setARestablecer(null);
    }
  };

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
                  {puedeRestablecer && <th>Contraseña</th>}
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
                    {puedeRestablecer && (
                      <td>
                        {temporales[u.id] ? (
                          <span className="text-sm">Temporal: <code>{temporales[u.id]}</code></span>
                        ) : (
                          <button className="btn btn-sm btn-ghost" onClick={() => setARestablecer(u)} aria-label={`Restablecer la contraseña de ${u.nombre} ${u.apellido}`}>Restablecer</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={aRestablecer !== null}
        title="Restablecer contraseña"
        message={aRestablecer ? `Se genera una contraseña temporal para ${aRestablecer.email}. Su contraseña actual deja de funcionar y tiene que elegir una nueva en el próximo ingreso.` : undefined}
        confirmLabel="Restablecer"
        onConfirm={() => void restablecer()}
        onCancel={() => setARestablecer(null)}
      />
    </div>
  );
}
