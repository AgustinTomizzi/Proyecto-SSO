import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Alumno,
  Curso,
  EstadoAsistencia,
  Materia,
  EstadoCargable,
  RegistroAsistencia,
  ReglasAsistencia,
} from "./types";
import { MATERIAS, REGLAS_DEMO, esMismaMateria, reglasDesdeConfig } from "./types";
import {
  CURSOS,
  buildAlumnos,
  buildRegistros,
  calcularEstadisticasAlumno,
  resumenInstitucional,
  type EstadisticaAlumno,
  type ResumenInstitucional,
} from "./mock";
import { apiGet, apiSend } from "./apiClient";
import { useAuth } from "../auth/AuthContext";
import { limpiarDatosLocales } from "./localData";

limpiarDatosLocales();

interface DatosDemo {
  alumnos: Alumno[];
  cursos: Curso[];
  registros: RegistroAsistencia[];
  materias: Materia[];
}

function normalizarRegistros(registros: RegistroAsistencia[]): RegistroAsistencia[] {
  return registros.map((r) => ({
    ...r,
    id: String(r.id),
    alumnoId: String(r.alumnoId),
    materiaId: r.materiaId === undefined || r.materiaId === null ? undefined : String(r.materiaId),
    justificacionId: r.justificacionId === undefined || r.justificacionId === null ? null : String(r.justificacionId),
  }));
}

function normalizarMaterias(materias: Materia[]): Materia[] {
  return materias.map((m) => ({ id: String(m.id), nombre: String(m.nombre) }));
}

function normalizarAlumno(a: Partial<Alumno> & { id: string | number }): Alumno {
  const partes = String(a.nombre ?? "").trim().split(/\s+/).filter(Boolean);
  const apellido = a.apellido ?? (partes.length > 1 ? partes.pop() ?? "" : "");
  const curso = String(a.curso ?? "");
  return {
    id: String(a.id),
    nombre: a.apellido ? String(a.nombre ?? "") : partes.join(" "),
    apellido: String(apellido),
    dni: String(a.dni ?? ""),
    curso,
    cursoId: String(a.cursoId ?? ""),
    division: String(a.division ?? curso.trim().split(/\s+/).at(-1) ?? ""),
    email: String(a.email ?? ""),
  };
}

interface PaginaAsistencias {
  ok: true;
  registros: RegistroAsistencia[];
  total?: number;
}

// La API pagina las asistencias (máximo 500 por página): se recorren todas.
async function cargarAsistencias(filtro = ""): Promise<RegistroAsistencia[]> {
  const LIMITE = 500;
  const todas: RegistroAsistencia[] = [];
  for (let pagina = 1; pagina <= 200; pagina++) {
    const separador = filtro ? "&" : "";
    const data = await apiGet<PaginaAsistencias>(`/asistencias.php?${filtro}${separador}limit=${LIMITE}&page=${pagina}`);
    todas.push(...data.registros);
    if (data.registros.length < LIMITE || (data.total !== undefined && todas.length >= data.total)) break;
  }
  return todas;
}

interface ConfigInstitucion {
  ok: true;
  valores: Record<string, unknown>;
}

async function cargarReglas(): Promise<ReglasAsistencia> {
  const data = await apiGet<ConfigInstitucion>("/config_institucion.php");
  return reglasDesdeConfig(data.valores ?? {});
}

// Los datos de demostración se generan en memoria y nunca se persisten en el
// navegador: los datos reales de alumnos no deben quedar en localStorage.
function datosDemo(): DatosDemo {
  const alumnos = buildAlumnos();
  return {
    alumnos,
    cursos: CURSOS,
    registros: buildRegistros(alumnos),
    materias: MATERIAS.map((nombre, i) => ({ id: `demo-${i}`, nombre })),
  };
}

