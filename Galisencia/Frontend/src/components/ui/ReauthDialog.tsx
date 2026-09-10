import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

interface Props {
  open: boolean;
  mode: "baja" | "curso";
  alumnoNombre: string;
  cursos?: { value: string; label: string }[];
  error?: string | null;
  loading?: boolean;
  onConfirm: (contrasena: string, nuevoCurso?: string) => void;
  onCancel: () => void;
}

export default function ReauthDialog({
  open,
  mode,
  alumnoNombre,
  cursos = [],
  error,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [contrasena, setContrasena] = useState("");
  const [nuevoCurso, setNuevoCurso] = useState(cursos[0]?.value ?? "");

  useEffect(() => {
    if (!open) return;
    setContrasena("");
    setNuevoCurso(cursos[0]?.value ?? "");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, cursos]);

  if (!open) return null;

  const esBaja = mode === "baja";

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={esBaja ? "Dar de baja" : "Cambiar curso"}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal__title">
          {esBaja ? "Dar de baja" : "Cambiar de curso"}
        </h3>
        <p className="modal__msg">
          {esBaja
            ? `Acción sensible: vas a dar de baja a ${alumnoNombre}. Reingresá tu contraseña para confirmar.`
            : `Acción sensible: vas a cambiar a ${alumnoNombre} de curso. Reingresá tu contraseña para confirmar.`}
        </p>

        {!esBaja && (
          <div className="field" style={{ margin: "14px 0 0" }}>
            <label htmlFor="reauth-curso">Nuevo curso</label>
            <select
              id="reauth-curso"
              className="select"
              value={nuevoCurso}
              onChange={(e) => setNuevoCurso(e.target.value)}
            >
              {cursos.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field" style={{ margin: "14px 0 0" }}>
          <label htmlFor="reauth-pass">Tu contraseña</label>
          <input
            id="reauth-pass"
            className="input"
            type="password"
            value={contrasena}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="login__error">{error}</p>}

        <div className="modal__actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className={`btn ${esBaja ? "btn-danger" : "btn-primary"}`}
            disabled={loading || !contrasena}
            onClick={() =>
              onConfirm(
                contrasena,
                esBaja ? undefined : nuevoCurso || undefined
              )
            }
          >
            {loading ? "Confirmando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}