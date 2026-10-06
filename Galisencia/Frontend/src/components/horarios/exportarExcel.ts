// Exportación a Excel con la misma estructura que el horario oficial
// (aSc Horarios). exceljs se carga bajo demanda para no engordar el bundle.
import type { Borders, Cell, Workbook, Worksheet } from "exceljs";
import { DIAS } from "./grillaTipos";
import { pieDeBloque, rangoHora, type Bloque, type LayoutGrilla } from "./grillaModelo";

export interface HojaHorario {
  /** Nombre de la pestaña ("1º A"). */
  nombreHoja: string;
  /** Título de la hoja ("1º A — Horario 2026"). */
  titulo: string;
  /** Pie izquierdo ("Horario vigente al 05/10/2026"). */
  pie: string;
  layout: LayoutGrilla;
  mostrarCurso?: boolean;
}

const NEGRO = { argb: "FF000000" };
const FUENTE = "Arial";
const BORDE_FINO: Partial<Borders> = {
  top: { style: "thin", color: NEGRO },
  left: { style: "thin", color: NEGRO },
  bottom: { style: "thin", color: NEGRO },
  right: { style: "thin", color: NEGRO },
};
const COLUMNAS = 1 + DIAS.length * 2;

/** Excel no admite : \ / ? * [ ] en el nombre de la hoja y lo corta a 31 caracteres. */
export function nombreHojaValido(nombre: string, usados: Set<string>): string {
  const base = nombre.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Horario";
  let candidato = base;
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) candidato = `${base.slice(0, 27)} (${i})`;
  usados.add(candidato.toLowerCase());
  return candidato;
}

export async function crearLibro(): Promise<Workbook> {
  const mod = await import("exceljs");
  // Según el empaquetado, la clase llega como export nombrado o dentro de default.
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Galisencia";
  libro.created = new Date();
  return libro;
}

function textoBloque(bloque: Bloque, mostrarCurso: boolean) {
  const pie = pieDeBloque(bloque, mostrarCurso);
  return [
    ...(bloque.aula ? [{ text: `${bloque.aula}\n`, font: { name: FUENTE, size: 8, bold: true } }] : []),
    { text: bloque.materia, font: { name: FUENTE, size: 10, bold: true } },
    ...(pie ? [{ text: `\n${pie}`, font: { name: FUENTE, size: 8, italic: true } }] : []),
  ];
}

function bordear(hoja: Worksheet, fila: number, col: number) {
  hoja.getCell(fila, col).border = BORDE_FINO;
}

/** Agrega una hoja con la grilla: título, días, columna de horas, módulos, banda de cambio de turno y pie. */
export function agregarHoja(libro: Workbook, datos: HojaHorario, usados: Set<string> = new Set()): Worksheet {
  const { layout, mostrarCurso = false } = datos;
  const hoja = libro.addWorksheet(nombreHojaValido(datos.nombreHoja, usados), {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });

  hoja.getColumn(1).width = 15;
  for (let c = 2; c <= COLUMNAS; c++) hoja.getColumn(c).width = 13;

  // Fila 1: título.
  hoja.mergeCells(1, 1, 1, COLUMNAS);
  const titulo = hoja.getCell(1, 1);
  titulo.value = datos.titulo;
  titulo.font = { name: FUENTE, size: 18 };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  hoja.getRow(1).height = 34;

  // Fila 2: días (cada día ocupa sus dos subcolumnas).
  bordear(hoja, 2, 1);
  DIAS.forEach((d, i) => {
    const col = 2 + i * 2;
    hoja.mergeCells(2, col, 2, col + 1);
    const celda = hoja.getCell(2, col);
    celda.value = d.nombre;
    celda.font = { name: FUENTE, size: 14 };
    celda.alignment = { horizontal: "center", vertical: "middle" };
    bordear(hoja, 2, col);
    bordear(hoja, 2, col + 1);
  });
  hoja.getRow(2).height = 28;

  // Filas de módulos (+1 después de la banda).
  const filaExcel: number[] = [];
  let actual = 3;
  for (const fila of layout.filas) {
    filaExcel.push(actual);
    actual += fila.bandaDespues ? 2 : 1;
  }

  layout.filas.forEach((fila, i) => {
    const r = filaExcel[i];
    hoja.getRow(r).height = 36;
    const hora = hoja.getCell(r, 1);
    hora.value = rangoHora(fila.franja.horaInicio, fila.franja.horaFin);
    hora.font = { name: FUENTE, size: 10 };
    hora.alignment = { horizontal: "center", vertical: "middle" };
    bordear(hoja, r, 1);

    for (const celda of fila.celdas) {
      const c0 = 2 + (celda.dia - 1) * 2 + celda.mitad;
      const c1 = c0 + celda.colSpan - 1;
      const r1 = filaExcel[i + celda.rowSpan - 1] ?? r;
      for (let rr = r; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) bordear(hoja, rr, cc);
      if (r1 > r || c1 > c0) hoja.mergeCells(r, c0, r1, c1);
      if (celda.tipo !== "bloque") continue;
      const destino: Cell = hoja.getCell(r, c0);
      const partes = celda.bloques.flatMap((b, j) => [
        ...(j > 0 ? [{ text: "\n—\n", font: { name: FUENTE, size: 8 } }] : []),
        ...textoBloque(b, mostrarCurso),
      ]);
      destino.value = { richText: partes };
      destino.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    if (fila.bandaDespues) {
      const rb = r + 1;
      hoja.getRow(rb).height = 30;
      const rotulo = hoja.getCell(rb, 1);
      rotulo.value = "CAMBIO DE TURNO";
      rotulo.font = { name: FUENTE, size: 7 };
      rotulo.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      bordear(hoja, rb, 1);
      for (let cc = 2; cc <= COLUMNAS; cc++) bordear(hoja, rb, cc);
      hoja.mergeCells(rb, 2, rb, COLUMNAS);
      const banda = hoja.getCell(rb, 2);
      banda.value = "CAMBIO DE TURNO";
      banda.font = { name: FUENTE, size: 20 };
      banda.alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  // Pie: fecha a la izquierda, "Galisencia" a la derecha.
  const rPie = actual;
  const mitad = Math.ceil(COLUMNAS / 2);
  hoja.mergeCells(rPie, 1, rPie, mitad);
  hoja.mergeCells(rPie, mitad + 1, rPie, COLUMNAS);
  const pieIzq = hoja.getCell(rPie, 1);
  pieIzq.value = datos.pie;
  pieIzq.font = { name: FUENTE, size: 9 };
  pieIzq.alignment = { horizontal: "left", vertical: "top" };
  const pieDer = hoja.getCell(rPie, mitad + 1);
  pieDer.value = "Galisencia";
  pieDer.font = { name: FUENTE, size: 9 };
  pieDer.alignment = { horizontal: "right", vertical: "top" };

  hoja.pageSetup.printArea = `A1:${hoja.getColumn(COLUMNAS).letter}${rPie}`;
  return hoja;
}

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function descargarLibro(libro: Workbook, nombreArchivo: string): Promise<void> {
  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: TIPO_XLSX }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.replace(/[\\/:*?"<>|]/g, "-");
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
