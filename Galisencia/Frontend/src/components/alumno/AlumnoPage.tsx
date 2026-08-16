import { useAuth } from "../../auth/AuthContext";
import AsistenciaDashboard from "../asistencia/AsistenciaDashboard";

export default function AlumnoPage() {
  const { usuario } = useAuth();
  if (!usuario) return null;
  return (
    <div className="page">
      <AsistenciaDashboard
        alumnoId={usuario.id}
        nombre={usuario.nombre}
        curso={usuario.curso ?? ""}
      />
    </div>
  );
}
