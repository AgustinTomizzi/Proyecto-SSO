import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiGet, apiUrl } from "../../data/apiClient";
import { hoyLocal } from "../../data/fecha";
import { useToast } from "../ui/Toast";
import EditorClase from "./EditorClase";
import GrillaHorario from "./GrillaHorario";
import {
  armarBloques,
  armarLayout,
  etiquetaCurso,
  etiquetaDivision,
  ordenCambioTurno,
  ordenarCursos,
  type Seleccion,
} from "./grillaModelo";
import {
  diaDeFecha,
  fechaLegible,
  normalizarGrilla,
  type AulaOpcion,
  type CursoOpcion,
  type Grilla,
  type Opcion,
} from "./grillaTipos";
import { useImpresionGrilla } from "./useImpresionGrilla";
import "./horarios.css";

/** gestion: edita la grilla · alumno: su curso · docente: sus clases · lectura: elige curso, sin editar. */
type Modo = "gestion" | "alumno" | "docente" | "lectura";

interface CursosResponse { cursos: { id: string | number; anio: string | number; division: string | number; turno: string }[] }
interface MateriasResponse { materias: { id: string | number; nombre: string }[] }
interface CatalogosResponse {
  docentes: { id: string | number; nombre: string }[];
  aulas: { id: string | number; nombre: string; compartida?: boolean | number | string }[];
}
interface HorarioImagenResponse { cursos: { id: string | number; horarioId: string | number | null }[] }
type GrillaRaw = Parameters<typeof normalizarGrilla>[0];

const TEXTOS: Record<Modo, { titulo: string; sub: string }> = {
  gestion: { titulo: "Horarios por curso", sub: "Tocá un módulo libre para cargar una clase, o una clase para editarla." },
  alumno: { titulo: "Mi horario", sub: "Las clases de tu curso, día por día." },
  docente: { titulo: "Mis clases", sub: "Tus módulos de la semana en todos los cursos." },
  lectura: { titulo: "Horarios por curso", sub: "Consultá la grilla semanal de cada curso." },
};

function mensajeDe(cause: unknown, porDefecto: string) {
  return cause instanceof Error ? cause.message : porDefecto;
}

const opcion = (o: { id: string | number; nombre: string }): Opcion => ({ id: String(o.id), nombre: o.nombre });

