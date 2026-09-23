import { type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import AppLayout, { HOME } from "./components/layout/AppLayout";
import type { Rol } from "./data/types";
import AlumnoPage from "./components/alumno/AlumnoPage";
import PreceptorPage from "./components/preceptor/PreceptorPage";
import DirectivoPage from "./components/directivo/DirectivoPage";
import AdminPage from "./components/admin/AdminPage";
import GestionPage from "./components/gestion/GestionPage";
import ReportesPage from "./components/reportes/ReportesPage";
import AuditoriaPage from "./components/auditoria/AuditoriaPage";
import UsuariosPage from "./components/admin/UsuariosPage";
import HorariosPage from "./components/horarios/HorariosPage";

function RutaProtegida({
  rol,
  children,
}: {
  rol: Rol;
  children: ReactNode;
}) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== rol) return <Navigate to={HOME[usuario.rol]} replace />;
  return <>{children}</>;
}

function RutaConPermiso({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (!usuario.permisos.includes(permiso)) return <Navigate to={HOME[usuario.rol]} replace />;
  return <>{children}</>;
}

export default function App() {
  const { usuario, loading } = useAuth();

  if (loading) return null;

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={usuario ? <Navigate to={HOME[usuario.rol]} replace /> : <LoginPage />}
        />

        <Route element={usuario ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route
            path="/alumno"
            element={
              <RutaProtegida rol="alumno">
                <AlumnoPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/preceptor"
            element={
              <RutaProtegida rol="preceptor">
                <PreceptorPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/directivo"
            element={
              <RutaProtegida rol="directivo">
                <DirectivoPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin"
            element={
              <RutaProtegida rol="admin">
                <AdminPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/gestion"
            element={
              <RutaProtegida rol="admin">
                <GestionPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/reportes"
            element={
              <RutaProtegida rol={usuario?.rol ?? "alumno"}>
                <ReportesPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RutaProtegida rol="admin">
                <AuditoriaPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaProtegida rol="admin">
                <UsuariosPage />
              </RutaProtegida>
            }
          />
          <Route
            path="/horarios"
            element={<RutaConPermiso permiso="horarios.ver"><HorariosPage /></RutaConPermiso>}
          />
          <Route
            path="/admin/horarios"
            element={<RutaConPermiso permiso="horarios.gestionar"><HorariosPage /></RutaConPermiso>}
          />
        </Route>

        <Route path="*" element={<Navigate to={usuario ? HOME[usuario.rol] : "/login"} replace />} />
      </Routes>
    </>
  );
}
