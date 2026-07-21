interface Props {
  materias: string[];
  materiaSeleccionada: string | null; // null = "todas"
  onCambiar: (materia: string | null) => void;
}

export default function SubjectFilter({ materias, materiaSeleccionada, onCambiar }: Props) {
  return (
    <div className="subject-filter">
      <button
        className={materiaSeleccionada === null ? "on" : ""}
        onClick={() => onCambiar(null)}
      >
        Todas
      </button>
      {materias.map((m) => (
        <button
          key={m}
          className={materiaSeleccionada === m ? "on" : ""}
          onClick={() => onCambiar(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}