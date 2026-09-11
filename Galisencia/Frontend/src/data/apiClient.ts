const BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";

export async function apiGet<T>(path: string, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      credentials: "include",
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
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || `Error HTTP ${res.status}`);
  if (data.ok === false) throw new Error(data.error || "La operación fue rechazada");
  return data as T;
}
