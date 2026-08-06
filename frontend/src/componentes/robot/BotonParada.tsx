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
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { PARADA_ACTIVA, PARADA_ENVIADA, PARADA_NO_ENVIADA } from '@/lib/interfaz/lenguaje'
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
  const { transporte } = useRobot()

  // 🔴 EL TESTIGO DEL ROBOT. Hasta el 2026-08-04 esto no existia y esta pantalla
  //    solo podia decir «parada enviada». Ahora el driver publica su bandera y
  //    el flanco false->true se presencio con el robot en marcha, desde los dos
  //    lados a la vez (evidencia 71). Cuesta ~0,03 kB/s.
  //
  // ⚠️ `null` es «NO SE SABE», nunca «no esta puesta». Si `/estado_robot` no
  //    llega -driver anterior a esa fecha, o enlace caido- la pantalla se queda
  //    en «enviada», que es lo unico cierto. El silencio no es un no.
  const estado = useTopic(transporte, '/estado_robot')
  const paradaPuesta: boolean | null = estado === null ? null : estado.parada_emergencia

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
      {/* 🔴 Se ve SIN haber pulsado: si alguien llega a esta pantalla con la
          parada ya puesta -por otra pestaña, o por la sesion anterior-, tiene
          que saberlo antes de intentar conducir y creer que el robot no obedece. */}
      {paradaPuesta === true && (
        <p
          role="status"
          className="rounded-md border border-destructive/60 bg-destructive/15 px-3 py-2 text-sm font-semibold"
        >
          🔴 {PARADA_ACTIVA} — el robot no aceptará ninguna orden de movimiento hasta que se libere
          presencialmente.
        </p>
      )}

      <button
        type="button"
        onClick={pulsar}
        // 🔴 Un borde de 4 px en vez de `shadow-lg`. La sombra sugería relieve
        //    —profundidad que no es información— y este botón no necesita
        //    parecer que sobresale: necesita ser el elemento más inequívoco de
        //    la pantalla, y eso lo dan el tamaño, el color reservado y el marco.
        className={
          // `py-4` y no `py-6`: el rotulo cae en DOS lineas en la columna de la
          // franja, asi que con el relleno de antes el bloque medía 165 px de
          // alto. Sigue siendo con diferencia el elemento mas grande y el unico
          // en rojo — que es lo que tiene que ser.
          // `rounded-md`: era la unica superficie de esquina viva de la
          // aplicacion, y encima la mas grande. La forma tambien es vocabulario.
          'w-full rounded-md border-4 border-destructive bg-destructive px-6 py-4 text-2xl font-bold '
          + 'uppercase tracking-wide text-destructive-foreground transition-transform focus-ring '
          + 'active:scale-[0.99] hover:brightness-110'
        }
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
              {paradaPuesta === true ? (
                <>
                  Y el robot lo confirma: su bandera de parada está puesta. Para liberarla hay que
                  hacerlo <strong>presencialmente</strong>, con el robot delante.
                </>
              ) : paradaPuesta === false ? (
                <>
                  ⚠️ El mensaje salió, pero el robot <strong>sigue diciendo que su bandera no está
                  puesta</strong>. Puede ser que aún no haya llegado, o que no la haya aplicado —{' '}
                  <strong>mira el robot</strong>.
                </>
              ) : (
                <>
                  Esto es lo que sabe el navegador: que el mensaje salió. No está llegando{' '}
                  <code>/estado_robot</code>, así que desde aquí <strong>no se sabe</strong> si la
                  parada se aplicó — <strong>mira el robot</strong>.
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/*
        🔴 PLEGADO, Y EL BOTON NO. Estas cuatro lineas estaban SIEMPRE abiertas
           bajo el boton, en las seis pestañas del robot. El resultado, visto en
           captura: la cabecera de cada pantalla medía 270 px y lo mas ruidoso de
           toda la aplicacion era un parrafo explicando por que NO hay un boton
           — con el robot en reposo y sin nada que mal.

           Lo que se pliega es la EXPLICACION. El boton se queda exactamente
           igual: mismo tamaño, mismo rojo reservado, mismo marco de 4 px y a un
           solo clic. Una parada que ha fallado cinco veces en silencio no se
           esconde ni se encoge; lo que sobra es la prosa de al lado.

        📝 Y va abierto por defecto la primera vez que importa: si la parada
           esta puesta, el aviso rojo de arriba ya lo dice sin desplegar nada.
      */}
      <details className="group">
        {/* La `.microetiqueta` va en el propio `summary`, no en un `span` de
            dentro: esa clase fija su color, asi que desde fuera el `hover` no
            la alcanzaria y el desplegable no daria ni una señal de ser
            pulsable. */}
        <summary className="microetiqueta focus-ring cursor-pointer list-none transition-colors duration-[var(--t-estado)] hover:text-foreground">
          ▸ por qué no hay botón para liberarla
        </summary>
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Para quitarla hay que ir hasta el robot: se libera con{' '}
          <code>/release_emergency_stop</code> en el propio laboratorio, y esta interfaz no ofrece
          ese botón a propósito. Al liberarla con un objetivo de Nav2 vivo el robot arrancó solo
          —34,7 cm medidos— porque el controlador nunca había dejado de publicar.
        </p>
      </details>
    </div>
  )
}
