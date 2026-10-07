import { useMemo, useState } from "react";
import { useStore } from "../../data/StoreContext";
import EmptyState from "../ui/EmptyState";
import ConfirmDialog from "../ui/ConfirmDialog";
import type { Alumno } from "../../data/types";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../auth/AuthContext";
import SuplenciasPanel from "../suplencias/SuplenciasPanel";
import PromocionPanel from "../promocion/PromocionPanel";
import JustificacionesPanel from "../justificaciones/JustificacionesPanel";
import TutoresPanel from "../familia/TutoresPanel";
import { descargarDatos } from "../privacidad/descargarDatos";

type Vista = "alumnos" | "suplencias" | "justificaciones" | "familias" | "promocion";

export default function GestionPage() {
  const { alumnos, cursos, agregarAlumno, editarAlumno, borrarAlumno, reintentarCarga } = useStore();
  const { usuario } = useAuth();
  const puedeSuplencias =
    (usuario?.permisos.includes("suplencias.crear") ?? false) &&
    (usuario?.permisos.includes("cursos.asignar") ?? false);
  const puedePromocion = usuario?.permisos.includes("ciclos.promover") ?? false;
  const puedeJustificar = usuario?.permisos.includes("asistencia.justificar") ?? false;
  const puedeFamilias = usuario?.permisos.includes("tutores.gestionar") ?? false;
  const puedeExportar = usuario?.permisos.includes("datos.exportar") ?? false;
  const pestanas: [Vista, string][] = [
    ["alumnos", "Alumnos"],
    ...(puedeSuplencias ? [["suplencias", "Suplencias"] as [Vista, string]] : []),
    ...(puedeJustificar ? [["justificaciones", "Justificaciones"] as [Vista, string]] : []),
    ...(puedeFamilias ? [["familias", "Familias"] as [Vista, string]] : []),
    ...(puedePromocion ? [["promocion", "Promoción"] as [Vista, string]] : []),
  ];
  const conPestanas = pestanas.length > 1;
  const [vista, setVista] = useState<Vista>("alumnos");
  const vistaActual: Vista = pestanas.some(([clave]) => clave === vista) ? vista : "alumnos";
  const [form, setForm] = useState<Partial<Alumno>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const { push } = useToast();

  const CURSO_OPCIONES = useMemo(
    () => cursos.map((c) => `${c.anio} ${c.division}`),
    [cursos]
  );

  const guardar = async () => {
    const nombre = form.nombre?.trim() ?? "";
    const apellido = form.apellido?.trim() ?? "";
    const email = form.email?.trim() ?? "";
    const dni = form.dni?.trim() ?? "";
    if (!nombre || !apellido || !form.curso) {
      setError("Nombre, apellido y curso son obligatorios.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresá un email válido.");
      return;
    }
    if (dni && !/^\d{7,9}$/.test(dni)) {
      setError("El DNI debe contener entre 7 y 9 dígitos.");
      return;
    }
    const cursoSeleccionado = cursos.find((c) => `${c.anio} ${c.division}` === form.curso);
    if (!cursoSeleccionado) {
      setError("Seleccioná un curso válido.");
      return;
    }
    const datos = {
      nombre,
      apellido,
      dni,
      curso: form.curso,
      cursoId: String(cursoSeleccionado.id),
      division: cursoSeleccionado.division,
      email:
        email ||
        `${nombre.toLowerCase().replace(/[^a-z]/g, ".")}.${apellido.toLowerCase().replace(/[^a-z]/g, ".")}@galileo.edu.ar`,
    };
    setGuardando(true);
    setError("");
    try {
      if (editId) await editarAlumno(editId, datos);
      else await agregarAlumno(datos);
      setForm({});
      setEditId(null);
      push(editId ? "Alumno actualizado" : "Alumno agregado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el alumno");
    } finally {
      setGuardando(false);
    }
  };

  const editar = (a: Alumno) => {
    setForm(a);
    setEditId(a.id);
  };

  const borrar = async (id: string) => {
    try {
      await borrarAlumno(id);
      if (editId === id) {
        setForm({});
        setEditId(null);
      }
      setConfirmId(null);
      push("Alumno dado de baja");
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudo dar de baja al alumno", "error");
    }
  };

  // Derecho de acceso: descarga el JSON con los datos personales del alumno.
  const exportarDatos = async (id: string) => {
    try {
      await descargarDatos(id);
      push("Datos del alumno descargados");
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudieron exportar los datos", "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Gestión académica</h1>
          <p className="sub">
            {vistaActual === "suplencias"
              ? "Asigná preceptores suplentes a cursos por un período."
              : vistaActual === "justificaciones"
                ? "Justificá inasistencias de cualquier curso, con certificado si hace falta."
              : vistaActual === "familias"
                ? "Cuentas de las familias y su vínculo con los alumnos."
              : vistaActual === "promocion"
                ? "Cerrá el año: promociones, repitencias, egresos y cierre del ciclo lectivo."
                : "Administrá altas, bajas y cambios de curso."}
          </p>
        </div>
        {vistaActual === "alumnos" && <span className="badge badge-brand">{alumnos.length} alumnos</span>}
      </div>

      {conPestanas && (
        <div className="suplencias-tabs" role="tablist" aria-label="Secciones de gestión académica">
          {pestanas.map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              id={`gestion-tab-${clave}`}
              aria-selected={vistaActual === clave}
              aria-controls={`gestion-panel-${clave}`}
              className={`btn btn-sm ${vistaActual === clave ? "btn-soft" : "btn-ghost"}`}
              onClick={() => setVista(clave)}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {vistaActual === "suplencias" ? (
        <div role="tabpanel" id="gestion-panel-suplencias" aria-labelledby="gestion-tab-suplencias">
          <SuplenciasPanel onCambio={reintentarCarga} />
        </div>
      ) : vistaActual === "justificaciones" ? (
        <div role="tabpanel" id="gestion-panel-justificaciones" aria-labelledby="gestion-tab-justificaciones">
          <JustificacionesPanel onCambio={reintentarCarga} />
        </div>
      ) : vistaActual === "familias" ? (
        <div role="tabpanel" id="gestion-panel-familias" aria-labelledby="gestion-tab-familias">
          <TutoresPanel />
        </div>
      ) : vistaActual === "promocion" ? (
        <div role="tabpanel" id="gestion-panel-promocion" aria-labelledby="gestion-tab-promocion">
          <PromocionPanel onCambio={reintentarCarga} />
        </div>
      ) : (
        <div role={conPestanas ? "tabpanel" : undefined} id="gestion-panel-alumnos" aria-labelledby={conPestanas ? "gestion-tab-alumnos" : undefined}>

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
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="opcional"
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>DNI</label>
              <input
                className="input"
                inputMode="numeric"
                value={form.dni ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                placeholder="Solo números (opcional)"
              />
            </div>
          </div>
          {error && <p className="asistencia-dashboard__error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : editId ? "Guardar cambios" : "Agregar alumno"}
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
                      <td style={{ fontWeight: 600 }}>{`${a.nombre} ${a.apellido}`.trim()}</td>
                      <td>{a.curso}</td>
                      <td className="muted text-sm">{a.email}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn btn-soft btn-sm" onClick={() => editar(a)}>
                            Editar
                          </button>
                          {puedeExportar && (
                            <button className="btn btn-ghost btn-sm" onClick={() => void exportarDatos(a.id)} aria-label={`Exportar los datos personales de ${a.nombre} ${a.apellido}`}>
                              Datos
                            </button>
                          )}
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
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Borrar alumno"
        message="Esta acción no se puede deshacer. El alumno se eliminará del sistema."
        confirmLabel="Borrar"
        onConfirm={() => {
          if (confirmId) void borrar(confirmId);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
