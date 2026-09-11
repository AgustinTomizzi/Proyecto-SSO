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
  RegistroAsistencia,
} from "./types";
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

const STORAGE_KEY = "galisencia.data";

interface Persistido {
  alumnos: Alumno[];
  cursos: Curso[];
  registros: RegistroAsistencia[];
}

function normalizarRegistros(registros: RegistroAsistencia[]): RegistroAsistencia[] {
  return registros.map((r) => ({
    ...r,
    id: String(r.id),
    alumnoId: String(r.alumnoId),
  }));
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

function cargarInicial(): Persistido {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Persistido>;
      if (d.alumnos?.length && d.registros?.length && d.cursos?.length) {
        return {
          alumnos: d.alumnos.map((a) => normalizarAlumno(a)),
          cursos: d.cursos,
          registros: normalizarRegistros(d.registros),
        };
      }
    }
  } catch {
    /* noop */
  }
  const alumnos = buildAlumnos();
  return { alumnos, cursos: CURSOS, registros: buildRegistros(alumnos) };
}

export interface StoreState {
  alumnos: Alumno[];
  cursos: Curso[];
  registros: RegistroAsistencia[];
  getRegistrosDeAlumno: (alumnoId: string) => RegistroAsistencia[];
  estadisticasAlumno: (alumnoId: string) => EstadisticaAlumno | null;
  resumen: ResumenInstitucional;
  tieneRegistro: (alumnoId: string, materia: string, fecha: string) => boolean;
  marcarAsistencia: (
    alumnoId: string,
    fecha: string,
    materia: string,
    estado: EstadoAsistencia
  ) => Promise<void>;
  agregarAlumno: (datos: Omit<Alumno, "id"> & { id?: string }) => Promise<void>;
  editarAlumno: (
    id: string,
    datos: Partial<Alumno> & { currentPassword?: string }
  ) => Promise<void>;
  borrarAlumno: (id: string, currentPassword?: string) => Promise<void>;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const inicial = useMemo(cargarInicial, []);
  const [alumnos, setAlumnos] = useState<Alumno[]>(inicial.alumnos);
  const [cursos, setCursos] = useState<Curso[]>(inicial.cursos);
  const [registros, setRegistros] = useState<RegistroAsistencia[]>(inicial.registros);
  const { usuario } = useAuth();

  // Carga los datos del backend autenticado. Se re-ejecuta al cambiar el
  // usuario (login / sesion restaurada). El alumno solo puede ver sus propias
  // asistencias; el resto de roles ve el listado completo. Sin sesion usa mock.
  useEffect(() => {
    if (!usuario) {
      const init = cargarInicial();
      setAlumnos(init.alumnos);
      setCursos(init.cursos);
      setRegistros(init.registros);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (usuario.rol === "alumno") {
          const as = await apiGet<{ ok: true; registros: RegistroAsistencia[] }>(
            `/asistencias.php?alumnoId=${encodeURIComponent(usuario.id)}`
          );
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
          setRegistros(normalizarRegistros(as.registros));
        } else {
          const [al, cu, as] = await Promise.all([
            apiGet<{ ok: true; alumnos: Alumno[] }>("/alumnos.php"),
            apiGet<{ ok: true; cursos: Curso[] }>("/cursos.php"),
            apiGet<{ ok: true; registros: RegistroAsistencia[] }>("/asistencias.php"),
          ]);
          if (cancelled) return;
          setAlumnos(al.alumnos.map(normalizarAlumno));
          setCursos(cu.cursos.map((c) => ({ ...c, id: String(c.id) })));
          setRegistros(normalizarRegistros(as.registros));
        }
      } catch {
        if (cancelled) return;
        const init = cargarInicial();
        setAlumnos(init.alumnos);
        setCursos(init.cursos);
        setRegistros(init.registros);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usuario]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ alumnos, cursos, registros }));
    } catch {
      /* noop */
    }
  }, [alumnos, cursos, registros]);

  const getRegistrosDeAlumno = useCallback(
    (alumnoId: string) => registros.filter((r) => r.alumnoId === alumnoId),
    [registros]
  );

  const estadisticasAlumno = useCallback(
    (alumnoId: string) => {
      if (!alumnos.some((a) => a.id === alumnoId)) return null;
      return calcularEstadisticasAlumno(alumnos, registros, alumnoId);
    },
    [alumnos, registros]
  );

  const resumen = useMemo(
    () => resumenInstitucional(alumnos, registros, cursos),
    [alumnos, registros, cursos]
  );

  const marcarAsistencia = useCallback(
    async (alumnoId: string, fecha: string, materia: string, estado: EstadoAsistencia) => {
      const data = await apiSend<{ ok: true; registro: RegistroAsistencia }>(
        "/asistencias.php",
        "POST",
        { alumnoId, fecha, materia, estado }
      );
      const registro = normalizarRegistros([data.registro])[0];
      setRegistros((prev) => {
        const idx = prev.findIndex(
          (r) => r.alumnoId === alumnoId && r.fecha === fecha && r.materia === materia
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
    },
    []
  );

  const tieneRegistro = useCallback(
    (alumnoId: string, materia: string, fecha: string) =>
      registros.some(
        (r) => r.alumnoId === alumnoId && r.materia === materia && r.fecha === fecha
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
    getRegistrosDeAlumno,
    estadisticasAlumno,
    resumen,
    tieneRegistro,
    marcarAsistencia,
    agregarAlumno,
    editarAlumno,
    borrarAlumno,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
