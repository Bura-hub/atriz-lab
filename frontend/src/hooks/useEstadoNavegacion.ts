/**
 * `/estado_navegacion` CON SU GUARDIA DE LATIDO, en un solo sitio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTO ES UN HOOK Y NO DOS COPIAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Esta logica vivia dentro de `ControlNavegacion`, y `PanelNavegar` —que esta
 * en la MISMA pantalla— no la tenia. Asi que el panel no podia preguntar si
 * Nav2 estaba levantado y **lo deducia de que llegara `/amcl_pose`**, que es
 * justo lo que la Pi midio que no vale (ver abajo).
 *
 * Duplicar la guardia habria sido peor que compartirla: es la que impide pintar
 * FUNCIONANDO sobre un supervisor muerto, y una copia que se quede atras vuelve
 * a abrir ese agujero en la mitad de la pantalla que la copio mal.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL LATIDO MANDA SOBRE TODO LO DEMAS
 * ═══════════════════════════════════════════════════════════════════════════
 * `/estado_navegacion` va TRANSIENT_LOCAL: el ultimo mensaje se queda ahi
 * aunque el supervisor muera, asi que un enlatado de hace media hora entra como
 * si fuera de ahora. Sin esta guardia la pantalla pintaria FUNCIONANDO sobre un
 * robot que no tiene a nadie detras.
 *
 * Y hay que MIRAR EL RELOJ, no solo reaccionar a los mensajes: si dejan de
 * llegar, el efecto que los escucha no se vuelve a disparar nunca y `avanza` se
 * quedaria en `true` para siempre.
 */

import { useEffect, useRef, useState } from 'react'
import { useTopic, type MensajeEstadoNavegacion } from '@/hooks/useTopic'
import { UMBRAL_LATIDO_NAV_MS } from '@/lib/robot/navegacion'
import type { Transporte } from '@/lib/rosbridge/transporte'

export interface EstadoNavegacionVigente {
  /** El ultimo mensaje, o `null` si no ha llegado ninguno. */
  estado: MensajeEstadoNavegacion | null
  /**
   * Si el `latido` se ha movido hace menos de `UMBRAL_LATIDO_NAV_MS`.
   *
   * ⚠️ **Se pone a `true` ya con el PRIMER mensaje**, que en un topic
   *    TRANSIENT_LOCAL puede ser un enlatado. Lo que cierra ese hueco no es
   *    este efecto sino el reloj de abajo: si no llega otro con `latido` mayor,
   *    vuelve a `false` en cuanto pasa la ventana. O sea que un enlatado da
   *    `true` durante esa ventana y **se desmiente solo** — comportamiento
   *    heredado tal cual de `ControlNavegacion`, no un cambio de esta
   *    extraccion.
   */
  avanza: boolean
}

export function useEstadoNavegacion(transporte: Transporte): EstadoNavegacionVigente {
  const estado = useTopic(transporte, '/estado_navegacion')

  const visto = useRef<{ latido: number; cuando: number } | null>(null)
  const [avanza, setAvanza] = useState(false)

  useEffect(() => {
    if (estado === null) return
    const ahora = Date.now()
    if (visto.current === null || estado.latido > visto.current.latido) {
      visto.current = { latido: estado.latido, cuando: ahora }
      setAvanza(true)
    }
  }, [estado])

  useEffect(() => {
    const t = setInterval(() => {
      const v = visto.current
      setAvanza(v !== null && Date.now() - v.cuando < UMBRAL_LATIDO_NAV_MS)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return { estado, avanza }
}
