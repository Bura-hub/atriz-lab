/**
 * La pastilla de color de un estado.
 *
 * 🔴 SOLO CUATRO TONOS, Y EL ROJO ES EL MAS CARO: se reserva para un HECHO
 * POSITIVO -atasco confirmado por el firmware, o bateria critica-. La ausencia
 * de datos es AMBAR, nunca roja: con 16 robots cargando a la vez -RVR apagado y
 * Raspberry Pi viva, el estado cotidiano del laboratorio- el rojo pintaria la
 * flota entera, y un muro siempre rojo se ignora.
 */

import { ReactNode } from 'react'

export type TonoInsignia = 'NEUTRO' | 'BIEN' | 'ATENCION' | 'GRAVE'

const CLASES: Readonly<Record<TonoInsignia, string>> = {
  NEUTRO: 'bg-muted text-muted-foreground border-border',
  BIEN: 'bg-success/10 text-success border-success/30',
  ATENCION: 'bg-warning/15 text-warning border-warning/40',
  GRAVE: 'bg-destructive/10 text-destructive border-destructive/40',
}

export interface PropsInsignia {
  tono: TonoInsignia
  children: ReactNode
  /**
   * Una marca delante, para que el estado NO dependa solo del color.
   *
   * 🔴 Y NO PARPADEA, ni parpadeara. Es exactamente el sitio donde tres de las
   *    skills instaladas exigen un pulso infinito
   *    (`stitch-design-taste:95` — «Pulse on status dots»). En una pantalla que
   *    vigila 16 robots que pueden estar mudos, **un punto que late siempre es
   *    indistinguible de un robot que vive siempre**. Hay una prueba que lo
   *    impide (`estilo.test.ts`) y el motivo esta en `CLAUDE.md`.
   */
  punto?: boolean
}

export function Insignia({ tono, children, punto = true }: PropsInsignia) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium ${CLASES[tono]}`}
    >
      {punto && <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}
