import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Usuario } from "../data/types";
import { closeSession, login as loginService, restoreSession } from "./auth.service";

interface AuthState {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((sessionUser) => {
        if (active) setUsuario(sessionUser);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const authenticatedUser = await loginService(email, password);
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
      setUsuario(null);
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
