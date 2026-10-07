import { apiUrl, CSRF_HEADER } from "../../data/apiClient";

/**
 * Derecho de acceso: descarga el JSON de datos personales.
 * Sin alumnoId, los de la propia cuenta.
 */
export async function descargarDatos(alumnoId?: string): Promise<void> {
  const ruta = alumnoId ? `/datos_personales.php?alumnoId=${encodeURIComponent(alumnoId)}` : "/datos_personales.php";
  const res = await fetch(apiUrl(ruta), { credentials: "include", headers: CSRF_HEADER });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Error HTTP ${res.status}`);
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "mis-datos.json";
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
