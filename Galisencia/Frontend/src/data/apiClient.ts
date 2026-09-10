type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

async function parse<T>(res: Response): Promise<T> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* sin JSON */
  }
  if (!res.ok) {
    const msg =
      data && typeof data.error === "string"
        ? data.error
        : `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (data && data.ok === false) throw new Error(data.error || "error");
  return data as T;
}

async function request<T>(
  path: string,
  method: ApiMethod,
  body?: unknown,
  timeoutMs?: number
): Promise<T> {
  const BASE = (import.meta as any).env?.VITE_API_URL ?? "/api";
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs) {
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      signal: ctrl.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    return await parse<T>(res);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function apiGet<T>(path: string, timeoutMs = 8000): Promise<T> {
  return request<T>(path, "GET", undefined, timeoutMs);
}

export function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  return request<T>(path, method, body);
}

/** True cuando el backend no respondió (demo/mock sin server). */
export function esErrorDeRed(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof DOMException && err.name === "AbortError")
  );
}