// Modelo puro de la grilla con el formato oficial del colegio (aSc Horarios):
// la API devuelve una fila por módulo; acá se agrupan en bloques (una "caja"
// que ocupa 1+ módulos seguidos) y se distribuyen en la tabla, donde cada día
// tiene dos subcolumnas: grupo 1 (izquierda) y grupo 2 (derecha).
import { DIAS, type Clase, type CursoOpcion, type Franja, type Grupo } from "./grillaTipos";

// ---------- Cursos ----------

/** 1–3: "1º A" · 4–7: "4º 1ª". */
export function etiquetaCurso(curso: Pick<CursoOpcion, "anio" | "division">): string {
  return `${curso.anio}º ${etiquetaDivision(curso)}`;
}

/** "A" para 1º a 3º; "1ª" para 4º a 7º (divisiones numéricas). */
export function etiquetaDivision(curso: Pick<CursoOpcion, "anio" | "division">): string {
  const division = String(curso.division).trim();
  return Number(curso.anio) >= 4 && /^\d+$/.test(division) ? `${division}ª` : division;
}

/** El campo `curso` de una clase viene como "4 3" o "1 A". */
export function etiquetaCursoTexto(texto: string): string {
  const m = /^\s*(\d+)\s*[°º]?\s+(.+?)\s*$/.exec(texto);
  return m ? etiquetaCurso({ anio: m[1], division: m[2] }) : texto;
}

export function ordenarCursos<T extends Pick<CursoOpcion, "anio" | "division">>(cursos: T[]): T[] {
  return [...cursos].sort(
    (a, b) => Number(a.anio) - Number(b.anio) || String(a.division).localeCompare(String(b.division), "es", { numeric: true })
  );
}

// ---------- Bloques ----------

