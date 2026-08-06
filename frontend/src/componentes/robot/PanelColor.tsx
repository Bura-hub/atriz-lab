'use client'

/**
 * EL SENSOR DE COLOR. Y es, sobre todo, una pantalla que sabe reconocer que no
 * está viendo nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EN LOS 16 ROBOTS, ESTE TOPIC PUBLICA CEROS POR DEFECTO
 * ═══════════════════════════════════════════════════════════════════════════
 * El sensor **no da nada sin su luz**: medido, el canal claro vale 4 con el LED
 * apagado contra 741 encendido —185×—. Y el driver solo la enciende si arranca
 * con `color_detection:=true`, que es `false` por defecto porque deja un LED
 * blanco encendido bajo el chasis.
 *
 * Medido en rvr-01 hoy: `/color` llega a **13,1 Hz** con
 * `{"rgb_color":[0,0,0],"confidence":0}`. O sea el topic vivo, puntual, y sin un
 * solo dato. Es exactamente la familia de fallo de este proyecto —algo que
 * parece sano y está mudo—, y una pantalla que pintara ese `[0,0,0]` como una
 * lectura estaría diciendo «el suelo es negro» sobre un sensor apagado.
 *
 * → Por eso lo primero que hace esta tarjeta es **distinguir «apagado» de
 *   «negro»**, y decirlo.
 *
 * ⚠️ Y NO se puede encender desde aquí. Medido el 2026-07-31: con el streaming
 *    ya configurado, `enable_color_detection` **no hace nada**. Hay que
 *    encenderlo ANTES de registrar el manejador, o sea al arrancar el driver.
 *    Ningún botón de esta interfaz puede arreglarlo, así que no se ofrece uno.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LO QUE ESTE TOPIC **NO** TRAE
 * ═══════════════════════════════════════════════════════════════════════════
 * `Color.msg` son `int32[] rgb_color` y `float32 confidence`. **El canal `clear`
 * no viaja**, y es justo el que mejor discrimina: recorre 12,6× entre negro
 * (181) y blanco (2288), mientras que el color se normaliza por G. Quien quiera
 * seguir una línea con esto tiene menos señal de la que caracterizó el robot.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { SIN_DATO, numero } from '@/lib/interfaz/formato'
import { Dato } from '@/componentes/ui/Dato'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { useMuestreo } from './useMuestreo'

/** Un canal 0..255 válido, o `null`. */
function canal(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255 ? v : null
}

export function PanelColor() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/color')

  const rgb = ultimo?.rgb_color
  const r = canal(rgb?.[0])
  const g = canal(rgb?.[1])
  const b = canal(rgb?.[2])
  const hay = r !== null && g !== null && b !== null
  /*
   * 🔴 «TODO A CERO» NO ES LO MISMO QUE «NEGRO», y esta es la distinción entera.
   *    Un negro de verdad devuelve valores pequeños pero **no exactamente
   *    cero** —el canal claro daba 181 sobre negro, no 0—. Tres ceros clavados,
   *    repetidos, son la firma de un sensor sin luz.
   *
   * ⚠️ No es una prueba, es una firma: por eso el aviso dice «casi siempre
   *    significa», no «significa».
   */
  const apagado = hay && r === 0 && g === 0 && b === 0

  return (
    <Tarjeta
      titulo="Sensor de color"
      subtitulo="Mira hacia abajo, al suelo. Es el sensor del seguidor de línea."
      pie={ultimo === null ? (
        <p>Todavía no ha llegado ningún <code>/color</code>.</p>
      ) : undefined}
    >
      {apagado && (
        <div className="mb-3">
          <Aviso nivel="ATENCION" titulo="El sensor está apagado, no viendo negro">
            Llegan <code>[0, 0, 0]</code> exactos. En este montaje eso casi siempre significa que el
            driver arrancó <strong>sin</strong> <code>color_detection</code>, no que la superficie
            sea negra —un negro de verdad da valores pequeños pero no cero—. El sensor{' '}
            <strong>no ve nada sin su propia luz</strong>: 4 con el LED apagado contra 741
            encendido. Y <strong>no se puede encender desde aquí</strong>: hay que arrancar el
            driver con <code>color_detection:=true</code>.
          </Aviso>
        </div>
      )}

      <div className="rejilla sm:grid-cols-2 xl:grid-cols-4">
        <Dato etiqueta="Rojo" valor={r === null ? SIN_DATO : numero(r, 0)} crudo={r ?? undefined} />
        <Dato etiqueta="Verde" valor={g === null ? SIN_DATO : numero(g, 0)} crudo={g ?? undefined} />
        <Dato etiqueta="Azul" valor={b === null ? SIN_DATO : numero(b, 0)} crudo={b ?? undefined} />
        {/*
          🔴 LA CONFIANZA ES SIEMPRE 0, Y NO POR FALTA DE CONFIGURACION. Se
             comprobó: `get_active_color_palette` devuelve **cinco colores
             cargados y activos**. Vale 0 porque las superficies del laboratorio
             —suelo, blanco, rojo, azul, negro— no se parecen a esos cinco, no
             porque falte nada por configurar. Una versión anterior de esta
             explicación decía lo contrario y era falsa.
        */}
        <Dato
          etiqueta="Confianza"
          valor={ultimo === null ? SIN_DATO : numero(ultimo.confidence, 2)}
          nota="Del clasificador del RVR. Es 0 porque las superficies no se parecen a su paleta."
        />
      </div>

      <Contexto>
      <p>
        Este topic <strong>no trae el canal claro</strong>, que es el que mejor separa una línea de
        su fondo: recorre 12,6 veces entre negro y blanco, mientras que el color se normaliza por
        el verde. El mensaje del robot solo lleva los tres canales y la confianza, así que desde
        aquí se ve menos de lo que el sensor sabe.
      </p>
      <p>
        Y un solo sensor mirando hacia abajo <strong>no puede saber hacia qué lado se desvió el
        robot</strong>: si se va a un lado deja de ver la línea, y si se va al otro pasa
        exactamente lo mismo. Por eso el seguidor del laboratorio persigue un borde y arrastra el
        sentido del giro entre vueltas, en vez de deducirlo de la lectura.
      </p>
      </Contexto>
    </Tarjeta>
  )
}
