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

const STORAGE_KEY = "galisencia.data";

interface Persistido {
  alumnos: Alumno[];
  cursos: Curso[];
  registros: RegistroAsistencia[];
}

function cargarInicial(): Persistido {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Persistido>;
      if (d.alumnos?.length && d.registros?.length && d.cursos?.length) {
        return { alumnos: d.alumnos, cursos: d.cursos, registros: d.registros };
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
  ) => void;
  agregarAlumno: (datos: Omit<Alumno, "id"> & { id?: string }) => void;
  editarAlumno: (id: string, datos: Partial<Alumno>) => void;
  borrarAlumno: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const inicial = useMemo(cargarInicial, []);
  const [alumnos, setAlumnos] = useState<Alumno[]>(inicial.alumnos);
  const [cursos] = useState<Curso[]>(inicial.cursos);
  const [registros, setRegistros] = useState<RegistroAsistencia[]>(inicial.registros);

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
    (alumnoId: string, fecha: string, materia: string, estado: EstadoAsistencia) => {
      setRegistros((prev) => {
        const idx = prev.findIndex(
          (r) => r.alumnoId === alumnoId && r.fecha === fecha && r.materia === materia
        );
        if (idx >= 0) {
          const copia = [...prev];
          copia[idx] = { ...copia[idx], estado };
          return copia;
        }
        return [
          ...prev,
          { id: `${alumnoId}-${materia}-${fecha}`, alumnoId, materia, fecha, estado },
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
    (datos: Omit<Alumno, "id"> & { id?: string }) => {
      setAlumnos((prev) => [
        ...prev,
        {
          id: datos.id ?? `nuevo-${Date.now()}`,
          nombre: datos.nombre,
          curso: datos.curso,
          email:
            datos.email ||
            `${datos.nombre.toLowerCase().replace(/[^a-z]/g, ".")}@galileo.edu.ar`,
        },
      ]);
    },
    []
  );

  const editarAlumno = useCallback((id: string, datos: Partial<Alumno>) => {
    setAlumnos((prev) => prev.map((a) => (a.id === id ? { ...a, ...datos } : a)));
  }, []);

  const borrarAlumno = useCallback((id: string) => {
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