export default function HorariosPage() {
  const { usuario } = useAuth();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const modo: Modo = usuario?.permisos.includes("horarios.gestionar")
    ? "gestion"
    : usuario?.rol === "alumno"
      ? "alumno"
      : usuario?.rolBackend === "Docente"
        ? "docente"
        : "lectura";
  const conSelector = modo === "gestion" || modo === "lectura";

  const [fecha, setFecha] = useState(() => hoyLocal());
  const [cursos, setCursos] = useState<CursoOpcion[]>([]);
  const [cursosCargando, setCursosCargando] = useState(conSelector);
  const [cursosError, setCursosError] = useState("");

  const [grilla, setGrilla] = useState<Grilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);

  const [materias, setMaterias] = useState<Opcion[]>([]);
  const [docentes, setDocentes] = useState<Opcion[]>([]);
  const [aulas, setAulas] = useState<AulaOpcion[]>([]);
  const [imagenCursoId, setImagenCursoId] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [exportando, setExportando] = useState<{ hecho: number; total: number } | null>(null);

  const cursoParam = searchParams.get("curso") ?? "";
  const cursoId = conSelector ? (cursos.some((c) => c.id === cursoParam) ? cursoParam : cursos[0]?.id ?? "") : "";

  const elegirCurso = useCallback((id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("curso", id);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Cursos para el selector.
  useEffect(() => {
    if (!conSelector) return;
    let vigente = true;
    apiGet<CursosResponse>("/cursos.php")
      .then((data) => {
        if (!vigente) return;
        setCursos(ordenarCursos(data.cursos.map((c) => ({ id: String(c.id), anio: String(c.anio), division: String(c.division), turno: c.turno }))));
      })
      .catch((cause) => vigente && setCursosError(mensajeDe(cause, "No se pudieron cargar los cursos")))
      .finally(() => vigente && setCursosCargando(false));
    return () => { vigente = false; };
  }, [conSelector]);

  // Catálogos del editor (solo gestión).
  useEffect(() => {
    if (modo !== "gestion") return;
    let vigente = true;
    Promise.all([
      apiGet<MateriasResponse>("/materias.php"),
      apiGet<CatalogosResponse>("/horario_grilla.php?catalogos=1"),
    ])
      .then(([m, c]) => {
        if (!vigente) return;
        setMaterias(m.materias.map(opcion));
        setDocentes(c.docentes.map(opcion));
        setAulas(
          c.aulas
            .map((a) => ({ ...opcion(a), compartida: a.compartida === true || a.compartida === 1 || a.compartida === "1" }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }))
        );
      })
      .catch((cause) => vigente && push(mensajeDe(cause, "No se pudieron cargar materias, docentes y aulas"), "error"));
    return () => { vigente = false; };
  }, [modo, push]);

  // Grilla.
  useEffect(() => {
    const params = new URLSearchParams();
    if (conSelector) {
      if (!cursoId) {
        setGrilla(null);
        setCargando(cursosCargando);
        return;
      }
      params.set("cursoId", cursoId);
    } else if (modo === "docente") {
      params.set("docenteId", usuario?.id ?? "");
    }
    if (fecha) params.set("fecha", fecha);
    let vigente = true;
    setCargando(true);
    setError("");
    apiGet<GrillaRaw>(`/horario_grilla.php?${params}`, 10_000)
      .then((data) => vigente && setGrilla(normalizarGrilla(data)))
      .catch((cause) => {
        if (!vigente) return;
        setGrilla(null);
        setError(mensajeDe(cause, "No se pudo cargar el horario"));
      })
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [conSelector, cursosCargando, modo, cursoId, fecha, usuario?.id, recarga]);

  // Imagen histórica del curso (solo lectura), si existe.
  useEffect(() => {
    setImagenCursoId(null);
    if (modo === "docente" || (conSelector && !cursoId)) return;
    let vigente = true;
    const query = conSelector ? `?cursoId=${encodeURIComponent(cursoId)}` : "";
    apiGet<HorarioImagenResponse>(`/horarios.php${query}`)
      .then((data) => {
        const curso = data.cursos[0];
        if (vigente && curso?.horarioId) setImagenCursoId(String(curso.id));
      })
      .catch(() => { /* la imagen es opcional */ });
    return () => { vigente = false; };
  }, [modo, conSelector, cursoId]);

  useImpresionGrilla();

  const cerrarEditor = useCallback(() => setSeleccion(null), []);
  const guardado = useCallback((mensaje: string) => {
    setSeleccion(null);
    push(mensaje);
    setRecarga((n) => n + 1);
  }, [push]);

  const cursoActual = grilla?.curso ?? cursos.find((c) => c.id === cursoId) ?? null;
  const anio = (grilla?.fecha || fecha).slice(0, 4);
  const nombreHoja = modo === "docente" ? usuario?.nombre ?? "Mis clases" : cursoActual ? etiquetaCurso(cursoActual) : "Horario";
  const subtitulo = modo === "docente" ? `Horario ${anio} · Docente` : `Horario ${anio}${cursoActual?.turno ? ` · Turno ${cursoActual.turno}` : ""}`;
  const pie = `Horario vigente al ${fechaLegible(grilla?.fecha || fecha)}`;

  const layout = useMemo(() => {
    if (!grilla) return null;
    const bloques = armarBloques(grilla.clases, ordenCambioTurno(grilla.franjas));
    return armarLayout(grilla.franjas, bloques, { ignorarGrupos: modo === "docente" });
  }, [grilla, modo]);

  const diaActivo = diaDeFecha(fecha);
  const textos = TEXTOS[modo];
  const totalClases = grilla?.clases.length ?? 0;
  const ocupado = exportando !== null;

  async function exportarActual() {
    if (!layout) return;
    setExportando({ hecho: 0, total: 1 });
    try {
      const { crearLibro, agregarHoja, descargarLibro } = await import("./exportarExcel");
      const libro = await crearLibro();
      agregarHoja(libro, { nombreHoja, titulo: `${nombreHoja} — Horario ${anio}`, pie, layout, mostrarCurso: modo === "docente" });
      await descargarLibro(libro, `Horario ${nombreHoja}.xlsx`);
    } catch (cause) {
      push(mensajeDe(cause, "No se pudo generar el Excel"), "error");
    } finally {
      setExportando(null);
    }
  }

  async function exportarTodos() {
    if (cursos.length === 0) return;
    setExportando({ hecho: 0, total: cursos.length });
    const fallidos: string[] = [];
    try {
      const { crearLibro, agregarHoja, descargarLibro } = await import("./exportarExcel");
      const libro = await crearLibro();
      const usados = new Set<string>();
      for (const [i, curso] of cursos.entries()) {
        const nombre = etiquetaCurso(curso);
        try {
          const data = normalizarGrilla(
            await apiGet<GrillaRaw>(`/horario_grilla.php?cursoId=${encodeURIComponent(curso.id)}&fecha=${encodeURIComponent(fecha)}`, 15_000)
          );
          const bloques = armarBloques(data.clases, ordenCambioTurno(data.franjas));
          agregarHoja(libro, {
            nombreHoja: nombre,
            titulo: `${nombre} — Horario ${anio}`,
            pie,
            layout: armarLayout(data.franjas, bloques),
          }, usados);
        } catch {
          fallidos.push(nombre);
        }
        setExportando({ hecho: i + 1, total: cursos.length });
      }
      if (fallidos.length === cursos.length) throw new Error("No se pudo cargar ningún curso");
      await descargarLibro(libro, `Horarios ${anio} (vigentes al ${fechaLegible(fecha).replace(/\//g, "-")}).xlsx`);
      if (fallidos.length > 0) push(`Se exportó el Excel, pero faltan: ${fallidos.join(", ")}`, "error");
      else push(`Excel con ${cursos.length} cursos listo`);
    } catch (cause) {
      push(mensajeDe(cause, "No se pudo generar el Excel"), "error");
    } finally {
      setExportando(null);
    }
  }

  function contenido() {
    if (cursosCargando || cargando) return <div className="horarios-loading"><span />Cargando horario...</div>;
    if (cursosError) return <Vacio titulo="No pudimos cargar los cursos" texto={cursosError} />;
    if (conSelector && cursos.length === 0) return <Vacio titulo="No hay cursos cargados" texto="Cuando se creen cursos vas a poder armar su horario acá." />;
    if (error) {
      return modo === "docente"
        ? <Vacio titulo="Tus clases todavía no están disponibles" texto={`No pudimos mostrar tu horario (${error}). Probá de nuevo más tarde.`} />
        : <Vacio titulo="No pudimos cargar el horario" texto={error} accion={<button className="btn btn-soft btn-sm" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>} />;
    }
    if (modo === "alumno" && grilla && !grilla.curso) {
      return <Vacio titulo="No hay un curso asociado" texto="Cuando se asigne tu curso, el horario aparecerá en esta sección." />;
    }
    if (!grilla || !layout || grilla.franjas.length === 0) {
      return <Vacio titulo="No hay módulos configurados" texto="Todavía no se cargaron los módulos horarios del colegio." />;
    }
    if (modo === "docente" && grilla.clases.length === 0) {
      return <Vacio titulo="No tenés clases asignadas" texto="Cuando la administración te asigne módulos en la grilla, los vas a ver acá." />;
    }
    return (
      <>
        {modo !== "gestion" && grilla.clases.length === 0 && (
          <p className="grilla-aviso">Todavía no hay clases cargadas para esta fecha.</p>
        )}
        <GrillaHorario
          layout={layout}
          titulo={nombreHoja}
          subtitulo={subtitulo}
          pie={pie}
          diaActivo={diaActivo}
          mostrarCurso={modo === "docente"}
          onBloque={modo === "gestion" ? (bloque) => setSeleccion({ tipo: "editar", bloque }) : undefined}
          onVacia={modo === "gestion" ? (dia, franja, grupo) => setSeleccion({ tipo: "nueva", dia, franja, grupo }) : undefined}
        />
      </>
    );
  }

  const hayGrilla = Boolean(layout && !cargando && !error && grilla && grilla.franjas.length > 0);

  return (
    <div className="page horarios-page">
      <div className="page-head horarios-head">
        <div>
          <span className="horarios-eyebrow">Organización semanal</span>
          <h1>{textos.titulo}</h1>
          <p className="sub">{textos.sub}</p>
        </div>
        {modo === "gestion" && grilla && !cargando && (
          <span className="badge badge-brand">{totalClases} {totalClases === 1 ? "módulo cargado" : "módulos cargados"}</span>
        )}
      </div>

      <section className="grilla-panel">
        <div className="grilla-toolbar">
          {conSelector && cursos.length > 0 && (
            <SelectorCurso cursos={cursos} cursoId={cursoId} onChange={elegirCurso} />
          )}
          <div className="grilla-toolbar__fila">
            <div className="field grilla-toolbar__field grilla-toolbar__fecha">
              <label htmlFor="grilla-fecha">Vigente al</label>
              <input id="grilla-fecha" className="input" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
            </div>
            {fecha !== hoyLocal() && (
              <button type="button" className="btn btn-ghost btn-sm grilla-toolbar__hoy" onClick={() => setFecha(hoyLocal())}>Volver a hoy</button>
            )}
            {imagenCursoId && (
              <a
                className="grilla-imagen"
                href={apiUrl(`/horarios.php?imagen=1&cursoId=${encodeURIComponent(imagenCursoId)}`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ImageIcon /> Horario anterior (imagen)
              </a>
            )}
            <div className="grilla-acciones" role="group" aria-label="Exportar horario">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()} disabled={!hayGrilla || ocupado}>
                <PrintIcon /> Imprimir / PDF
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void exportarActual()} disabled={!hayGrilla || ocupado}>
                <SheetIcon /> Excel
              </button>
              {modo === "gestion" && (
                <button type="button" className="btn btn-soft btn-sm" onClick={() => void exportarTodos()} disabled={cursos.length === 0 || ocupado}>
                  <SheetIcon /> Excel de todos los cursos
                </button>
              )}
            </div>
          </div>
          {exportando && exportando.total > 1 && (
            <div className="grilla-progreso" role="status" aria-live="polite">
              <span>Armando el Excel: {exportando.hecho} de {exportando.total} cursos…</span>
              <progress max={exportando.total} value={exportando.hecho} />
            </div>
          )}
        </div>

        {contenido()}
      </section>

      {seleccion && cursoActual && layout && grilla && (
        <EditorClase
          seleccion={seleccion}
          cursoId={cursoActual.id}
          cursoNombre={etiquetaCurso(cursoActual)}
          franjas={grilla.franjas}
          materias={materias}
          docentes={docentes}
          aulas={aulas}
          modulosLibres={(grupo) => seleccion.tipo === "nueva" ? layout.modulosLibres(seleccion.dia, seleccion.franja.orden, grupo) : 0}
          onClose={cerrarEditor}
          onSaved={guardado}
        />
      )}
    </div>
  );
}

/** Selector en dos pasos (año y división), como en horarios.galileo.edu.ar. */
function SelectorCurso({ cursos, cursoId, onChange }: { cursos: CursoOpcion[]; cursoId: string; onChange: (id: string) => void }) {
  const actual = cursos.find((c) => c.id === cursoId) ?? null;
  const anios = [...new Set(cursos.map((c) => c.anio))];
  const anioActivo = actual?.anio ?? anios[0];
  const divisiones = cursos.filter((c) => c.anio === anioActivo);

  function elegirAnio(anio: string) {
    if (anio === anioActivo) return;
    const delAnio = cursos.filter((c) => c.anio === anio);
    // Conserva la división si existe en el otro año (1º A → 2º A); si no, la primera.
    const misma = actual ? delAnio.find((c) => etiquetaDivision(c) === etiquetaDivision(actual)) : undefined;
    const destino = misma ?? delAnio[0];
    if (destino) onChange(destino.id);
  }

  return (
    <div className="grilla-cursos">
      <div className="grilla-cursos__nivel">
        <span className="grilla-cursos__rotulo" id="grilla-anio-rotulo">Año</span>
        <div className="grilla-chips" role="group" aria-labelledby="grilla-anio-rotulo">
          {anios.map((anio) => (
            <button key={anio} type="button" className={`grilla-chip${anio === anioActivo ? " is-active" : ""}`} aria-pressed={anio === anioActivo} onClick={() => elegirAnio(anio)}>
              {anio}º
            </button>
          ))}
        </div>
      </div>
      <div className="grilla-cursos__nivel">
        <span className="grilla-cursos__rotulo" id="grilla-div-rotulo">División</span>
        <div className="grilla-chips" role="group" aria-labelledby="grilla-div-rotulo">
          {divisiones.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`grilla-chip grilla-chip--div${c.id === cursoId ? " is-active" : ""}`}
              aria-pressed={c.id === cursoId}
              aria-label={`${etiquetaCurso(c)}${c.turno ? `, turno ${c.turno.toLowerCase()}` : ""}`}
              onClick={() => onChange(c.id)}
            >
              {etiquetaDivision(c)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Vacio({ titulo, texto, accion }: { titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div className="horarios-empty grilla-vacio" role="status">
      <CalendarIcon />
      <h2>{titulo}</h2>
      <p>{texto}</p>
      {accion && <div className="grilla-vacio__accion">{accion}</div>}
    </div>
  );
}

function CalendarIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>; }
function ImageIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>; }
function PrintIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>; }
function SheetIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M10 9H8"/></svg>; }
