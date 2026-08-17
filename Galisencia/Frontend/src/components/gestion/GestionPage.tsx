import { useState } from "react";
import { getAlumnos } from "../../data/mock";
import type { Alumno } from "../../data/types";

const CURSO_OPCIONES = [
  "1.º A", "1.º B", "2.º A", "2.º B", "3.º A",
];

export default function GestionPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>(() => getAlumnos());
  const [form, setForm] = useState<Partial<Alumno>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const guardar = () => {
    if (!form.nombre || !form.curso) return;
    const base: Alumno = {
      id: editId ?? `nuevo-${Date.now()}`,
      nombre: form.nombre,
      curso: form.curso,
      email:
        form.email ||
        `${form.nombre.toLowerCase().replace(/[^a-z]/g, ".")}@galileo.edu.ar`,
    };
    if (editId) {
      setAlumnos((prev) => prev.map((a) => (a.id === editId ? base : a)));
    } else {
      setAlumnos((prev) => [...prev, base]);
    }
    setForm({});
    setEditId(null);
  };

  const editar = (a: Alumno) => {
    setForm(a);
    setEditId(a.id);
  };

  const borrar = (id: string) => {
    setAlumnos((prev) => prev.filter((a) => a.id !== id));
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
          <button className="btn btn-primary" onClick={guardar}>
            {editId ? "Guardar cambios" : "Agregar alumno"}
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
                    <button className="btn btn-danger btn-sm" onClick={() => borrar(a.id)}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
