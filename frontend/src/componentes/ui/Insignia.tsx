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

/*
 * 🔴 LA TRANSICION DE COLOR ES ANTI-PARPADEO, NO ADORNO.
 *
 * Sin ella un cambio de tono es un salto instantaneo. Con 16 baldosas y un hipo
 * de WiFi —que es lo que hace que `msDesdeUltimo` cruce el umbral y vuelva—, el
 * muro entero da un estroboscopio: el sitio donde mas se nota es exactamente
 * donde mas dueles.
 *
 * Los 200 ms de `--t-estado` suavizan ese cruce sin retrasar la lectura.
 *
 * ⚠️ Y transiciona SOLO color, borde y fondo. **Nada de `transform` ni de
 *    opacidad**: el estado no debe moverse ni aparecer, solo cambiar de color.
 *
 * 🔴 Esto NO es «animar la llegada de un dato». `/odom` llega a 16,5 Hz y
 *    animarlo seria un estroboscopio sobre las cifras que alguien esta leyendo
 *    —la puerta de frecuencia de Emil lo prohibe sin matices: «100+ times/day →
 *    No animation. Ever.»—. Un cambio de TONO es raro: pasa cuando el robot
 *    cambia de estado, no cuando llega un mensaje.
 *
 * ⚠️ `prefers-reduced-motion` la CONSERVA a propósito (ver `globals.css`):
 *    reducir movimiento no puede devolver el parpadeo a quien pidió menos.
 */
const TRANSICION = 'transition-[color,background-color,border-color] '
  + 'duration-[var(--t-estado)] ease-[cubic-bezier(0.23,1,0.32,1)]'

export function Insignia({ tono, children, punto = true }: PropsInsignia) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium ${TRANSICION} ${CLASES[tono]}`}
    >
      {punto && (
        <span className={`h-1.5 w-1.5 bg-current ${TRANSICION}`} aria-hidden="true" />
      )}
      {children}
    </span>
  )
}
