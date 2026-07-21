import type { RegistroAsistencia } from "./attendance.types";

interface Props {
  registros: RegistroAsistencia[];
}

const ETIQUETA: Record<string, { texto: string; color: string; bg: string }> = {
  presente: { texto: "Presente", color: "#2E7D52", bg: "#E8F1EB" },
  tarde: { texto: "Tarde", color: "#B07D2A", bg: "#F6EEDC" },
  ausente: { texto: "Ausente", color: "#B23B2B", bg: "#F6E6E1" },
};

function fechaLinda(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function HistoryTable({ registros }: Props) {
  const ordenados = [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (ordenados.length === 0) {
    return <p className="history-table__vacio">No hay registros para este filtro todavía.</p>;
  }

  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Materia</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {ordenados.map((r) => {
          const e = ETIQUETA[r.estado];
          return (
            <tr key={r.id}>
              <td>{fechaLinda(r.fecha)}</td>
              <td>{r.materia}</td>
              <td>
                <span style={{ color: e.color, background: e.bg }} className="history-table__badge">
                  {e.texto}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}