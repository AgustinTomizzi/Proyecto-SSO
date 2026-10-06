export type Rol = "alumno" | "preceptor" | "directivo" | "admin";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  rolBackend: string;
  permisos: string[];
  sistemas: string[];
  curso?: string; // sólo alumnos
  debeCambiarPassword: boolean;
}

export type EstadoAsistencia = "presente" | "tarde" | "ausente";

export interface RegistroAsistencia {
  id: string;
  alumnoId: string;
  materiaId?: string;
  materia: string; // nombre canónico del catálogo
  fecha: string; // YYYY-MM-DD
  estado: EstadoAsistencia;
}

export interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  curso: string;
  cursoId: string;
  division: string;
  email: string;
}

export interface Curso {
  id: string;
  anio: string; // "1.º"
  division: string; // "A"
  turno: "Mañana" | "Tarde";
  preceptor: string;
}

export const MATERIAS = [
  "Matemática",
  "Lengua",
  "Historia",
  "Biología",
  "Inglés",
  "Física",
  "Ed. Técnica",
  "Geografía",
  "Química",
  "Ciudadanía",
];

export interface Materia {
  id: string;
  nombre: string;
}

/** Compara un registro con una materia: por id si el registro lo trae, si no por nombre. */
export function esMismaMateria(registro: RegistroAsistencia, materia: Materia): boolean {
  return registro.materiaId ? registro.materiaId === materia.id : registro.materia === materia.nombre;
}

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
