export type Rol = "alumno" | "preceptor" | "directivo" | "admin";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  curso?: string; // sólo alumnos
  avatar?: string;
}

export type EstadoAsistencia = "presente" | "tarde" | "ausente";

export interface RegistroAsistencia {
  id: string;
  alumnoId: string;
  materia: string;
  fecha: string; // YYYY-MM-DD
  estado: EstadoAsistencia;
  anio?: number;
}

export interface Alumno {
  id: string;
  nombre: string;
  curso: string;
  email: string;
  nombreSolo?: string;
  apellido?: string;
  dni?: string;
  anio?: string;
  division?: string;
  cursoId?: string;
  estado?: number;
}

export interface Curso {
  id: string;
  anio: string; // "1.º"
  division: string; // "A"
  turno: "Mañana" | "Tarde";
  preceptor: string | null;
  preceptorId?: string | null;
}

export const MATERIAS = [
  "Matemática",
  "Lengua",
  "Historia",
  "Biología",
  "Inglés",
  "Física",
  "Ed. Técnica",
];

export const PESO_ASISTENCIA: Record<EstadoAsistencia, number> = {
  presente: 1,
  tarde: 0.5,
  ausente: 0,
};

export const UMBRAL_REGULARIDAD = 75;

export const ROL_LABEL: Record<Rol, string> = {
  alumno: "Alumno",
  preceptor: "Preceptor",
  directivo: "Directivo",
  admin: "Administrador",
};
