import type {
  Alumno,
  Curso,
  EstadoAsistencia,
  RegistroAsistencia,
} from "./types";
import { MATERIAS, PESO_ASISTENCIA, UMBRAL_REGULARIDAD } from "./types";

/* ---------- Generador determinista (para que la demo sea estable) ---------- */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const NOMBRES = [
  "Sofía Gutiérrez", "Mateo Fernández", "Valentina López", "Benjamín Rodríguez",
  "Camila González", "Thiago Díaz", "Isabella Martínez", "Lucas Sánchez",
  "Emma Pérez", "Agustín Romero", "Martina Torres", "Bautista Acosta",
  "Lucía Herrera", "Joaquín Méndez", "Juana Castro", "Franco Ruiz",
  "Renata Vega", "Tomás Aguirre", "Olivia Núñez", "Ignacio Blanco",
  "Facundo Paz", "Delfina Ríos", "Simón Cáceres", "Julieta Molina",
  "Pedro Suárez", "Mía Ledesma", "Bruno Cordero", "Antonia Ferreyra",
  "Dylan Arce", "Candelaria Campos",
];

export const CURSOS: Curso[] = [
  { id: "1A", anio: "1.º", division: "A", turno: "Mañana", preceptor: "Prof. Ramírez" },
  { id: "1B", anio: "1.º", division: "B", turno: "Mañana", preceptor: "Prof. Lagos" },
  { id: "2A", anio: "2.º", division: "A", turno: "Tarde", preceptor: "Prof. Medina" },
  { id: "2B", anio: "2.º", division: "B", turno: "Tarde", preceptor: "Prof. Sosa" },
  { id: "3A", anio: "3.º", division: "A", turno: "Mañana", preceptor: "Prof. Spinelli" },
];

export function cursoLabel(c: Curso): string {
  return `${c.anio} ${c.division}`;
}

const FECHAS = ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-16", "2026-06-17", "2026-06-18"];

export function buildAlumnos(): Alumno[] {
  const alumnos: Alumno[] = [];
  let i = 0;
  for (const curso of CURSOS) {
    for (let k = 0; k < 6; k++) {
      const nombre = NOMBRES[i % NOMBRES.length];
      const partes = nombre.split(" ");
      const apellido = partes.pop() ?? "";
      const id = `${curso.id}-${k + 1}`;
      alumnos.push({
        id,
        nombre: partes.join(" "),
        apellido,
        dni: String(40_000_000 + i),
        curso: cursoLabel(curso),
        cursoId: curso.id,
        division: curso.division,
        email: `${nombre.toLowerCase().replace(/[^a-z]/g, ".")}@galileo.edu.ar`,
      });
      i++;
    }
  }
  return alumnos;
}

export function buildRegistros(alumnos: Alumno[]): RegistroAsistencia[] {
  const registros: RegistroAsistencia[] = [];
  // Cada alumno tiene entre 2 y 4 materias cursando (para que el % sea realista)
  for (const a of alumnos) {
    const nMat = 3 + Math.floor(hash(a.id) * 3); // 3..5
    const materias = [...MATERIAS].sort(() => hash(a.id + Math.random()) - 0.5).slice(0, nMat);
    for (const materia of materias) {
      for (const fecha of FECHAS) {
        const h = hash(a.id + materia + fecha);
        const estado: EstadoAsistencia =
          h < 0.1 ? "ausente" : h < 0.22 ? "tarde" : "presente";
        registros.push({ id: `${a.id}-${materia}-${fecha}`, alumnoId: a.id, materia, fecha, estado });
      }
    }
  }
  return registros;
}

export interface EstadisticaMateria {
  materia: string;
  total: number;
  presentes: number;
  tardes: number;
  ausencias: number;
  pct: number | null;
}

export interface EstadisticaAlumno {
  alumnoId: string;
  nombre: string;
  curso: string;
  general: number | null;
  porMateria: EstadisticaMateria[];
}

function pctDe(regs: RegistroAsistencia[]): number | null {
  if (!regs.length) return null;
  const puntos = regs.reduce((s, r) => s + PESO_ASISTENCIA[r.estado], 0);
  return Math.round((puntos / regs.length) * 100);
}

export function calcularEstadisticasAlumno(
  alumnos: Alumno[],
  registros: RegistroAsistencia[],
  alumnoId: string
): EstadisticaAlumno {
  const alumno = alumnos.find((a) => a.id === alumnoId);
  const regs = registros.filter((r) => r.alumnoId === alumnoId);
  const materias = [...new Set(regs.map((r) => r.materia))];
  const porMateria: EstadisticaMateria[] = materias.map((materia) => {
    const r = regs.filter((x) => x.materia === materia);
    return {
      materia,
      total: r.length,
      presentes: r.filter((x) => x.estado === "presente").length,
      tardes: r.filter((x) => x.estado === "tarde").length,
      ausencias: r.filter((x) => x.estado === "ausente").length,
      pct: pctDe(r),
    };
  });
  return {
    alumnoId,
    nombre: alumno?.nombre ?? "Alumno",
    curso: alumno?.curso ?? "",
    general: pctDe(regs),
    porMateria,
  };
}

export interface IndicadorRiesgo {
  alumno: Alumno;
  general: number;
}
export interface ResumenInstitucional {
  promedio: number;
  totalAlumnos: number;
  enRiesgo: number;
  porCurso: { curso: string; promedio: number; enRiesgo: number }[];
  alumnosEnRiesgo: IndicadorRiesgo[];
}

export function resumenInstitucional(
  alumnos: Alumno[],
  registros: RegistroAsistencia[],
  cursos: Curso[]
): ResumenInstitucional {
  const porAlumno = alumnos.map((a) => {
    const g = calcularEstadisticasAlumno(alumnos, registros, a.id).general ?? 100;
    return { alumno: a, general: g };
  });
  const promedio = Math.round(
    porAlumno.reduce((s, x) => s + x.general, 0) / (porAlumno.length || 1)
  );
  const enRiesgo = porAlumno.filter((x) => x.general < UMBRAL_REGULARIDAD);
  const porCurso = cursos.map((c) => {
    const delCurso = porAlumno.filter((x) => x.alumno.curso === cursoLabel(c));
    const prom = delCurso.length
      ? Math.round(delCurso.reduce((s, x) => s + x.general, 0) / delCurso.length)
      : 0;
    return {
      curso: cursoLabel(c),
      promedio: prom,
      enRiesgo: delCurso.filter((x) => x.general < UMBRAL_REGULARIDAD).length,
    };
  });
  return {
    promedio,
    totalAlumnos: alumnos.length,
    enRiesgo: enRiesgo.length,
    porCurso,
    alumnosEnRiesgo: enRiesgo
      .sort((a, b) => a.general - b.general)
      .map((x) => ({ alumno: x.alumno, general: x.general })),
  };
}

export function getAlumnosPorCurso(alumnos: Alumno[], curso: string): Alumno[] {
  return alumnos.filter((a) => a.curso === curso);
}

export function colorPorPct(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  if (pct < UMBRAL_REGULARIDAD) return "var(--danger)";
  if (pct < 85) return "var(--warning)";
  return "var(--success)";
}
