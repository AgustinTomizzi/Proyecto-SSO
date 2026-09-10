import type { Rol, Usuario } from "../data/types";
import { buildAlumnos } from "../data/mock";

// Base del backend. Cuando el server del profe esté prendido y el PHP
// expuesto, apuntá esta variable de entorno a la URL del backend.
const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

interface LoginResult {
  usuario: Usuario;
  modo: "backend" | "mock";
}

/** Deriva el rol de demo a partir del email (sólo si el backend está apagado). */
function rolDesdeEmail(email: string): Rol {
  const e = email.toLowerCase();
  if (e.includes("admin")) return "admin";
  if (e.includes("directivo")) return "directivo";
  if (e.includes("preceptor") || e.includes("docente") || e.includes("prof")) return "preceptor";
  return "alumno";
}

/**
 * Autentica contra el backend real (api/login.php) y devuelve el usuario con su
 * rol real (el rol lo decide el backend, NO el formulario).
 * Si el backend no responde (server apagado, fuera de línea, CORS),
 * cae a un login MOCK para que la demo del frontend nunca se rompa.
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  // 1) Intento real contra el backend (con timeout para no quedar colgado)
  let backendDisponible = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${API_BASE}/login.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    backendDisponible = true;
    const data = await res.json();
    if (res.ok && data?.ok && data?.usuario) {
      return { usuario: data.usuario as Usuario, modo: "backend" };
    }
    // El backend respondió pero rechazó el login: no enmascarar con mock.
    throw new Error(data?.error || `HTTP ${res.status}`);
  } catch (err) {
    if (backendDisponible) {
      throw err;
    }
    // Backend inalcanzable (apagado, timeout, fuera de línea) -> mock
  }

  // 2) Fallback MOCK (demo)
  await new Promise((r) => setTimeout(r, 450));
  const rol = rolDesdeEmail(email);
  const nombrePorRol: Record<Rol, string> = {
    alumno: "Sofía Gutiérrez",
    preceptor: "Prof. Ramírez",
    directivo: "Lic. Barbosa",
    admin: "Admin Estela",
  };

  // El alumno de demo se mapea a un alumno sembrado real para que su
  // dashboard de asistencia tenga datos coherentes con el resto del sistema.
  const seed = buildAlumnos();
  const alumnoDemo =
    rol === "alumno"
      ? seed.find((a) => a.nombre === nombrePorRol.alumno) ?? seed[0]
      : null;

  const usuario: Usuario = {
    id: alumnoDemo ? alumnoDemo.id : `mock-${rol}`,
    nombre: nombrePorRol[rol],
    email: alumnoDemo ? alumnoDemo.email : email || `demo@galileo.edu.ar`,
    rol,
    curso: alumnoDemo ? alumnoDemo.curso : rol === "alumno" ? "1.º A" : undefined,
  };
  return { usuario, modo: "mock" };
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/logout.php`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // El estado local se limpia aunque el backend no esté disponible.
  }
}
