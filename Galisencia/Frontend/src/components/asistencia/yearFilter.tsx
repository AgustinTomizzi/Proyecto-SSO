interface Props {
  anios: number[];
  anioSeleccionado: number | null; // null = "todos"
  onCambiar: (anio: number | null) => void;
}

export default function YearFilter({ anios, anioSeleccionado, onCambiar }: Props) {
  if (anios.length <= 1) return null;
  return (
    <div className="subject-filter">
      <button
        className={anioSeleccionado === null ? "on" : ""}
        onClick={() => onCambiar(null)}
      >
        Todos los años
      </button>
      {[...anios].sort((a, b) => a - b).map((a) => (
        <button
          key={a}
          className={anioSeleccionado === a ? "on" : ""}
          onClick={() => onCambiar(anioSeleccionado === a ? null : a)}
        >
          {a}
        </button>
      ))}
    </div>
  );
}