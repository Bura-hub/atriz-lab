'use client'

/**
 * EL CONTROL QUE NO PUEDE FALLAR EN SILENCIO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LA PARADA DE ESTE PROYECTO HA FALLADO CINCO VECES, Y SIEMPRE CALLADA
 * ═══════════════════════════════════════════════════════════════════════════
 *   1. nombre de topic distinto, en ROS 1
 *   2. un `/rvr/` de namespace colado al portar
 *   3. QoS incompatible: `TRANSIENT_LOCAL` en el suscriptor
 *   4. no cancelaba el objetivo de Nav2, y al LIBERARLA el robot arranco solo
 *   5. `rclpy.init()` invalidaba su propio contexto antes de poder publicar
 *
 * Las cinco daban `200 OK` o su equivalente. Por eso este boton solo dice DOS
 * cosas, y las dos son hechos del navegador:
 *
 *   · **«{PARADA_ENVIADA}»** -> `publicar()` no lanzo: el mensaje salio por el
 *     WebSocket. NO dice que el driver lo recibiera ni que el robot este parado.
 *   · **«{PARADA_NO_ENVIADA}»** -> `publicar()` lanzo. `Transporte.publicar()`
 *     lanza a proposito cuando no hay enlace, porque antes hacia no-op EN
 *     SILENCIO y por ahi pasaba justo esto.
 *
 * 🔴 Y LO QUE NUNCA DICE: que la parada este puesta. El driver **no publica su
 * bandera de parada** -7 publicadores y ninguno es ese-, asi que afirmarlo seria
 * una suposicion sobre el unico control donde una suposicion no vale.
 *
 * 🔴 NO HAY BOTON DE LIBERAR, Y NO ES UN OLVIDO. `Teleoperacion` no tiene metodo
 * para eso, a proposito: al liberar la parada con un objetivo de Nav2 vivo el
 * robot **arranco solo** -34,7 cm medidos, contra 0,0 con el arreglo-, porque el
 * `controller_server` nunca dejo de publicar. Liberar es un acto presencial, con
 * el robot delante.
 */

import { useState } from 'react'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { PARADA_ENVIADA, PARADA_NO_ENVIADA } from '@/lib/interfaz/lenguaje'
import { horaCorta } from '@/lib/interfaz/formato'

interface Resultado {
  salio: boolean
  detalle: string
  hora: string
}

export interface PropsBotonParada {
  /**
   * 🔴 La teleoperacion se recibe, no se crea aqui. `useTeleoperacion()` crea una
   * instancia con su propio bucle de 10 Hz: dos componentes llamandolo serian dos
   * bucles publicando `cmd_vel_raw` a la vez. La pantalla que conduce es la dueña.
   */
  teleoperacion: ControlTeleoperacion
}

export function BotonParada({ teleoperacion }: PropsBotonParada) {
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const pulsar = () => {
    const hora = horaCorta(Date.now())
    try {
      teleoperacion.paradaEmergencia()
      setResultado({
        salio: true,
        detalle:
          'el mensaje salió por el WebSocket. El driver descarta todo cmd_vel mientras la tenga puesta.',
        hora,
      })
    } catch (error) {
      // 🔴 Se PINTA. Quien pulsó tiene que enterarse de que no salió, para poder
      //    decírselo a quien está en el aula con el robot delante.
      setResultado({
        salio: false,
        detalle: error instanceof Error ? error.message : String(error),
        hora,
      })
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pulsar}
        className="w-full rounded-lg bg-destructive px-6 py-6 text-2xl font-bold uppercase tracking-wide text-destructive-foreground shadow-lg transition-transform focus-ring active:scale-[0.99] hover:brightness-110"
      >
        Parada de emergencia
      </button>

      {resultado !== null && (
        <div
          role="alert"
          className={`rounded-md border px-3 py-2 text-sm ${
            resultado.salio
              ? 'border-warning/40 bg-warning/10'
              : 'border-destructive/60 bg-destructive/15'
          }`}
        >
          <p className="font-semibold">
            {resultado.salio ? PARADA_ENVIADA : PARADA_NO_ENVIADA} · {resultado.hora}
          </p>
          <p className="text-muted-foreground max-w-prose">{resultado.detalle}</p>
          {resultado.salio && (
            <p className="text-muted-foreground max-w-prose mt-1">
              Esto es lo que sabe el navegador: que el mensaje salió. El robot no publica ninguna
              señal de vuelta que permita comprobarlo desde aquí, así que{' '}
              <strong>mira el robot</strong>.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-prose">
        Para quitarla hay que ir hasta el robot: se libera con{' '}
        <code>/release_emergency_stop</code> en el propio laboratorio, y esta interfaz no ofrece ese
        botón a propósito. Al liberarla con un objetivo de Nav2 vivo el robot arrancó solo —34,7 cm
        medidos— porque el controlador nunca había dejado de publicar.
      </p>
    </div>
  )
}
