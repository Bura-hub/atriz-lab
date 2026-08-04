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
  /** Un punto delante, para que el estado se lea sin depender solo del color. */
  punto?: boolean
}

export function Insignia({ tono, children, punto = true }: PropsInsignia) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CLASES[tono]}`}
    >
      {punto && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}
