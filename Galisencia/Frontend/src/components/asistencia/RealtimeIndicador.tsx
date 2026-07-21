interface Props {
  ultimaActualizacion: string; // ISO datetime
  actualizando: boolean;
  onRefrescar: () => void;
}

function hace(iso: string): string {
  const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 10) return "recién";
  if (seg < 60) return `hace ${seg}s`;
  const min = Math.floor(seg / 60);
  return `hace ${min} min`;
}

export default function RealtimeIndicador({ ultimaActualizacion, actualizando, onRefrescar }: Props) {
  return (
    <div className="realtime-indicador">
      <span className={`realtime-indicador__dot${actualizando ? " pulse" : ""}`} />
      <span>Actualizado {hace(ultimaActualizacion)}</span>
      <button onClick={onRefrescar} disabled={actualizando}>
        {actualizando ? "Actualizando…" : "Refrescar"}
      </button>
    </div>
  );
}