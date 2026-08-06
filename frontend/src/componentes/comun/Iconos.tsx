/**
 * LOS ICONOS, DIBUJADOS A MANO. Un solo grosor de trazo, un solo estilo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ NO SE CARGA UNA LIBRERÍA DE ICONOS, Y ESTO NO ES UNA OPINIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * Google Stitch resolvió estos mismos iconos pidiendo **Material Symbols a
 * Google Fonts**. La fuente no llegó, y el resultado se ve en sus propias
 * capturas: los nombres de los iconos salieron **como texto suelto** —
 * `visibility`, `shield`, `memory`, `route`, `lightbulb`— en mitad de la
 * interfaz.
 *
 * Es exactamente el fallo que esta aplicación no puede permitirse: el
 * experimento que hoy bloquea el producto (la F0) es **si el punto de acceso
 * del aula deja pasar el tráfico**. Una interfaz que necesita una petición a
 * Google para tener iconos se rompe justo donde va a usarse, y sin dar error.
 *
 * ⚠️ Y `craft-floor` lo prohíbe además por otra razón: «Unicode glyphs or emoji
 *    standing in for an icon system. Icons are drawn, from a real library or
 *    authored SVG, in one consistent stroke and weight.»
 *
 * Todos comparten caja de 24, `stroke-width` 1.6 y `currentColor`, así que
 * heredan el color del texto y pesan lo mismo unos junto a otros.
 */

export type PropsIcono = { className?: string }

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Taller: un cursor de escritura sobre una hoja. El sitio donde se escribe. */
export function IconoTaller({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M14.5 3.5H6.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-8" />
      <path d="M8.5 12.5l2 2 4.5-4.5" />
      <path d="M17 3l4 4" />
    </svg>
  )
}

/** Conducir: una cruceta. Es literalmente el mando de esa pantalla. */
export function IconoConducir({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v16M4 12h16" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

/** No obedece: un triángulo de aviso. */
export function IconoNoObedece({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4.2 2.8 20h18.4L12 4.2Z" />
      <path d="M12 10v4M12 17v.4" />
    </svg>
  )
}

/** Telemetria: una traza con puntos de medida. */
export function IconoTelemetria({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17l4.5-6 3.5 4L15 8l6 6" />
      <circle cx="7.5" cy="11" r="1.2" />
      <circle cx="15" cy="8" r="1.2" />
    </svg>
  )
}

/** LIDAR: anillos de distancia con un punto en el centro. */
export function IconoLidar({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M12 12l6-6" />
    </svg>
  )
}

/**
 * Navegar: una chincheta sobre un plano. NO una brujula ni una rosa de los
 * vientos, y eso es deliberado: **este robot no tiene rumbo absoluto** —el
 * magnetometro se acepta sin error y es un no-op, comprobado mirando el robot—,
 * asi que un icono de brujula prometeria justo lo unico que no hay.
 */
export function IconoNavegar({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      {/* El plano, con su doblez. */}
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v13M15 6.5v13" />
      {/* La chincheta. */}
      <path d="M15.5 9.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Diagnostico: un pulso con una lupa implicita. Ritmos y antiguedades. */
export function IconoDiagnostico({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12h3.5l2-5 3 10 2.5-5H21" />
    </svg>
  )
}

/** Flota: la losa de dieciseis. */
export function IconoFlota({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  )
}

/** Cuaderno: una libreta con su renglon. */
export function IconoCuaderno({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6" />
      <path d="M6 3.5v17M9.5 8.5h5.5M9.5 12.5h5.5" />
    </svg>
  )
}

/** Portada: la casa. */
export function IconoPortada({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  )
}

/** Usuarios: dos siluetas. Administrar cuentas, no un perfil. */
export function IconoUsuarios({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 20.5c0-3.1 2.7-5.2 6-5.2s6 2.1 6 5.2" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.4 15.8c1.9.6 3.1 2.3 3.1 4.7" />
    </svg>
  )
}

/** Entrar: una flecha que cruza el vano de una puerta. */
export function IconoEntrar({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <path d="M13.5 3.5h5A1.5 1.5 0 0 1 20 5v14a1.5 1.5 0 0 1-1.5 1.5h-5" />
      <path d="M4 12h9.5M10 8.2l3.8 3.8L10 15.8" />
    </svg>
  )
}

/** Proyeccion: una pantalla que emite. */
export function IconoProyeccion({ className }: PropsIcono) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="4" width="19" height="13" rx="1.6" />
      <path d="M9 20.5h6" />
    </svg>
  )
}
