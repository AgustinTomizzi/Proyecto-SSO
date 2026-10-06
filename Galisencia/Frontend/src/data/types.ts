export type Rol = "alumno" | "preceptor" | "directivo" | "admin" | "tutor";

/** Alumno vinculado a un tutor (portal de familias). */
export interface AlumnoVinculado {
  id: string;
  nombre: string;
  apellido: string;
  curso: string | null;
  cursoId: string | null;
  parentesco: string | null;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  rolBackend: string;
  permisos: string[];
  sistemas: string[];
  curso?: string; // sólo alumnos
  /** Sólo tutores: sus alumnos vinculados. */
  alumnos?: AlumnoVinculado[];
  debeCambiarPassword: boolean;
}

/** "justificado" no se carga a mano: lo pone una justificación (justificaciones.php). */
export type EstadoAsistencia = "presente" | "tarde" | "ausente" | "justificado";

/** Estados que se pueden cargar al tomar asistencia. */
export type EstadoCargable = Exclude<EstadoAsistencia, "justificado">;

export interface RegistroAsistencia {
  id: string;
  alumnoId: string;
  materiaId?: string;
  materia: string; // nombre canónico del catálogo
  fecha: string; // YYYY-MM-DD
  estado: EstadoAsistencia;
  /** Justificación que cubre esta ausencia (solo si estado es "justificado"). */
  justificacionId?: string | null;
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

/**
 * Reglas de cálculo de asistencia. Con sesión vienen de la API
 * (config_institucion.php / reportes.php); estas son las de la institución por
 * defecto y solo se usan en el modo demo sin sesión.
 */
export interface ReglasAsistencia {
  /** Valor de una llegada tarde respecto de un presente (0 a 1). */
  valorTarde: number;
  /** Valor de una inasistencia justificada respecto de un presente (0 a 1). */
  valorJustificado: number;
  /** Porcentaje mínimo para la regularidad. */
  umbral: number;
}

export const REGLAS_DEMO: ReglasAsistencia = { valorTarde: 0.5, valorJustificado: 0, umbral: 75 };

/** Peso de un registro según las reglas vigentes. */
export function pesoAsistencia(estado: EstadoAsistencia, reglas: ReglasAsistencia): number {
  if (estado === "presente") return 1;
  if (estado === "tarde") return reglas.valorTarde;
  if (estado === "justificado") return reglas.valorJustificado;
  return 0;
}

/** Porcentaje de asistencia de una lista de registros (null si está vacía). */
export function porcentajeAsistencia(
  registros: { estado: EstadoAsistencia }[],
  reglas: ReglasAsistencia
): number | null {
  if (!registros.length) return null;
  const puntos = registros.reduce((s, r) => s + pesoAsistencia(r.estado, reglas), 0);
  return Math.round((puntos / registros.length) * 100);
}

/** Etiqueta y clase de badge de cada estado (justificada se distingue de ausente). */
export const ESTADO_ASISTENCIA: Record<EstadoAsistencia, { label: string; badge: string; color: string }> = {
  presente: { label: "Presente", badge: "badge-success", color: "var(--success)" },
  tarde: { label: "Tarde", badge: "badge-warning", color: "var(--warning)" },
  ausente: { label: "Ausente", badge: "badge-danger", color: "var(--danger)" },
  justificado: { label: "Justificada", badge: "badge-info", color: "var(--info)" },
};

/** Convierte los valores de config_institucion.php (porcentajes enteros) en reglas. */
export function reglasDesdeConfig(valores: Record<string, unknown>): ReglasAsistencia {
  const num = (clave: string, defecto: number) => {
    const v = Number(valores[clave]);
    return Number.isFinite(v) ? v : defecto;
  };
  return {
    valorTarde: num("asistencia.valor_tarde_pct", REGLAS_DEMO.valorTarde * 100) / 100,
    valorJustificado: num("asistencia.valor_justificado_pct", REGLAS_DEMO.valorJustificado * 100) / 100,
    umbral: num("asistencia.umbral_regularidad_pct", REGLAS_DEMO.umbral),
  };
}

export const ROL_LABEL: Record<Rol, string> = {
  alumno: "Alumno",
  preceptor: "Preceptor",
  directivo: "Directivo",
  admin: "Administrador",
  tutor: "Familia",
};
