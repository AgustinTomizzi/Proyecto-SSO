import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Usuario } from "../data/types";
import { login as loginService, logout as logoutService } from "./auth.service";

interface AuthState {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "galisencia.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(false);

  // Restaurar sesión persistida
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setUsuario(data.usuario);
      }
    } catch {
      /* noop */
    }
  }, []);

  async function login(email: string, password: string): Promise<Usuario> {
    setLoading(true);
    try {
      const result = await loginService(email, password);
      setUsuario(result.usuario);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ usuario: result.usuario })
      );
      return result.usuario;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setUsuario(null);
    localStorage.removeItem(STORAGE_KEY);
    await logoutService();
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
