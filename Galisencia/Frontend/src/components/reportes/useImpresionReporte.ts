import { useEffect } from "react";

const CAMINO = "reporte-print-camino";
const IMPRIMIENDO = "reporte-imprimiendo";

/**
 * Al imprimir marca los ancestros de la hoja del reporte para que reportes.css
 * oculte el resto de la app con display:none (mismo criterio que la impresión
 * de horarios) y la tabla pueda ocupar varias páginas.
 */
export function useImpresionReporte() {
  useEffect(() => {
    const limpiar = () => {
      document.documentElement.classList.remove(IMPRIMIENDO);
      document.querySelectorAll(`.${CAMINO}`).forEach((el) => el.classList.remove(CAMINO));
    };
    const antes = () => {
      limpiar();
      const hoja = document.querySelector(".reportes-page .reporte-hoja");
      if (!hoja) return;
      for (let el = hoja.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        el.classList.add(CAMINO);
      }
      document.documentElement.classList.add(IMPRIMIENDO);
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", limpiar);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", limpiar);
      limpiar();
    };
  }, []);
}
