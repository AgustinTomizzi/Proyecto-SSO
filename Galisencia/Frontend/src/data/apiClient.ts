const BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

// La API rechaza escrituras sin este header (protección CSRF).
export const CSRF_HEADER = { "X-Requested-With": "galileo" } as const;

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export async function apiGet<T>(path: string, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      credentials: "include",
      headers: CSRF_HEADER,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || `Error HTTP ${res.status}`);
    if (data.ok === false) throw new Error(data.error || "La operación fue rechazada");
    return data as T;
  } finally {
    clearTimeout(t);
  }
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { ...CSRF_HEADER, "Content-Type": "application/json" } : CSRF_HEADER,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || `Error HTTP ${res.status}`);
  if (data.ok === false) throw new Error(data.error || "La operación fue rechazada");
  return data as T;
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: CSRF_HEADER,
    body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || `Error HTTP ${res.status}`);
  if (data.ok === false) throw new Error(data.error || "La operación fue rechazada");
  return data as T;
}
