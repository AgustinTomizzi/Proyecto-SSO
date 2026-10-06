// Elementos visuales compartidos por las pantallas de estado (mismo diseño que
// el login de Galisencia).

export function CircuitPattern() {
  return (
    <svg className="login__circuit" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M0 40 H20 M60 40 H80 M40 0 V20 M40 60 V80" stroke="white" strokeWidth="0.5" opacity="0.12" fill="none" />
          <circle cx="20" cy="40" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <circle cx="60" cy="40" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <circle cx="40" cy="20" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <circle cx="40" cy="60" r="2.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
          <path d="M20 40 L30 30 L50 30 L60 40" stroke="white" strokeWidth="0.4" fill="none" opacity="0.1" />
          <path d="M20 40 L30 50 L50 50 L60 40" stroke="white" strokeWidth="0.4" fill="none" opacity="0.1" />
          <rect x="29" y="29" width="22" height="22" fill="none" stroke="white" strokeWidth="0.3" opacity="0.08" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit)" />
    </svg>
  )
}

export function LoginFooter() {
  return (
    <div className="login__footer">
      <span className="login__footer-brand">GALISERVAS</span>
      <span>·</span>
      <span>Sistema de Reservas</span>
      <span>·</span>
      <span>2026</span>
    </div>
  )
}
