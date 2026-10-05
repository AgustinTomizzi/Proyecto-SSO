import type { Rol, Usuario } from "../data/types";

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

interface BackendUser {
  id: string | number;
  nombre: string;
  apellido?: string;
  email: string;
  rol: string;
  rol_backend?: string;
  curso?: string;
}

interface SessionResponse {
  ok: boolean;
  usuario: BackendUser;
  permisos?: string[];
  sistemas?: string[];
  error?: string;
}

function normalizeRole(value: string): Rol {
  const role = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (role === "preceptor" || role === "docente") return "preceptor";
  if (role === "directivo") return "directivo";
  if (role.includes("administrador") || role === "admin") return "admin";
  return "alumno";
}

function toUser(data: SessionResponse): Usuario {
  const user = data.usuario;
  return {
    id: String(user.id),
    nombre: [user.nombre, user.apellido].filter(Boolean).join(" "),
    email: user.email,
    rol: normalizeRole(user.rol),
    rolBackend: user.rol_backend ?? user.rol,
    permisos: data.permisos ?? [],
    sistemas: data.sistemas ?? [],
    curso: user.curso,
  };
}

async function request(path: string, init?: RequestInit): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const data = (await response.json().catch(() => null)) as SessionResponse | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `No se pudo conectar con Galileo Auth (HTTP ${response.status}).`);
  }
  return data;
}

export async function login(email: string, password: string): Promise<Usuario> {
  const data = await request("/login.php", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return toUser(data);
}

export async function restoreSession(): Promise<Usuario | null> {
  try {
    const data = await request("/sesion.php");
    return toUser(data);
  } catch {
    return null;
  }
}

export async function closeSession(): Promise<void> {
  await request("/logout.php", { method: "POST" });
}
