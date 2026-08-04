'use client'

/**
 * Una suscripcion a un topic de la que salen DOS cosas: el ultimo mensaje y la
 * contabilidad de llegadas. Se lee MUESTREADA, no en cada mensaje.
 *
 * ⚠️ POR QUE NO ES `useTopic`, Y POR QUE NO VIVE EN `src/hooks/`:
 *
 * `useTopic` hace `setMensaje` en cada llegada. Para `/battery_state` (cada
 * 30,0 s) y `/motor_status` (1 Hz) eso esta bien y es lo que se usa. Para
 * `/odom` y `/encoders` -16,5 Hz- significa **16,5 re-renders por segundo**, y
 * ademas un numero que parpadea 16 veces por segundo **no se puede leer**: la
 * pantalla de telemetria existe para mirarla.
 *
 * Aqui la llegada solo toca una `ref` -sin re-render-, y el re-render lo impone
 * `useLatido()` cada 500 ms. Es exactamente el mismo patron de MUESTREO que ya
 * usa `useTransporte` para el estado del socket, y por el mismo motivo: no hay
 * ningun evento al que engancharse.
 *
 * 🔴 Y `src/hooks/` NO se toca -esta probado y el encargo lo prohibe-, asi que
 * este hook vive con los componentes. Lo que tiene de logica (`acumularLlegada`,
 * `ritmoObservado`) esta en `lib/interfaz/llegadas.ts`, que SI se prueba en Node.
 * La suscripcion la hace `suscribirTopic()`, que es el codigo ya probado de la
 * capa 1: aqui no se habla con el `Transporte` a mano.
 */

import { useEffect, useRef } from 'react'
import { MensajesPorTopic, TopicModelado, suscribirTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { Transporte } from '@/lib/rosbridge/transporte'
import { LLEGADAS_VACIAS, Llegadas, acumularLlegada } from '@/lib/interfaz/llegadas'

export interface Muestreo<K extends TopicModelado> {
  /** `null` hasta el primer mensaje. `null` NO es «no hay dato bueno». */
  ultimo: MensajesPorTopic[K] | null
  llegadas: Llegadas
}

export function useMuestreo<K extends TopicModelado>(
  transporte: Transporte,
  topic: K,
): Muestreo<K> {
  const caja = useRef<Muestreo<K>>({ ultimo: null, llegadas: LLEGADAS_VACIAS })

  useEffect(() => {
    // Al cambiar de robot o de topic, lo anterior deja de valer: si no se
    // reinicia, el contador de llegadas del robot viejo se sumaria al nuevo y el
    // ritmo observado saldria inventado.
    caja.current = { ultimo: null, llegadas: LLEGADAS_VACIAS }
    return suscribirTopic(transporte, topic, (m) => {
      caja.current = {
        ultimo: m,
        llegadas: acumularLlegada(caja.current.llegadas, Date.now()),
      }
    })
  }, [transporte, topic])

  // El re-render lo trae el latido; aqui solo se lee la caja.
  useLatido()
  return caja.current
}
