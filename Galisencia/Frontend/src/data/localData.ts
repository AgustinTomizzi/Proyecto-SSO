// Claves de versiones anteriores que guardaban alumnos, cursos y asistencias
// reales en el navegador. Ya no se escriben; se borran por si quedaron.
const CLAVES_DATOS = ["galisencia.data"];

export function limpiarDatosLocales(): void {
  for (const clave of CLAVES_DATOS) {
    try {
      localStorage.removeItem(clave);
    } catch {
      /* noop */
    }
  }
}
