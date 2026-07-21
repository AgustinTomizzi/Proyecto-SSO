export type EstadoAsistencia = "presente" | "tarde" | "ausente";

export interface RegistroAsistencia {
  id: string;
  alumnoId: string;
  materia: string;
  fecha: string; // ISO: "2026-07-01"
  estado: EstadoAsistencia;
}

export interface EstadisticaMateria {
  materia: string;
  total: number;
  presentes: number;
  tardes: number;
  ausencias: number;
  pct: number | null; // null si no hay clases registradas aún
}

export interface EstadisticaAlumno {
  alumnoId: string;
  nombre: string;
  curso: string;
  general: number | null;
  porMateria: EstadisticaMateria[];
  ultimaActualizacion: string; // ISO datetime
}

// Peso de cada estado para el cálculo de %. Tarde = media falta.
export const PESO_ASISTENCIA: Record<EstadoAsistencia, number> = {
  presente: 1,
  tarde: 0.5,
  ausente: 0,
};

export const UMBRAL_REGULARIDAD = 75;