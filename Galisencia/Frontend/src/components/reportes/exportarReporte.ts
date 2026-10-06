// Exportación del reporte de asistencia a Excel (exceljs bajo demanda, con los
// mismos helpers que la exportación de horarios).
import type { Worksheet } from "exceljs";
import { crearLibro, descargarLibro } from "../horarios/exportarExcel";

export interface ResumenAlumnoReporte {
  nombre: string;
  curso: string;
  total: number;
  presentes: number;
  tardes: number;
  ausentes: number;
  justificadas: number;
  pct: number | null;
  enRiesgo: boolean;
}

export interface FilaReporte {
  fecha: string;
  alumno: string;
  curso: string;
  materia: string;
  estado: string;
  pct: number | null;
}

const FUENTE = "Arial";
const ENCABEZADO = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE0F2FE" } };

function tabla(hoja: Worksheet, titulo: string, subtitulo: string, columnas: { titulo: string; ancho: number }[], filas: (string | number)[][]) {
  hoja.columns = columnas.map((c) => ({ width: c.ancho }));
  hoja.addRow([titulo]).font = { name: FUENTE, size: 13, bold: true };
  hoja.addRow([subtitulo]).font = { name: FUENTE, size: 10, italic: true };
  hoja.addRow([]);
  const cabecera = hoja.addRow(columnas.map((c) => c.titulo));
  cabecera.eachCell((celda) => { celda.font = { name: FUENTE, bold: true }; celda.fill = ENCABEZADO; });
  filas.forEach((fila) => { hoja.addRow(fila).font = { name: FUENTE }; });
  if (!filas.length) hoja.addRow(["Sin datos para el filtro."]).font = { name: FUENTE, italic: true };
  hoja.views = [{ state: "frozen", ySplit: 4 }];
}

const fecha = (iso: string) => iso.split("-").reverse().join("/");

/** Libro con el resumen por alumno y todos los registros del filtro. */
export async function exportarReporteAsistencia(descripcion: string, resumen: ResumenAlumnoReporte[], filas: FilaReporte[], nombreArchivo: string) {
  const libro = await crearLibro();
  tabla(libro.addWorksheet("Resumen por alumno"), "Reporte de asistencia", descripcion,
    [{ titulo: "Alumno", ancho: 30 }, { titulo: "Curso", ancho: 10 }, { titulo: "Clases", ancho: 9 }, { titulo: "Presentes", ancho: 11 }, { titulo: "Tardes", ancho: 9 }, { titulo: "Ausentes", ancho: 10 }, { titulo: "Justificadas", ancho: 13 }, { titulo: "Asistencia %", ancho: 13 }, { titulo: "Situación", ancho: 12 }],
    resumen.map((r) => [r.nombre, r.curso, r.total, r.presentes, r.tardes, r.ausentes, r.justificadas, r.pct ?? "—", r.pct === null ? "Sin datos" : r.enRiesgo ? "En riesgo" : "Regular"]));
  tabla(libro.addWorksheet("Registros"), "Registros de asistencia", descripcion,
    [{ titulo: "Fecha", ancho: 12 }, { titulo: "Alumno", ancho: 30 }, { titulo: "Curso", ancho: 10 }, { titulo: "Materia", ancho: 32 }, { titulo: "Estado", ancho: 12 }, { titulo: "Asistencia %", ancho: 13 }],
    filas.map((f) => [fecha(f.fecha), f.alumno, f.curso, f.materia, f.estado, f.pct ?? "—"]));
  await descargarLibro(libro, nombreArchivo);
}
