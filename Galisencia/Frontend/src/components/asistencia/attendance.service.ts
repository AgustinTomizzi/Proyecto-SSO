import { UMBRAL_REGULARIDAD } from "./attendance.types";

export function colorPorPct(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  if (pct < UMBRAL_REGULARIDAD) return "var(--danger)";
  if (pct < 85) return "var(--warning)";
  return "var(--success)";
}
