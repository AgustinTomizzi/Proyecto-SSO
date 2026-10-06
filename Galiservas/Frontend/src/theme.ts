import { useEffect, useState } from 'react'

// Tema claro/oscuro, igual que en Galisencia: se guarda en localStorage y,
// si no hay preferencia guardada, se toma la del sistema operativo.
export type Theme = 'light' | 'dark'

const THEME_KEY = 'galiservas.theme'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* almacenamiento no disponible */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* almacenamiento no disponible */ }
  }, [theme])

  return { theme, toggle: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')) }
}
