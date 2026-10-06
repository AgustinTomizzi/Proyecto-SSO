export type EstadoAsistencia = "presente" | "tarde" | "ausente" | "justificado";

export interface RegistroAsistencia {
  id: string;
  alumnoId: string;
  materia: string;
  fecha: string; // ISO: "2026-07-01"
  estado: EstadoAsistencia;
  justificacionId?: string | null;
}

export interface EstadisticaMateria {
  materia: string;
  total: number;
  presentes: number;
  tardes: number;
  ausencias: number;
  justificadas: number;
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

// Los pesos de cada estado y el umbral de regularidad son configurables: ver
// ReglasAsistencia en data/types.ts (con sesión se leen de la API).
export { REGLAS_DEMO, pesoAsistencia, type ReglasAsistencia } from "../../data/types";
