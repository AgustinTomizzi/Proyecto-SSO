import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../ui/Toast";
import { descargarDatos } from "./descargarDatos";
import TextoPolitica from "./TextoPolitica";
import "./privacidad.css";

/** Botones de derecho de acceso según el rol (los permisos los vuelve a chequear la API). */
function MisDatos() {
  const { usuario } = useAuth();
  const { push } = useToast();
  const [bajando, setBajando] = useState("");
  if (!usuario) return null;

  async function bajar(clave: string, alumnoId?: string) {
    setBajando(clave);
    try {
      await descargarDatos(alumnoId);
      push("Descargamos tus datos en un archivo JSON");
    } catch (e) {
      push(e instanceof Error ? e.message : "No se pudieron descargar los datos.", "error");
    } finally {
      setBajando("");
    }
  }

  return (
    <div className="card card-pad-lg">
      <h3>Tus datos</h3>
      <p className="muted text-sm" style={{ margin: "4px 0 0" }}>
        Podés descargar todo lo que el sistema tiene sobre vos en un archivo. Para corregir o pedir que se borre algo, acercate a la escuela.
        {usuario.versionPolitica ? ` Aceptaste la versión ${usuario.versionPolitica} de esta política.` : ""}
      </p>
      <div className="privacidad__descargas">
        <button type="button" className="btn btn-primary btn-sm" disabled={bajando !== ""} onClick={() => void bajar("cuenta")}>
          {bajando === "cuenta" ? "Preparando..." : "Descargar los datos de mi cuenta"}
        </button>
        {usuario.rol === "alumno" && (
          <button type="button" className="btn btn-soft btn-sm" disabled={bajando !== ""} onClick={() => void bajar("alumno", usuario.id)}>
            {bajando === "alumno" ? "Preparando..." : "Descargar mis datos de alumno"}
          </button>
        )}
        {usuario.rol === "tutor" && (usuario.alumnos ?? []).map((hijo) => (
          <button key={hijo.id} type="button" className="btn btn-soft btn-sm" disabled={bajando !== ""} onClick={() => void bajar(`hijo-${hijo.id}`, hijo.id)}>
            {bajando === `hijo-${hijo.id}` ? "Preparando..." : `Descargar los datos de ${hijo.nombre}`}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Política de privacidad. Con sesión, dentro de la app y con la descarga de datos; sin sesión, pública. */
export default function PrivacidadPage() {
  const { usuario } = useAuth();
  if (!usuario) {
    return (
      <div className="gdash privacidad-publica">
        <div className="privacidad-publica__contenido">
          <Link to="/login" className="btn btn-ghost btn-sm privacidad-publica__volver">← Volver al inicio de sesión</Link>
          <div className="card card-pad-lg">
            <h1 style={{ marginTop: 0 }}>Política de privacidad</h1>
            <TextoPolitica />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="page" style={{ display: "grid", gap: 18, alignContent: "start" }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Privacidad</h1>
          <p className="sub">Cómo tratamos tus datos y cómo descargarlos.</p>
        </div>
      </div>
      <MisDatos />
      <div className="card card-pad-lg">
        <TextoPolitica />
      </div>
    </div>
  );
}
