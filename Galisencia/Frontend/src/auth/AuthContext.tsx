import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Usuario } from "../data/types";
import { changePassword, closeSession, login as loginService, restoreSession } from "./auth.service";
import { limpiarDatosLocales } from "../data/localData";
import { avisarCierreSesion, escucharCierreSesion } from "./sesionCompartida";

interface AuthState {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  logout: () => Promise<void>;
  cambiarPassword: (actual: string, nueva: string) => Promise<void>;
  /** Error al consultar la sesión porque el servidor no respondió. */
  errorConexion: string | null;
  reintentarSesion: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((sessionUser) => {
        if (!active) return;
        setUsuario(sessionUser);
        setErrorConexion(null);
      })
      .catch((error: unknown) => {
        if (active) setErrorConexion(error instanceof Error ? error.message : "No se pudo conectar con el servidor.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [intento]);

  // Si se cierra la sesión en Galiservas (misma cookie), esta app también sale.
  useEffect(() => escucharCierreSesion(() => {
    limpiarDatosLocales();
    setUsuario(null);
  }), []);

  function reintentarSesion() {
    setLoading(true);
    setIntento((n) => n + 1);
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const authenticatedUser = await loginService(email, password);
      setErrorConexion(null);
      setUsuario(authenticatedUser);
      return authenticatedUser;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await closeSession();
    } finally {
      limpiarDatosLocales();
      avisarCierreSesion();
      setUsuario(null);
    }
  }

  async function cambiarPassword(actual: string, nueva: string) {
    await changePassword(actual, nueva);
    setUsuario(await restoreSession());
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, cambiarPassword, errorConexion, reintentarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