export interface StoreState {
  alumnos: Alumno[];
  cursos: Curso[];
  registros: RegistroAsistencia[];
  /** Catálogo de materias (de la API con sesión; demo sin sesión). */
  materias: Materia[];
  /** Reglas de cálculo (de la API con sesión; las por defecto en la demo). */
  reglas: ReglasAsistencia;
  /** Reemplaza las reglas después de editarlas (config_institucion.php). */
  actualizarReglas: (reglas: ReglasAsistencia) => void;
  getRegistrosDeAlumno: (alumnoId: string) => RegistroAsistencia[];
  estadisticasAlumno: (alumnoId: string) => EstadisticaAlumno | null;
  resumen: ResumenInstitucional;
  tieneRegistro: (alumnoId: string, materia: Materia, fecha: string) => boolean;
  marcarAsistencia: (
    alumnoId: string,
    fecha: string,
    materia: Materia,
    estado: EstadoCargable
  ) => Promise<EstadoAsistencia>;
  agregarAlumno: (datos: Omit<Alumno, "id"> & { id?: string }) => Promise<void>;
  editarAlumno: (
    id: string,
    datos: Partial<Alumno> & { currentPassword?: string }
  ) => Promise<void>;
  borrarAlumno: (id: string, currentPassword?: string) => Promise<void>;
  resetDemo: () => void;
  /** Mensaje si hay sesión pero la API no respondió; los datos quedan vacíos. */
  errorConexion: string | null;
  cargando: boolean;
  reintentarCarga: () => void;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const inicial = useMemo(datosDemo, []);
  const [alumnos, setAlumnos] = useState<Alumno[]>(inicial.alumnos);
  const [cursos, setCursos] = useState<Curso[]>(inicial.cursos);
  const [registros, setRegistros] = useState<RegistroAsistencia[]>(inicial.registros);
  const [materias, setMaterias] = useState<Materia[]>(inicial.materias);
  const [reglas, setReglas] = useState<ReglasAsistencia>(REGLAS_DEMO);
  const { usuario } = useAuth();
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [intentoCarga, setIntentoCarga] = useState(0);