export interface Bloque {
  /** Ids de las filas-módulo que forman el bloque (para PUT/DELETE). */
  ids: string[];
  dia: number;
  grupo: Grupo;
  ordenInicio: number;
  ordenFin: number;
  horaInicio: string;
  horaFin: string;
  cursoId: string;
  curso: string;
  materiaId: string;
  materia: string;
  docenteId: string | null;
  docente: string | null;
  aulaId: string | null;
  aula: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

/**
 * Orden del último módulo antes de la banda "CAMBIO DE TURNO": el último de
 * la mañana cuando le siguen módulos de otro turno (hoy, el 4).
 */
export function ordenCambioTurno(franjas: Franja[]): number | null {
  for (let i = 0; i < franjas.length - 1; i++) {
    if (franjas[i].turno === "Mañana" && franjas[i + 1].turno !== "Mañana") return franjas[i].orden;
  }
  return null;
}

function mismaClase(a: Bloque, c: Clase): boolean {
  return (
    a.dia === c.dia &&
    a.grupo === c.grupo &&
    a.cursoId === c.cursoId &&
    a.materiaId === c.materiaId &&
    a.docenteId === c.docenteId &&
    a.aulaId === c.aulaId &&
    a.vigenteDesde === c.vigenteDesde &&
    a.vigenteHasta === c.vigenteHasta
  );
}

/**
 * Une módulos consecutivos del mismo día y grupo con la misma materia,
 * docente, aula y vigencia en un solo bloque. Nunca cruza la banda de cambio
 * de turno (`corte` = orden del último módulo antes de la banda).
 */
export function armarBloques(clases: Clase[], corte: number | null): Bloque[] {
  const ordenadas = [...clases].sort(
    (a, b) =>
      a.dia - b.dia ||
      a.grupo - b.grupo ||
      a.cursoId.localeCompare(b.cursoId, "es", { numeric: true }) ||
      a.materiaId.localeCompare(b.materiaId, "es", { numeric: true }) ||
      a.orden - b.orden
  );
  const bloques: Bloque[] = [];
  const abiertos = new Map<string, Bloque>();
  for (const c of ordenadas) {
    const clave = [c.dia, c.grupo, c.cursoId, c.materiaId, c.docenteId, c.aulaId, c.vigenteDesde, c.vigenteHasta].join("|");
    const previo = abiertos.get(clave);
    if (previo && mismaClase(previo, c) && c.orden === previo.ordenFin + 1 && previo.ordenFin !== corte) {
      previo.ids.push(c.id);
      previo.ordenFin = c.orden;
      previo.horaFin = c.horaFin;
      continue;
    }
    const nuevo: Bloque = {
      ids: [c.id],
      dia: c.dia,
      grupo: c.grupo,
      ordenInicio: c.orden,
      ordenFin: c.orden,
      horaInicio: c.horaInicio,
      horaFin: c.horaFin,
      cursoId: c.cursoId,
      curso: c.curso,
      materiaId: c.materiaId,
      materia: c.materia,
      docenteId: c.docenteId,
      docente: c.docente,
      aulaId: c.aulaId,
      aula: c.aula,
      vigenteDesde: c.vigenteDesde,
      vigenteHasta: c.vigenteHasta,
    };
    abiertos.set(clave, nuevo);
    bloques.push(nuevo);
  }
  return bloques.sort((a, b) => a.dia - b.dia || a.ordenInicio - b.ordenInicio || a.grupo - b.grupo);
}

// ---------- Distribución en la tabla ----------

/** 0 = subcolumna izquierda (grupo 1) · 1 = derecha (grupo 2). */
export type Mitad = 0 | 1;

export interface CeldaBloque {
  tipo: "bloque";
  dia: number;
  mitad: Mitad;
  colSpan: 1 | 2;
  /** Índice de la fila (franja) donde empieza. */
  fila: number;
  rowSpan: number;
  /** Normalmente uno; más de uno solo si se superponen (se apilan). */
  bloques: Bloque[];
}

export interface CeldaVacia {
  tipo: "vacia";
  dia: number;
  mitad: Mitad;
  colSpan: 1 | 2;
  fila: number;
  rowSpan: 1;
  /** Grupo que se propone al agregar una clase en esta celda. */
  grupo: Grupo;
}

export type Celda = CeldaBloque | CeldaVacia;

export interface FilaGrilla {
  franja: Franja;
  /** Celdas que arrancan en esta fila, en orden de día y mitad. */
  celdas: Celda[];
  /** Después de esta fila va la banda "CAMBIO DE TURNO". */
  bandaDespues: boolean;
}

export interface LayoutGrilla {
  filas: FilaGrilla[];
  /** Módulos libres seguidos desde (día, orden) para un grupo, sin cruzar la banda (máx. `tope`). */
  modulosLibres: (dia: number, orden: number, grupo: Grupo, tope?: number) => number;
}

export const MAX_MODULOS_BLOQUE = 4;

function mitadesDe(grupo: Grupo): Mitad[] {
  return grupo === 0 ? [0, 1] : grupo === 1 ? [0] : [1];
}

/**
 * Ubica los bloques en la grilla (rowSpan por módulos, colSpan 2 para el curso
 * completo) y completa los huecos con celdas vacías: un módulo libre en las
 * dos mitades es una celda de día completo; si una mitad está ocupada, la otra
 * queda como media celda libre. `ignorarGrupos` muestra todo a día completo
 * (vista del docente).
 */
export function armarLayout(franjas: Franja[], bloques: Bloque[], opciones: { ignorarGrupos?: boolean } = {}): LayoutGrilla {
  const corte = ordenCambioTurno(franjas);
  const indice = new Map(franjas.map((f, i) => [f.orden, i]));
  const ocupadas = new Map<string, CeldaBloque>();
  const clave = (dia: number, fila: number, mitad: Mitad) => `${dia}:${fila}:${mitad}`;

  for (const bloque of bloques) {
    const desde = indice.get(bloque.ordenInicio);
    const hasta = indice.get(bloque.ordenFin);
    if (desde === undefined || hasta === undefined || bloque.dia < 1 || bloque.dia > DIAS.length) continue;
    const grupo: Grupo = opciones.ignorarGrupos ? 0 : bloque.grupo;
    const mitades = mitadesDe(grupo);
    let choque: CeldaBloque | undefined;
    for (let f = desde; f <= hasta && !choque; f++) {
      for (const m of mitades) {
        choque = ocupadas.get(clave(bloque.dia, f, m));
        if (choque) break;
      }
    }
    if (choque) {
      choque.bloques.push(bloque);
      continue;
    }
    const celda: CeldaBloque = {
      tipo: "bloque",
      dia: bloque.dia,
      mitad: mitades[0],
      colSpan: mitades.length === 2 ? 2 : 1,
      fila: desde,
      rowSpan: hasta - desde + 1,
      bloques: [bloque],
    };
    for (let f = desde; f <= hasta; f++) for (const m of mitades) ocupadas.set(clave(bloque.dia, f, m), celda);
  }

  const filas: FilaGrilla[] = franjas.map((franja, fila) => {
    const celdas: Celda[] = [];
    for (const { n: dia } of DIAS) {
      for (const mitad of [0, 1] as Mitad[]) {
        const celda = ocupadas.get(clave(dia, fila, mitad));
        if (celda) {
          if (celda.fila === fila && celda.mitad === mitad) celdas.push(celda);
          continue;
        }
        if (mitad === 0 && !ocupadas.has(clave(dia, fila, 1))) {
          celdas.push({ tipo: "vacia", dia, mitad: 0, colSpan: 2, fila, rowSpan: 1, grupo: 0 });
          break;
        }
        celdas.push({ tipo: "vacia", dia, mitad, colSpan: 1, fila, rowSpan: 1, grupo: mitad === 0 ? 1 : 2 });
      }
    }
    return { franja, celdas, bandaDespues: corte !== null && franja.orden === corte };
  });

  function modulosLibres(dia: number, orden: number, grupo: Grupo, tope = MAX_MODULOS_BLOQUE): number {
    const inicio = indice.get(orden);
    if (inicio === undefined) return 0;
    let libres = 0;
    for (let f = inicio; f < franjas.length && libres < tope; f++) {
      if (mitadesDe(grupo).some((m) => ocupadas.has(clave(dia, f, m)))) break;
      libres++;
      if (franjas[f].orden === corte) break;
    }
    return libres;
  }

  return { filas, modulosLibres };
}

/** "07:40 a 08:40", como en el horario oficial. */
export function rangoHora(inicio: string, fin: string): string {
  return `${inicio} a ${fin}`;
}

/** Texto del pie de la caja: docente (vista por curso) o curso (vista del docente). */
export function pieDeBloque(bloque: Bloque, mostrarCurso: boolean): string {
  if (mostrarCurso) {
    const curso = etiquetaCursoTexto(bloque.curso);
    return bloque.grupo === 0 ? curso : `${curso} · G${bloque.grupo}`;
  }
  return bloque.docente ?? "";
}

/** Lo que se tocó en la grilla: un hueco libre o una clase existente. */
export type Seleccion =
  | { tipo: "nueva"; dia: number; franja: Franja; grupo: Grupo }
  | { tipo: "editar"; bloque: Bloque };
