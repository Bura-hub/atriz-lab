'use client'

/**
 * Los dos controles del muro: MODO PROYECCIÓN y ORDEN.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DE DÓNDE SALEN: LOS PROPUSO GOOGLE STITCH, NO EL ENCARGO
 * ═══════════════════════════════════════════════════════════════════════════
 * Al generar el muro a partir de `PLATAFORMA_STITCH.md`, Stitch añadió tres
 * cosas que el documento no pedía. Dos se adoptan porque resuelven tensiones
 * que el propio documento tenía abiertas, y **la tercera se rechazó** (ver
 * abajo). Lo demás que devolvió —latencias, voltajes de 12 V, prosa inventada—
 * se tiró entero.
 *
 * ── MODO PROYECCIÓN ─────────────────────────────────────────────────────────
 * El documento decía que el muro necesita un modo claro de alto contraste
 * «con un botón, no con `prefers-color-scheme`, porque la decisión la toma
 * quien proyecta, no su sistema operativo», y lo dejaba pendiente. Esto es ese
 * botón.
 *
 * 🔴 Y resuelve además la objeción que la síntesis del análisis le hizo al
 *    mundo oscuro: **el vidrio baja el contraste justo en la única pantalla
 *    cuyo criterio escrito es «una persona a tres metros»**. En modo proyección
 *    el vidrio desaparece y los bloques se quedan; el mundo se mantiene donde
 *    se disfruta —las pantallas del alumno, a 50 cm— y cede donde estorba.
 *
 * ── ORDEN ───────────────────────────────────────────────────────────────────
 * 🔴 Por defecto SIEMPRE por número, y esto no es una preferencia.
 *
 * En un muro que se mira veinte veces por clase, la posición de cada robot es
 * memoria muscular: si rvr-03 se pone en apuros y salta al primer hueco, los
 * otros trece se recolocan y hay que volver a buscarlos todos. Ordenar por
 * atención es útil **cuando alguien lo pide a propósito**, no como estado por
 * defecto que cambia solo.
 *
 * ── LO QUE SE RECHAZÓ DE STITCH ─────────────────────────────────────────────
 * Un tercer orden «por voltaje». No existe: la batería se decide por umbrales
 * (7,0 y 6,5 V), no por ranking, y ordenar por voltaje invita exactamente a la
 * lectura continua que el proyecto prohíbe —«va por la mitad»— sobre una
 * magnitud cuya escala honesta nadie ha establecido.
 */

import { OrdenMuro } from '@/lib/flota/orden'

export interface PropsControlesMuro {
  proyeccion: boolean
  alCambiarProyeccion: (v: boolean) => void
  orden: OrdenMuro
  alCambiarOrden: (o: OrdenMuro) => void
}

const ORDENES: readonly { valor: OrdenMuro; texto: string }[] = [
  { valor: 'NUMERO', texto: 'por número' },
  { valor: 'ATENCION', texto: 'por atención' },
]

export function ControlesMuro({
  proyeccion, alCambiarProyeccion, orden, alCambiarOrden,
}: PropsControlesMuro) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* El selector de orden: dos posiciones, la de por defecto primero. */}
      <div
        className="vidrio flex rounded-full p-1"
        role="group"
        aria-label="Orden de las fichas"
      >
        {ORDENES.map((o) => {
          const activo = orden === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => alCambiarOrden(o.valor)}
              aria-pressed={activo}
              className={`pulsable focus-ring rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-[var(--t-estado)] ${
                activo
                  ? 'bg-[rgb(var(--vidrio)/0.14)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.texto}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => alCambiarProyeccion(!proyeccion)}
        aria-pressed={proyeccion}
        className="vidrio pulsable focus-ring flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
      >
        {/*
          Icono dibujado, no un glifo Unicode ni un emoji: `craft-floor` lo
          prohíbe y Stitch lo resolvió cargando Material Symbols desde Google,
          que aquí no se puede — el punto de acceso del aula puede bloquearlo.
          Un rectángulo con una onda: una pantalla que emite.
        */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 14h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {proyeccion ? 'Salir de proyección' : 'Modo proyección'}
      </button>
    </div>
  )
}
