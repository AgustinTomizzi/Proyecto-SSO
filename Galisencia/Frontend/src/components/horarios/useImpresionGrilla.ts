import { useEffect } from "react";

const CAMINO = "grilla-print-camino";
const IMPRIMIENDO = "grilla-imprimiendo";

/**
 * Al imprimir (botón o Ctrl+P) marca los ancestros de la hoja del horario para
 * que horarios.css oculte todo lo demás con display:none: así el resto de la
 * app no ocupa lugar y la grilla entra en una sola página, sin tocar los
 * estilos globales del layout.
 */
export function useImpresionGrilla() {
  useEffect(() => {
    const limpiar = () => {
      document.documentElement.classList.remove(IMPRIMIENDO);
      document.querySelectorAll(`.${CAMINO}`).forEach((el) => el.classList.remove(CAMINO));
    };
    const antes = () => {
      limpiar();
      const hoja = document.querySelector(".horarios-page .grilla-hoja");
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
