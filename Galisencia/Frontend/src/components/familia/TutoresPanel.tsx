import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGet, apiSend } from "../../data/apiClient";
import { useStore } from "../../data/StoreContext";
import { etiquetaCurso, ordenarCursos } from "../horarios/grillaModelo";
import ConfirmDialog from "../ui/ConfirmDialog";
import EmptyState from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import "../justificaciones/justificaciones.css";
import "./familia.css";

interface Tutor {
  tutorId: string;
  nombre: string;
  apellido: string;
  email: string;
  parentesco: string | null;
  pendienteDeIngreso: boolean;
}

/** Contraseña inicial aleatoria (el tutor la cambia en su primer ingreso). */
function generarClave(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

/** Portal de familias: cuentas de tutores y su vínculo con alumnos (tutores.gestionar). */
export default function TutoresPanel() {
  const { cursos, alumnos } = useStore();
  const { push } = useToast();
  const cursosOrdenados = useMemo(() => ordenarCursos(cursos), [cursos]);
  const [cursoId, setCursoId] = useState("");
  const [alumnoId, setAlumnoId] = useState("");
  const [modo, setModo] = useState<"nueva" | "existente">("nueva");
  const [form, setForm] = useState({ email: "", nombre: "", apellido: "", parentesco: "", clave: generarClave() });
  const [parentescos, setParentescos] = useState<string[]>([]);
  const [tutores, setTutores] = useState<Tutor[] | null>(null);
  const [errorLista, setErrorLista] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aQuitar, setAQuitar] = useState<Tutor | null>(null);

  const cursoActual = cursoId || cursosOrdenados[0]?.id || "";
  const alumnosCurso = useMemo(
    () => alumnos.filter((a) => String(a.cursoId) === String(cursoActual)).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es")),
    [alumnos, cursoActual]
  );
  const alumno = alumnosCurso.find((a) => a.id === alumnoId) ?? null;

  const cargar = useCallback(async () => {
    if (!alumnoId) { setTutores(null); return; }
    setErrorLista("");
    try {
      const data = await apiGet<{ ok: true; tutores: Tutor[]; parentescos: string[] }>(`/tutores.php?alumnoId=${encodeURIComponent(alumnoId)}`, 10000);
      setTutores(data.tutores);
      setParentescos(data.parentescos);
    } catch (e) {
      setErrorLista(e instanceof Error ? e.message : "No se pudieron cargar los tutores.");
    }
  }, [alumnoId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  async function vincular(event: FormEvent) {
    event.preventDefault();
    setErrorForm("");
    if (!alumnoId) return setErrorForm("Elegí el alumno.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setErrorForm("Escribí un email válido.");
    if (modo === "nueva" && (!form.nombre.trim() || !form.apellido.trim() || form.clave.length < 8)) {
      return setErrorForm("Para una cuenta nueva hacen falta nombre, apellido y una contraseña inicial de al menos 8 caracteres.");
    }
    setGuardando(true);
    try {
      const cuerpo = {
        alumnoId,
        email: form.email.trim(),
        parentesco: form.parentesco || undefined,
        ...(modo === "nueva" ? { nombre: form.nombre.trim(), apellido: form.apellido.trim(), passwordInicial: form.clave } : {}),
      };
      const data = await apiSend<{ ok: true; cuentaCreada: boolean }>("/tutores.php", "POST", cuerpo);
      push(data.cuentaCreada
        ? `Cuenta creada y vinculada. Pasale a la familia su email y la contraseña inicial: ${form.clave}`
        : "Tutor vinculado con su cuenta existente.");
      setForm({ email: "", nombre: "", apellido: "", parentesco: "", clave: generarClave() });
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo vincular al tutor.");
    } finally {
      setGuardando(false);
    }
  }

  async function desvincular() {
    if (!aQuitar) return;
    try {
      await apiSend("/tutores.php", "DELETE", { tutorId: aQuitar.tutorId, alumnoId });
      push("Vínculo quitado.");
      setAQuitar(null);
      await cargar();
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudo quitar el vínculo.", "error");
    }
  }

  const set = (campo: keyof typeof form, valor: string) => setForm((actual) => ({ ...actual, [campo]: valor }));

  return (
    <div className="justificaciones">
      <form className="card card-pad-lg" onSubmit={vincular} noValidate>
        <h3>Vincular un tutor</h3>
        <p className="muted text-sm justificaciones__ayuda">El tutor entra a Galisencia con su email y ve solo la asistencia, las justificaciones y el horario de sus hijos. Recibe un aviso diario por email cuando faltan.</p>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="tutor-curso">Curso</label>
            <select id="tutor-curso" className="select" value={cursoActual} onChange={(e) => { setCursoId(e.target.value); setAlumnoId(""); }}>
              {cursosOrdenados.map((c) => <option key={c.id} value={c.id}>{etiquetaCurso({ anio: c.anio.replace(/\D/g, ""), division: c.division })}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="tutor-alumno">Alumno</label>
            <select id="tutor-alumno" className="select" value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {alumnosCurso.map((a) => <option key={a.id} value={a.id}>{`${a.apellido}, ${a.nombre}`}</option>)}
            </select>
          </div>
        </div>
        <div className="suplencias-tabs" role="radiogroup" aria-label="Tipo de cuenta" style={{ marginTop: 14 }}>
          <button type="button" role="radio" aria-checked={modo === "nueva"} className={`btn btn-sm ${modo === "nueva" ? "btn-soft" : "btn-ghost"}`} onClick={() => setModo("nueva")}>Cuenta nueva</button>
          <button type="button" role="radio" aria-checked={modo === "existente"} className={`btn btn-sm ${modo === "existente" ? "btn-soft" : "btn-ghost"}`} onClick={() => setModo("existente")}>Ya tiene cuenta (otro hijo)</button>
        </div>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="tutor-email">Email del tutor</label>
            <input id="tutor-email" className="input" type="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="tutor-parentesco">Parentesco</label>
            <select id="tutor-parentesco" className="select" value={form.parentesco} onChange={(e) => set("parentesco", e.target.value)}>
              <option value="">Sin especificar</option>
              {parentescos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {modo === "nueva" && <>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="tutor-nombre">Nombre</label>
              <input id="tutor-nombre" className="input" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="tutor-apellido">Apellido</label>
              <input id="tutor-apellido" className="input" value={form.apellido} onChange={(e) => set("apellido", e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="tutor-clave">Contraseña inicial (la cambia al entrar)</label>
              <div className="row" style={{ gap: 8 }}>
                <input id="tutor-clave" className="input" value={form.clave} onChange={(e) => set("clave", e.target.value)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("clave", generarClave())}>Generar</button>
              </div>
            </div>
          </>}
        </div>
        {errorForm && <p className="asistencia-dashboard__error" role="alert" style={{ marginTop: 14 }}>{errorForm}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={guardando || !alumnoId}>{guardando ? "Guardando..." : modo === "nueva" ? "Crear cuenta y vincular" : "Vincular"}</button>
        </div>
      </form>

      <div className="card card-pad-lg">
        <div className="row spread justificaciones__lista-head">
          <h3>{alumno ? `Tutores de ${alumno.nombre} ${alumno.apellido}` : "Tutores"}</h3>
          {tutores && <span className="badge badge-brand">{tutores.length}</span>}
        </div>
        {!alumnoId ? (
          <p className="muted text-sm">Elegí un alumno para ver sus tutores.</p>
        ) : errorLista ? (
          <div className="justificaciones__error">
            <p className="asistencia-dashboard__error" role="alert">{errorLista}</p>
            <button type="button" className="btn btn-soft btn-sm" onClick={() => void cargar()}>Reintentar</button>
          </div>
        ) : tutores === null ? (
          <p className="muted text-sm" role="status">Cargando tutores...</p>
        ) : tutores.length === 0 ? (
          <EmptyState icon="👪" title="Sin tutores vinculados" description="Vinculá a la familia con el formulario." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tutor</th><th>Email</th><th>Parentesco</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {tutores.map((t) => (
                  <tr key={t.tutorId}>
                    <td style={{ fontWeight: 600 }}>{`${t.nombre} ${t.apellido}`}</td>
                    <td className="muted text-sm">{t.email}</td>
                    <td>{t.parentesco ?? "—"}</td>
                    <td>{t.pendienteDeIngreso ? <span className="badge badge-warning">Sin primer ingreso</span> : <span className="badge badge-success">Activa</span>}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAQuitar(t)} aria-label={`Desvincular a ${t.nombre} ${t.apellido}`}>Desvincular</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={aQuitar !== null}
        title="Desvincular tutor"
        message={aQuitar && alumno ? `${aQuitar.nombre} ${aQuitar.apellido} deja de ver la información de ${alumno.nombre}. La cuenta sigue existiendo.` : undefined}
        confirmLabel="Desvincular"
        danger
        onConfirm={() => void desvincular()}
        onCancel={() => setAQuitar(null)}
      />
    </div>
  );
}
