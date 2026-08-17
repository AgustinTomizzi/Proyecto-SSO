import { useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import ConfirmDialog from "../ui/ConfirmDialog";
import type { Alumno } from "../../data/types";

export default function GestionPage() {
  const { alumnos, cursos, agregarAlumno, editarAlumno, borrarAlumno } = useStore();
  const [form, setForm] = useState<Partial<Alumno>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const CURSO_OPCIONES = useMemo(
    () => cursos.map((c) => `${c.anio} ${c.division}`),
    [cursos]
  );

  const [guardado, setGuardado] = useState(false);

  const guardar = () => {
    if (!form.nombre || !form.curso) return;
    const datos = {
      nombre: form.nombre,
      curso: form.curso,
      email:
        form.email ||
        `${form.nombre.toLowerCase().replace(/[^a-z]/g, ".")}@galileo.edu.ar`,
    };
    if (editId) {
      editarAlumno(editId, datos);
    } else {
      agregarAlumno(datos);
    }
    setForm({});
    setEditId(null);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const editar = (a: Alumno) => {
    setForm(a);
    setEditId(a.id);
  };

  const borrar = (id: string) => {
    borrarAlumno(id);
    if (editId === id) {
      setForm({});
      setEditId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gestión académica</h1>
          <p className="sub">Administrá altas, bajas y cambios de curso.</p>
        </div>
        <span className="badge badge-brand">{alumnos.length} alumnos</span>
      </div>

      <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 14 }}>{editId ? "Editar alumno" : "Nuevo alumno"}</h3>
        <div className="grid grid-3">
          <div className="field" style={{ margin: 0 }}>
            <label>Nombre y apellido</label>
            <input
              className="input"
              value={form.nombre ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. María Pérez"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Curso</label>
            <select
              className="select"
              value={form.curso ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, curso: e.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {CURSO_OPCIONES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Email</label>
            <input
              className="input"
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="opcional"
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button
            className={`btn ${guardado ? "btn-success" : "btn-primary"}`}
            onClick={guardar}
            disabled={guardado}
          >
            {guardado ? "✓ Guardado" : editId ? "Guardar cambios" : "Agregar alumno"}
          </button>
          {editId && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setForm({});
                setEditId(null);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card card-pad-lg">
        <table className="table">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Email</th>
              <th style={{ width: 150 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                <td>{a.curso}</td>
                <td className="muted text-sm">{a.email}</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-soft btn-sm" onClick={() => editar(a)}>
                      Editar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setConfirmId(a.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Borrar alumno"
        message="Esta acción no se puede deshacer. El alumno se eliminará del sistema."
        confirmLabel="Borrar"
        onConfirm={() => {
          if (confirmId) borrar(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
