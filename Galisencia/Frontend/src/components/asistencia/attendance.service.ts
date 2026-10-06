import { REGLAS_DEMO } from "./attendance.types";

/** Color según el porcentaje y el umbral de regularidad vigente. */
export function colorPorPct(pct: number | null, umbral = REGLAS_DEMO.umbral): string {
  if (pct === null) return "var(--text-muted)";
  if (pct < umbral) return "var(--danger)";
  if (pct < 85) return "var(--warning)";
  return "var(--success)";
}