  // Carga los datos del backend autenticado. Se re-ejecuta al cambiar el
  // usuario (login / sesion restaurada). El alumno solo puede ver sus propias
  // asistencias; el resto de roles ve el listado completo. Sin sesion usa mock;
  // con sesion nunca: si la API falla se vacian los datos y se avisa.
  useEffect(() => {
    if (!usuario) {
      const init = datosDemo();
      setAlumnos(init.alumnos);
      setCursos(init.cursos);
      setRegistros(init.registros);
      setMaterias(init.materias);
      setReglas(REGLAS_DEMO);
      setErrorConexion(null);
      setCargando(false);
      return;
    }
    if (usuario.debeCambiarPassword || usuario.debeAceptarPolitica) return;
    let cancelled = false;
    setCargando(true);
    (async () => {
      try {
        if (usuario.rol === "tutor") {
          // Portal de familias: el backend limita la asistencia a sus alumnos vinculados.
          const [as, ma, re] = await Promise.all([
            cargarAsistencias(),
            apiGet<{ ok: true; materias: Materia[] }>("/materias.php"),
            cargarReglas(),
          ]);
          if (cancelled) return;
          setAlumnos((usuario.alumnos ?? []).map((a) => ({
            id: a.id,
            nombre: a.nombre,
            apellido: a.apellido,
            dni: "",
            curso: a.curso ?? "",
            cursoId: a.cursoId ?? "",
            division: a.curso?.trim().split(/\s+/).at(-1) ?? "",
            email: "",
          })));
          setCursos([]);
          setRegistros(normalizarRegistros(as));
          setMaterias(normalizarMaterias(ma.materias));
          setReglas(re);
        } else if (usuario.rol === "alumno") {
          const [as, ma, re] = await Promise.all([
            cargarAsistencias(`alumnoId=${encodeURIComponent(usuario.id)}`),
            apiGet<{ ok: true; materias: Materia[] }>("/materias.php"),
            cargarReglas(),
          ]);
          if (cancelled) return;
          const miAlumno: Alumno = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: "",
            dni: "",
            curso: usuario.curso ?? "",
            cursoId: "",
            division: usuario.curso?.trim().split(/\s+/).at(-1) ?? "",
            email: usuario.email,
          };
          setAlumnos([miAlumno]);
          setCursos([]);
          setRegistros(normalizarRegistros(as));
          setMaterias(normalizarMaterias(ma.materias));
          setReglas(re);
        } else {
          const [al, cu, as, ma, re] = await Promise.all([
            apiGet<{ ok: true; alumnos: Alumno[] }>("/alumnos.php"),
            apiGet<{ ok: true; cursos: Curso[] }>("/cursos.php"),
            cargarAsistencias(),
            apiGet<{ ok: true; materias: Materia[] }>("/materias.php"),
            cargarReglas(),
          ]);
          if (cancelled) return;
          setAlumnos(al.alumnos.map(normalizarAlumno));
          setCursos(cu.cursos.map((c) => ({ ...c, id: String(c.id) })));
          setRegistros(normalizarRegistros(as));
          setMaterias(normalizarMaterias(ma.materias));
          setReglas(re);
        }
        setErrorConexion(null);
      } catch (error) {
        if (cancelled) return;
        setAlumnos([]);
        setCursos([]);
        setRegistros([]);
        setMaterias([]);
        // Error de red o timeout de apiGet: mensaje claro en lugar del técnico.
        const sinRespuesta = error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
        setErrorConexion(sinRespuesta || !(error instanceof Error) ? "El servidor no respondió." : error.message);
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usuario, intentoCarga]);

  const reintentarCarga = useCallback(() => setIntentoCarga((n) => n + 1), []);

  const getRegistrosDeAlumno = useCallback(
    (alumnoId: string) => registros.filter((r) => r.alumnoId === alumnoId),
    [registros]
  );

  const estadisticasAlumno = useCallback(
    (alumnoId: string) => {
      if (!alumnos.some((a) => a.id === alumnoId)) return null;
      return calcularEstadisticasAlumno(alumnos, registros, alumnoId, reglas);
    },
    [alumnos, registros, reglas]
  );

  const resumen = useMemo(
    () => resumenInstitucional(alumnos, registros, cursos, reglas),
    [alumnos, registros, cursos, reglas]
  );

  const marcarAsistencia = useCallback(
    // Devuelve el estado guardado: una ausencia dentro de una justificación
    // vuelve como "justificado".
    async (alumnoId: string, fecha: string, materia: Materia, estado: EstadoCargable) => {
      const data = await apiSend<{ ok: true; registro: RegistroAsistencia }>(
        "/asistencias.php",
        "POST",
        { alumnoId, fecha, materiaId: materia.id, estado }
      );
      const registro = normalizarRegistros([data.registro])[0];
      setRegistros((prev) => {
        const idx = prev.findIndex(
          (r) => r.alumnoId === alumnoId && r.fecha === fecha && esMismaMateria(r, materia)
        );
        if (idx >= 0) {
          const copia = [...prev];
          copia[idx] = registro;
          return copia;
        }
        return [
          ...prev,
          registro,
        ];
      });
      return registro.estado;
    },
    []
  );

  const tieneRegistro = useCallback(
    (alumnoId: string, materia: Materia, fecha: string) =>
      registros.some(
        (r) => r.alumnoId === alumnoId && esMismaMateria(r, materia) && r.fecha === fecha
      ),
    [registros]
  );

  const agregarAlumno = useCallback(
    async (datos: Omit<Alumno, "id"> & { id?: string }) => {
      const data = await apiSend<{ ok: true; alumno: Alumno }>("/alumnos.php", "POST", datos);
      setAlumnos((prev) => [...prev, normalizarAlumno({ ...datos, ...data.alumno })]);
    },
    []
  );

  const editarAlumno = useCallback(async (
    id: string,
    datos: Partial<Alumno> & { currentPassword?: string }
  ) => {
    const actual = alumnos.find((a) => a.id === id);
    if (!actual) throw new Error("Alumno no encontrado");
    const actualizado = { ...actual, ...datos, id };
    await apiSend("/alumnos.php", "PUT", actualizado);
    setAlumnos((prev) => prev.map((a) => (a.id === id ? normalizarAlumno(actualizado) : a)));
  }, [alumnos]);

  const borrarAlumno = useCallback(async (id: string, currentPassword?: string) => {
    await apiSend(`/alumnos.php?id=${encodeURIComponent(id)}`, "DELETE", currentPassword ? { currentPassword } : undefined);
    setAlumnos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const resetDemo = useCallback(() => {
    const sembrados = buildAlumnos();
    setAlumnos(sembrados);
    setRegistros(buildRegistros(sembrados));
  }, []);

  const value: StoreState = {
    alumnos,
    cursos,
    registros,
    materias,
    reglas,
    actualizarReglas: setReglas,
    getRegistrosDeAlumno,
    estadisticasAlumno,
    resumen,
    tieneRegistro,
    marcarAsistencia,
    agregarAlumno,
    editarAlumno,
    borrarAlumno,
    resetDemo,
    errorConexion,
    cargando,
    reintentarCarga,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
