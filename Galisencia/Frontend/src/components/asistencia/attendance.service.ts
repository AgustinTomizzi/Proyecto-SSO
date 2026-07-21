import type {
  RegistroAsistencia,
  EstadisticaAlumno,
  EstadisticaMateria,
} from "./attendance.types";
import { PESO_ASISTENCIA } from "./attendance.types";

// ---- MOCK DATA (reemplazar por fetch a tu API cuando esté lista) ----
const MOCK_MATERIAS = ["Matemática", "Lengua", "Historia", "Biología", "Inglés"];

function generarMock(alumnoId: string): RegistroAsistencia[] {
  const fechas = ["2026-06-09", "2026-06-10", "2026-06-11", "2026-06-16", "2026-06-17"];
  const registros: RegistroAsistencia[] = [];
  MOCK_MATERIAS.forEach((materia, mi) => {
    fechas.forEach((fecha, fi) => {
      const h = (mi * 7 + fi * 5) % 100;
      const estado = h < 12 ? "ausente" : h < 20 ? "tarde" : "presente";
      registros.push({ id: `${alumnoId}-${materia}-${fecha}`, alumnoId, materia, fecha, estado });
    });
  });
  return registros;
}

// Simula latencia de red para que el loading state se sienta real
function delay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function obtenerRegistros(alumnoId: string): Promise<RegistroAsistencia[]> {
  // TODO: reemplazar por -> const res = await fetch(`/api/alumnos/${alumnoId}/asistencia`);
  return delay(generarMock(alumnoId));
}

export function calcularEstadisticas(
  alumnoId: string,
  nombre: string,
  curso: string,
  registros: RegistroAsistencia[]
): EstadisticaAlumno {
  const materias = [...new Set(registros.map((r) => r.materia))];

  const porMateria: EstadisticaMateria[] = materias.map((materia) => {
    const regs = registros.filter((r) => r.materia === materia);
    const total = regs.length;
    const puntos = regs.reduce((s, r) => s + PESO_ASISTENCIA[r.estado], 0);
    return {
      materia,
      total,
      presentes: regs.filter((r) => r.estado === "presente").length,
      tardes: regs.filter((r) => r.estado === "tarde").length,
      ausencias: regs.filter((r) => r.estado === "ausente").length,
      pct: total ? Math.round((puntos / total) * 100) : null,
    };
  });

  const totalGlobal = porMateria.reduce((s, m) => s + m.total, 0);
  const puntosGlobal = registros.reduce((s, r) => s + PESO_ASISTENCIA[r.estado], 0);

  return {
    alumnoId,
    nombre,
    curso,
    general: totalGlobal ? Math.round((puntosGlobal / totalGlobal) * 100) : null,
    porMateria,
    ultimaActualizacion: new Date().toISOString(),
  };
}

export function colorPorPct(pct: number | null): string {
  if (pct === null) return "#646B77";
  if (pct < 75) return "#B23B2B";
  if (pct < 85) return "#B07D2A";
  return "#2E7D52";
}