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
import { apiGet, apiSend, esErrorDeRed } from "./apiClient";
import { useAuth } from "../auth/AuthContext";

const STORAGE_KEY = "galisencia.data";

interface Persistido {
  alumnos: Alumno[];
  cursos: Curso[];
  registros: RegistroAsistencia[];
}

function normalizarRegistros(registros: RegistroAsistencia[]): RegistroAsistencia[] {
  return registros.map((r) => {
    const anio = r.anio != null ? Number(r.anio) : Number(String(r.fecha).slice(0, 4));
    return {
      ...r,
      id: String(r.id),
      alumnoId: String(r.alumnoId),
      anio: Number.isFinite(anio) ? anio : undefined,
    };
  });
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
  editarAlumno: (
    id: string,
    datos: Partial<Alumno>,
    contrasena?: string
  ) => Promise<void>;
  borrarAlumno: (id: string, contrasena?: string) => Promise<void>;
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
            curso: usuario.curso ?? "",
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
          setAlumnos(al.alumnos.map((a) => ({ ...a, id: String(a.id) })));
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
  }, [usuario?.id]);

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
      // Best-effort: persiste en el backend si está disponible.
      apiSend("/asistencias.php", "POST", { alumnoId, fecha, materia, estado }).catch(() => {});
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
      const nuevo: Alumno = {
        id: datos.id ?? `nuevo-${Date.now()}`,
        nombre: datos.nombre,
        curso: datos.curso,
        email:
          datos.email ||
          `${datos.nombre.toLowerCase().replace(/[^a-z]/g, ".")}@galileo.edu.ar`,
      };
      setAlumnos((prev) => [...prev, nuevo]);
      apiSend("/alumnos.php", "POST", {
        nombre: datos.nombreSolo || datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        curso: datos.curso,
        email: datos.email,
      }).catch(() => {});
    },
    []
  );

  const editarAlumno = useCallback(
    async (id: string, datos: Partial<Alumno>, contrasena?: string) => {
      const previos = alumnos;
      setAlumnos((prev) => prev.map((a) => (a.id === id ? { ...a, ...datos } : a)));
      try {
        await apiSend("/alumnos.php", "PUT", {
          id,
          nombre: datos.nombreSolo || datos.nombre,
          apellido: datos.apellido,
          dni: datos.dni,
          curso: datos.curso,
          email: datos.email,
          contrasena,
        });
      } catch (err) {
        if (esErrorDeRed(err)) return; // demo sin backend: queda el cambio local
        setAlumnos(previos);
        throw err;
      }
    },
    [alumnos]
  );

  const borrarAlumno = useCallback(
    async (id: string, contrasena?: string) => {
      const previos = alumnos;
      setAlumnos((prev) => prev.filter((a) => a.id !== id));
      try {
        await apiSend(`/alumnos.php?id=${encodeURIComponent(id)}`, "DELETE",
          contrasena ? { contrasena } : undefined
        );
      } catch (err) {
        if (esErrorDeRed(err)) return; // demo sin backend: queda el cambio local
        setAlumnos(previos);
        throw err;
      }
    },
    [alumnos]
  );

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