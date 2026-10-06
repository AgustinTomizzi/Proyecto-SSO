import type { ReactNode } from 'react'

export type IconName = 'grid' | 'calendar' | 'user' | 'plus' | 'logout' | 'monitor' | 'box' | 'clock' | 'menu' | 'close' | 'laptop' | 'camera'
  | 'mic' | 'speaker' | 'cable' | 'chevron' | 'chevron-left' | 'chevron-right' | 'layers' | 'sun' | 'moon' | 'bell' | 'school' | 'arrow-right'
  | 'refresh' | 'lock' | 'eye' | 'eye-off' | 'alert' | 'chart' | 'check' | 'sliders'

const paths: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  box: <path d="M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10"/>,
  laptop: <><rect x="4" y="4" width="16" height="11" rx="1"/><path d="M2 19h20M6 15l-2 4M18 15l2 4"/></>,
  camera: <><path d="M7 7l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9H2V9a2 2 0 0 1 2-2h3z"/><circle cx="12" cy="12.5" r="3.5"/></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
  speaker: <><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="7" r="1.5"/></>,
  cable: <><path d="M7 4v5a5 5 0 0 0 10 0V6M5 2h4v3H5zM15 3h4v3h-4zM12 14v7"/><circle cx="12" cy="21" r="1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="M6 6l12 12M18 6L6 18"/>,
  chevron: <path d="M6 9l6 6 6-6"/>,
  'chevron-left': <path d="M15 18l-6-6 6-6"/>,
  'chevron-right': <path d="m9 18 6-6-6-6"/>,
  layers: <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>,
  school: <><path d="m3 10 9-6 9 6"/><path d="M5 9v10h14V9M9 19v-6h6v6"/></>,
  'arrow-right': <path d="M5 12h14M12 5l7 7-7 7"/>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/></>,
  alert: <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>,
  chart: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>,
}

export function Icon({ name, size }: { name: IconName, size?: number }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width={size} height={size} style={size ? { width: size, height: size } : undefined}>{paths[name]}</svg>
}
