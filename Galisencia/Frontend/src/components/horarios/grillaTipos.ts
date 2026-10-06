/** 0 = curso completo · 1 = grupo 1 (mitad izquierda) · 2 = grupo 2 (mitad derecha). */
export type Grupo = 0 | 1 | 2;

export interface Franja {
  id: string;
  orden: number;
  turno: string;
  horaInicio: string;
  horaFin: string;
}

/** Una fila por módulo, tal como la devuelve /horario_grilla.php. */
export interface Clase {
  id: string;
  cursoId: string;
  curso: string;
  dia: number;
  franjaId: string;
  orden: number;
  turno: string;
  horaInicio: string;
  horaFin: string;
  grupo: Grupo;
  materiaId: string;
  materia: string;
  docenteId: string | null;
  docente: string | null;
  aulaId: string | null;
  aula: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export interface CursoOpcion {
  id: string;
  anio: string;
  division: string;
  turno: string;
}

export interface Grilla {
  fecha: string;
  curso: CursoOpcion | null;
  franjas: Franja[];
  clases: Clase[];
}

export interface Opcion {
  id: string;
  nombre: string;
}

export interface AulaOpcion extends Opcion {
  compartida: boolean;
}

export const DIAS = [
  { n: 1, nombre: "Lunes", corto: "Lun" },
  { n: 2, nombre: "Martes", corto: "Mar" },
  { n: 3, nombre: "Miércoles", corto: "Mié" },
  { n: 4, nombre: "Jueves", corto: "Jue" },
  { n: 5, nombre: "Viernes", corto: "Vie" },
] as const;

export const GRUPOS: { valor: Grupo; nombre: string }[] = [
  { valor: 0, nombre: "Curso completo" },
  { valor: 1, nombre: "Grupo 1" },
  { valor: 2, nombre: "Grupo 2" },
];

export function nombreDia(dia: number): string {
  return DIAS.find((d) => d.n === dia)?.nombre ?? "";
}

/** Día de la semana (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD, sin pasar por UTC. */
export function diaDeFecha(fecha: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return d === 0 ? 7 : d;
}

/** YYYY-MM-DD → DD/MM/YYYY. */
export function fechaLegible(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

/** Normaliza la respuesta de la API (algunos ids llegan como número). */
export function normalizarGrilla(data: {
  fecha?: string;
  curso?: { id: string | number; anio: string | number; division: string | number; turno: string } | null;
  franjas?: Record<string, unknown>[];
  clases?: Record<string, unknown>[];
}): Grilla {
  const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const opcional = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
  const grupo = (v: unknown): Grupo => (Number(v) === 1 ? 1 : Number(v) === 2 ? 2 : 0);
  return {
    fecha: data.fecha ?? "",
    curso: data.curso
      ? { id: texto(data.curso.id), anio: texto(data.curso.anio), division: texto(data.curso.division), turno: texto(data.curso.turno) }
      : null,
    franjas: (data.franjas ?? [])
      .map((f) => ({
        id: texto(f.id),
        orden: Number(f.orden),
        turno: texto(f.turno),
        horaInicio: texto(f.horaInicio),
        horaFin: texto(f.horaFin),
      }))
      .sort((a, b) => a.orden - b.orden),
    clases: (data.clases ?? []).map((c) => ({
      id: texto(c.id),
      cursoId: texto(c.cursoId),
      curso: texto(c.curso),
      dia: Number(c.dia),
      franjaId: texto(c.franjaId),
      orden: Number(c.orden),
      turno: texto(c.turno),
      horaInicio: texto(c.horaInicio),
      horaFin: texto(c.horaFin),
      grupo: grupo(c.grupo),
      materiaId: texto(c.materiaId),
      materia: texto(c.materia),
      docenteId: opcional(c.docenteId),
      docente: opcional(c.docente),
      aulaId: opcional(c.aulaId),
      aula: opcional(c.aula),
      vigenteDesde: texto(c.vigenteDesde),
      vigenteHasta: opcional(c.vigenteHasta),
    })),
  };
}
