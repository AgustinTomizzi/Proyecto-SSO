import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import { apiGet, apiSend } from "../../data/apiClient";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";
import type { Alumno, Curso } from "../../data/types";

interface Preceptor {
  id: string;
  nombre: string;
  apellido: string;
  rol: string;
}

export default function GestionPage() {
  const { alumnos, cursos, agregarAlumno, editarAlumno, borrarAlumno } = useStore();
  const { push } = useToast();
  const [form, setForm] = useState<Partial<Alumno>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cursosAsignables, setCursosAsignables] = useState<Curso[]>([]);
  const [preceptores, setPreceptores] = useState<Preceptor[]>([]);
  const [guardandoCurso, setGuardandoCurso] = useState<string | null>(null);

  const CURSO_OPCIONES = useMemo(
    () => cursos.map((c) => `${c.anio} ${c.division}`),
    [cursos]
  );

  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiGet<{ ok: true; cursos: Curso[] }>("/cursos.php"),
      apiGet<{ ok: true; usuarios: Preceptor[] }>("/usuarios.php"),
    ])
      .then(([cursosData, usuariosData]) => {
        if (cancelled) return;
        setCursosAsignables(
          cursosData.cursos.map((curso) => ({
            ...curso,
            id: String(curso.id),
            preceptorId: curso.preceptorId == null ? null : String(curso.preceptorId),
          }))
        );
        setPreceptores(
          usuariosData.usuarios
            .filter((usuario) => usuario.rol.toLowerCase() === "preceptor")
            .map((usuario) => ({ ...usuario, id: String(usuario.id) }))
        );
      })
      .catch((error) => {
        if (!cancelled) {
          push(`No se pudo cargar la asignación de cursos: ${error instanceof Error ? error.message : "error desconocido"}`, "error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [push]);

  const asignarPreceptor = async (cursoId: string, preceptorId: string) => {
    setGuardandoCurso(cursoId);
    try {
      const data = await apiSend<{
        ok: true;
        curso: { preceptorId: string | null; preceptor: string | null };
      }>("/cursos.php", "PUT", {
        id: cursoId,
        preceptorId: preceptorId || null,
      });
      setCursosAsignables((actuales) =>
        actuales.map((curso) =>
          curso.id === cursoId
            ? { ...curso, preceptorId: data.curso.preceptorId, preceptor: data.curso.preceptor }
            : curso
        )
      );
      push(preceptorId ? "Preceptor asignado correctamente" : "Curso sin preceptor asignado");
    } catch (error) {
      push(`No se pudo guardar: ${error instanceof Error ? error.message : "error desconocido"}`, "error");
    } finally {
      setGuardandoCurso(null);
    }
  };

  const guardar = () => {
    if (!form.nombre || !form.curso) return;
    const datos = {
      nombre: form.nombre,
      apellido: form.apellido,
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
        <div className="row spread row-wrap" style={{ marginBottom: 14 }}>
          <div>
            <h3>Cursos y preceptores</h3>
            <p className="muted text-sm">La asignación determina qué alumnos puede gestionar cada preceptor.</p>
          </div>
          <span className="badge badge-info">{cursosAsignables.length} cursos</span>
        </div>

        {cursosAsignables.length === 0 ? (
          <EmptyState icon="🏫" title="Sin cursos" description="No se pudieron cargar cursos desde el backend." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Turno</th>
                  <th>Preceptor asignado</th>
                </tr>
              </thead>
              <tbody>
                {cursosAsignables.map((curso) => (
                  <tr key={curso.id}>
                    <td style={{ fontWeight: 600 }}>{curso.anio} {curso.division}</td>
                    <td>{curso.turno}</td>
                    <td style={{ minWidth: 260 }}>
                      <select
                        className="select"
                        value={curso.preceptorId ?? ""}
                        disabled={guardandoCurso === curso.id}
                        onChange={(event) => asignarPreceptor(curso.id, event.target.value)}
                      >
                        <option value="">Sin asignar</option>
                        {preceptores.map((preceptor) => (
                          <option key={preceptor.id} value={preceptor.id}>
                            {preceptor.nombre} {preceptor.apellido}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad-lg" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 14 }}>{editId ? "Editar alumno" : "Nuevo alumno"}</h3>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label>Nombre</label>
            <input
              className="input"
              value={form.nombre ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. María"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Apellido</label>
            <input
              className="input"
              value={form.apellido ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
              placeholder="Ej. Pérez"
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
        {alumnos.length === 0 ? (
          <EmptyState icon="👥" title="No hay alumnos" description="Agregá un alumno con el formulario de arriba para empezar." />
        ) : (
          <div className="table-wrap">
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
        )}
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
