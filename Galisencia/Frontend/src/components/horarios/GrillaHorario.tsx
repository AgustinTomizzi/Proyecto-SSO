import { DIAS, GRUPOS, nombreDia, type Franja, type Grupo } from "./grillaTipos";
import { pieDeBloque, rangoHora, type Bloque, type Celda, type LayoutGrilla } from "./grillaModelo";

interface Props {
  layout: LayoutGrilla;
  /** Título de la hoja ("1º A"), como en el horario oficial. */
  titulo: string;
  subtitulo?: string;
  /** Texto del pie izquierdo ("Horario vigente al 05/10/2026"). */
  pie: string;
  /** Día (1-5) a resaltar. */
  diaActivo: number | null;
  /** Vista del docente: el pie de cada caja muestra el curso. */
  mostrarCurso?: boolean;
  /** Si están, las celdas son botones (gestión). */
  onBloque?: (bloque: Bloque) => void;
  onVacia?: (dia: number, franja: Franja, grupo: Grupo) => void;
}

export default function GrillaHorario({ layout, titulo, subtitulo, pie, diaActivo, mostrarCurso = false, onBloque, onVacia }: Props) {
  const editable = Boolean(onBloque && onVacia);
  return (
    <div className="grilla-hoja">
      <header className="grilla-hoja__titulo">
        <h2>{titulo}</h2>
        {subtitulo && <span>{subtitulo}</span>}
      </header>
      <div className="grilla-scroll" role="region" aria-label={`Horario de ${titulo}`} tabIndex={0}>
        <table className={`grilla${editable ? " grilla--editable" : ""}`}>
          <colgroup>
            <col className="grilla-col-hora" />
            {DIAS.map((d) => [<col key={`${d.n}a`} />, <col key={`${d.n}b`} />])}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="grilla-esquina"><span className="grilla-sr">Horario</span></th>
              {DIAS.map((d) => (
                <th key={d.n} scope="col" colSpan={2} className={d.n === diaActivo ? "grilla-dia grilla-dia--activo" : "grilla-dia"}>
                  <span className="grilla-dia-largo">{d.nombre}</span>
                  <span className="grilla-dia-corto" aria-hidden="true">{d.corto}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {layout.filas.map((fila) => [
              <tr key={fila.franja.id} className="grilla-fila">
                <th scope="row" className="grilla-hora">{rangoHora(fila.franja.horaInicio, fila.franja.horaFin)}</th>
                {fila.celdas.map((celda) => (
                  <CeldaGrilla
                    key={`${celda.dia}-${celda.mitad}`}
                    celda={celda}
                    franja={fila.franja}
                    activa={celda.dia === diaActivo}
                    mostrarCurso={mostrarCurso}
                    onBloque={onBloque}
                    onVacia={onVacia}
                  />
                ))}
              </tr>,
              fila.bandaDespues && (
                <tr key={`banda-${fila.franja.id}`} className="grilla-banda">
                  <th scope="row">Cambio de turno</th>
                  <td colSpan={DIAS.length * 2}>Cambio de turno</td>
                </tr>
              ),
            ])}
          </tbody>
        </table>
      </div>
      <footer className="grilla-hoja__pie">
        <span>{pie}</span>
        <span>Galisencia</span>
      </footer>
    </div>
  );
}

interface CeldaProps {
  celda: Celda;
  franja: Franja;
  activa: boolean;
  mostrarCurso: boolean;
  onBloque?: (bloque: Bloque) => void;
  onVacia?: (dia: number, franja: Franja, grupo: Grupo) => void;
}

function CeldaGrilla({ celda, franja, activa, mostrarCurso, onBloque, onVacia }: CeldaProps) {
  const clases = [
    "grilla-celda",
    celda.tipo === "vacia" ? "grilla-celda--vacia" : "grilla-celda--bloque",
    celda.colSpan === 1 ? "grilla-celda--media" : "",
    celda.mitad === 0 ? "grilla-celda--inicio" : "",
    activa ? "grilla-celda--activa" : "",
  ].filter(Boolean).join(" ");

  if (celda.tipo === "vacia") {
    const grupoTexto = celda.grupo === 0 ? "" : ` (${GRUPOS[celda.grupo].nombre.toLowerCase()})`;
    return (
      <td className={clases} colSpan={celda.colSpan}>
        {onVacia ? (
          <button
            type="button"
            className="grilla-vacia"
            onClick={() => onVacia(celda.dia, franja, celda.grupo)}
            aria-label={`Agregar clase el ${nombreDia(celda.dia).toLowerCase()} de ${rangoHora(franja.horaInicio, franja.horaFin)}${grupoTexto}`}
          >
            <span aria-hidden="true">+</span>
          </button>
        ) : (
          <span className="grilla-sr">Sin clase</span>
        )}
      </td>
    );
  }

  return (
    <td className={clases} colSpan={celda.colSpan} rowSpan={celda.rowSpan}>
      <div className={`grilla-cajas${celda.bloques.length > 1 ? " grilla-cajas--apiladas" : ""}`}>
        {celda.bloques.map((bloque) => (
          <Caja key={bloque.ids.join("-")} bloque={bloque} media={celda.colSpan === 1} mostrarCurso={mostrarCurso} onBloque={onBloque} />
        ))}
      </div>
    </td>
  );
}

function Caja({ bloque, media, mostrarCurso, onBloque }: { bloque: Bloque; media: boolean; mostrarCurso: boolean; onBloque?: (b: Bloque) => void }) {
  const pie = pieDeBloque(bloque, mostrarCurso);
  const hora = rangoHora(bloque.horaInicio, bloque.horaFin);
  const descripcion = [
    bloque.materia,
    `${nombreDia(bloque.dia)} ${hora}`,
    bloque.grupo !== 0 ? GRUPOS[bloque.grupo].nombre : "",
    bloque.aula ? `aula ${bloque.aula}` : "",
    pie,
  ].filter(Boolean).join(", ");
  const contenido = (
    <>
      {bloque.aula && <span className="grilla-caja__aula">{bloque.aula}</span>}
      <span className="grilla-caja__materia">{bloque.materia}</span>
      <span className={`grilla-caja__pie${pie ? "" : " grilla-caja__pie--vacio"}`}>{pie || (mostrarCurso ? "" : "Sin docente")}</span>
    </>
  );
  const clase = `grilla-caja${media ? " grilla-caja--media" : ""}${bloque.grupo !== 0 ? ` grilla-caja--g${bloque.grupo}` : ""}`;
  if (onBloque) {
    return (
      <button type="button" className={`${clase} grilla-caja--btn`} onClick={() => onBloque(bloque)} aria-label={`Editar ${descripcion}`} title={descripcion}>
        {contenido}
      </button>
    );
  }
  return (
    <div className={clase} title={descripcion}>
      {contenido}
    </div>
  );
}
