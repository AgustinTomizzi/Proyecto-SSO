import type { Usuario } from "../data/types";
import { changePassword, closeSession, login, restoreSession } from "./auth.service";

// Autenticación intercambiable (ver docs/AUTENTICACION.md). AuthContext solo
// conoce esta interfaz; el adaptador "local" usa la API de Galileo Auth con
// email y contraseña. Un adaptador OIDC redirigiría al proveedor externo en
// iniciarSesion y restauraría la sesión que abre el backend al volver.
export interface AdaptadorAutenticacion {
  iniciarSesion(email: string, password: string): Promise<Usuario>;
  /** null si no hay sesión; lanza un error si el servidor no responde. */
  restaurarSesion(): Promise<Usuario | null>;
  cerrarSesion(): Promise<void>;
  cambiarPassword(actual: string, nueva: string): Promise<void>;
}

const adaptadorLocal: AdaptadorAutenticacion = {
  iniciarSesion: login,
  restaurarSesion: restoreSession,
  cerrarSesion: closeSession,
  cambiarPassword: changePassword,
};

/** Adaptador elegido con VITE_AUTH_MODO (por defecto "local"). */
export function adaptadorConfigurado(): AdaptadorAutenticacion {
  const modo = String((import.meta as any).env?.VITE_AUTH_MODO ?? "local").toLowerCase();
  if (modo === "local") return adaptadorLocal;
  throw new Error(`VITE_AUTH_MODO no soportado: ${modo}`);
}
