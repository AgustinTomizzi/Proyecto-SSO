import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { apiSend } from "../../data/apiClient";
import { hoyLocal } from "../../data/fecha";
import ConfirmDialog from "../ui/ConfirmDialog";
import { GRUPOS, nombreDia, type AulaOpcion, type Franja, type Grupo, type Opcion } from "./grillaTipos";
import { rangoHora, type Seleccion } from "./grillaModelo";

interface Props {
  seleccion: Seleccion;
  cursoId: string;
  cursoNombre: string;
  franjas: Franja[];
  materias: Opcion[];
  docentes: Opcion[];
  aulas: AulaOpcion[];
  /** Módulos libres seguidos desde el módulo elegido para un grupo (solo para clases nuevas). */
  modulosLibres: (grupo: Grupo) => number;
  onClose: () => void;
  /** Se llama tras guardar o quitar, con el mensaje para el toast. */
  onSaved: (mensaje: string) => void;
}

const DURACION_POR_DEFECTO = 2;

export default function EditorClase({ seleccion, cursoId, cursoNombre, franjas, materias, docentes, aulas, modulosLibres, onClose, onSaved }: Props) {
  const bloque = seleccion.tipo === "editar" ? seleccion.bloque : null;
  const [materiaId, setMateriaId] = useState(bloque?.materiaId ?? "");
  const [docenteId, setDocenteId] = useState(bloque?.docenteId ?? "");
  const [aulaId, setAulaId] = useState(bloque?.aulaId ?? "");
  const [grupo, setGrupo] = useState<Grupo>(bloque ? bloque.grupo : seleccion.tipo === "nueva" ? seleccion.grupo : 0);
  const [duracion, setDuracion] = useState(() =>
    seleccion.tipo === "nueva" ? Math.max(1, Math.min(DURACION_POR_DEFECTO, modulosLibres(seleccion.grupo))) : 1
  );
  const [desde, setDesde] = useState(bloque?.vigenteDesde ?? hoyLocal());
  const [hasta, setHasta] = useState(bloque?.vigenteHasta ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const primerCampo = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    primerCampo.current?.focus();
    return () => {
      // La grilla se vuelve a dibujar al guardar: si el botón ya no existe, no hay foco que devolver.
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  useEffect(() => {
    if (confirmar) return; // el diálogo de confirmación maneja su propio Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmar, guardando, onClose]);

  const dia = bloque ? bloque.dia : seleccion.tipo === "nueva" ? seleccion.dia : 1;
  const franjaInicio = seleccion.tipo === "nueva" ? seleccion.franja : null;
  const maxDuracion = franjaInicio ? modulosLibres(grupo) : 0;
  const duracionEfectiva = Math.min(duracion, Math.max(maxDuracion, 1));
  const franjaFin = franjaInicio
    ? franjas[franjas.findIndex((f) => f.id === franjaInicio.id) + duracionEfectiva - 1] ?? franjaInicio
    : null;
  const posicion = bloque
    ? `${nombreDia(dia)} ${rangoHora(bloque.horaInicio, bloque.horaFin)}`
    : franjaInicio && franjaFin
      ? `${nombreDia(dia)} ${rangoHora(franjaInicio.horaInicio, franjaFin.horaFin)}`
      : nombreDia(dia);

  // Si la clase usa una opción que ya no está en el catálogo, se muestra igual.
  const docentesOpc = bloque?.docenteId && !docentes.some((d) => d.id === bloque.docenteId)
    ? [...docentes, { id: bloque.docenteId, nombre: bloque.docente ?? `Docente ${bloque.docenteId}` }]
    : docentes;
  const aulasOpc: AulaOpcion[] = bloque?.aulaId && !aulas.some((a) => a.id === bloque.aulaId)
    ? [...aulas, { id: bloque.aulaId, nombre: bloque.aula ?? `Aula ${bloque.aulaId}`, compartida: false }]
    : aulas;
  const materiasOpc = bloque && !materias.some((m) => m.id === bloque.materiaId)
    ? [...materias, { id: bloque.materiaId, nombre: bloque.materia }]
    : materias;

  const sinLugar = Boolean(franjaInicio) && maxDuracion === 0;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!materiaId) {
      setError("Elegí una materia.");
      primerCampo.current?.focus();
      return;
    }
    if (sinLugar) {
      setError(grupo === 0 ? "Ese módulo ya tiene una clase en alguno de los grupos. Elegí un grupo o otro módulo." : "Ese módulo ya está ocupado para el grupo elegido.");
      return;
    }
    if (!desde) {
      setError("Indicá desde cuándo rige la clase.");
      return;
    }
    if (hasta && hasta < desde) {
      setError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }
    const campos = {
      materiaId,
      docenteId: docenteId || null,
      aulaId: aulaId || null,
      grupo,
      vigenteDesde: desde,
      vigenteHasta: hasta || null,
    };
    setGuardando(true);
    setError("");
    try {
      if (bloque) {
        await apiSend("/horario_grilla.php", "PUT", { ids: bloque.ids, ...campos });
        onSaved("Clase actualizada");
      } else if (franjaInicio && franjaFin) {
        await apiSend("/horario_grilla.php", "POST", {
          cursoId,
          dia,
          franjaId: franjaInicio.id,
          franjaHastaId: franjaFin.id,
          ...campos,
        });
        onSaved("Clase agregada");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la clase");
      setGuardando(false);
    }
  }

  async function quitar() {
    if (!bloque) return;
    setConfirmar(false);
    setGuardando(true);
    setError("");
    try {
      await apiSend("/horario_grilla.php", "DELETE", { ids: bloque.ids });
      onSaved("Clase quitada");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar la clase");
      setGuardando(false);
    }
  }

  const titulo = bloque ? "Editar clase" : "Nueva clase";
  const destino = document.querySelector<HTMLElement>(".gdash") ?? document.body;
  const opcionesDuracion = Array.from({ length: Math.max(maxDuracion, 1) }, (_, i) => i + 1);

  return createPortal(
    <div className="modal-overlay grilla-editor-overlay" onMouseDown={() => !guardando && onClose()}>
      <form
        className="modal grilla-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grilla-editor-titulo"
        aria-describedby="grilla-editor-pos"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => void guardar(e)}
        noValidate
      >
        <header className="grilla-editor__head">
          <div>
            <h3 className="modal__title" id="grilla-editor-titulo">{titulo}</h3>
            <p className="modal__msg" id="grilla-editor-pos">
              {cursoNombre} · <strong>{posicion}</strong>
            </p>
          </div>
          <button type="button" className="grilla-editor__close" onClick={onClose} disabled={guardando} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="field">
          <label htmlFor="grilla-materia">Materia</label>
          <select id="grilla-materia" ref={primerCampo} className="select" value={materiaId} onChange={(e) => setMateriaId(e.target.value)} required aria-required="true">
            <option value="">Elegí una materia…</option>
            {materiasOpc.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="grilla-editor__par">
          <div className="field">
            <label htmlFor="grilla-docente">Docente</label>
            <select id="grilla-docente" className="select" value={docenteId} onChange={(e) => setDocenteId(e.target.value)}>
              <option value="">Sin asignar</option>
              {docentesOpc.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="grilla-aula">Aula</label>
            <select id="grilla-aula" className="select" value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
              <option value="">Sin aula</option>
              {aulasOpc.map((a) => <option key={a.id} value={a.id}>{a.compartida ? `${a.nombre} (compartida)` : a.nombre}</option>)}
            </select>
          </div>
        </div>

        <fieldset className="grilla-editor__grupos">
          <legend>Grupo</legend>
          <div className="grilla-chips" role="radiogroup" aria-label="Grupo">
            {GRUPOS.map((g) => (
              <label key={g.valor} className={`grilla-chip${grupo === g.valor ? " is-active" : ""}`}>
                <input type="radio" name="grilla-grupo" value={g.valor} checked={grupo === g.valor} onChange={() => setGrupo(g.valor)} />
                {g.nombre}
              </label>
            ))}
          </div>
        </fieldset>

        {franjaInicio && (
          <div className="field">
            <label htmlFor="grilla-duracion">Duración</label>
            <select
              id="grilla-duracion"
              className="select"
              value={duracionEfectiva}
              onChange={(e) => setDuracion(Number(e.target.value))}
              disabled={sinLugar}
              aria-describedby="grilla-duracion-hint"
            >
              {opcionesDuracion.map((n) => <option key={n} value={n}>{n} {n === 1 ? "módulo" : "módulos"}</option>)}
            </select>
            <small id="grilla-duracion-hint" className="grilla-editor__hint">
              {sinLugar
                ? "No hay módulos libres para ese grupo en este horario."
                : `Hasta ${maxDuracion} ${maxDuracion === 1 ? "módulo libre" : "módulos libres"} seguidos antes del próximo cambio de turno o clase.`}
            </small>
          </div>
        )}

        <div className="grilla-editor__par">
          <div className="field">
            <label htmlFor="grilla-desde">Vigente desde</label>
            <input id="grilla-desde" className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="grilla-hasta">Vigente hasta</label>
            <input id="grilla-hasta" className="input" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <p className="grilla-editor__hint">Dejá “Vigente hasta” vacío si la clase sigue sin fecha de fin.</p>

        {error && <div className="horarios-alert grilla-editor__error" role="alert">{error}</div>}

        <div className="modal__actions grilla-editor__actions">
          {bloque && (
            <button type="button" className="btn btn-danger grilla-editor__quitar" onClick={() => setConfirmar(true)} disabled={guardando}>
              Quitar clase
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
        </div>
        {/* Dentro del form: los eventos del portal no llegan al overlay y no cierran el editor. */}
        <ConfirmDialog
          open={confirmar}
          title="Quitar clase"
          message={bloque ? `Se quitará ${bloque.materia} del ${posicion.toLowerCase()}.` : undefined}
          confirmLabel="Quitar"
          onConfirm={() => void quitar()}
          onCancel={() => setConfirmar(false)}
        />
      </form>
    </div>,
    destino
  );
}
