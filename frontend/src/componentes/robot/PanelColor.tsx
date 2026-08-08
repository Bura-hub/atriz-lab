'use client'

/**
 * EL SENSOR DE COLOR, y su luz — que ahora se puede encender desde aquí.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ ESTE FICHERO AFIRMABA QUE ESTE BOTÓN NO PODÍA EXISTIR. Era falso.
 * ═══════════════════════════════════════════════════════════════════════════
 * Decía: «no se puede encender desde aquí: con el streaming ya configurado,
 * `enable_color_detection` no hace nada — 481 mensajes de `/color`, todos ceros».
 * Se copió del driver, que lo llevaba marcado «🔴 MEDIDO».
 *
 * **Aquella medida estaba mal hecha:** el servicio bajo prueba **se apagaba a sí
 * mismo dentro de la misma llamada**, así que casi todos aquellos mensajes eran
 * posteriores al `enable(False)`. Una medida que no separa las dos hipótesis no
 * refuta ninguna. Remedido el 2026-08-06 con el streaming corriendo:
 *
 *     /color no-cero :  0 → 53 → 0
 *     canal claro    :  1 → 1320 → 0
 *     RGB reales     :  (255, 224, 208)
 *
 * 📝 La lección de segundo orden, que es la que vale: **una trampa documentada
 *    también caduca**, y venía con el sello de «ya medido» que hizo que nadie la
 *    volviera a mirar en seis días.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL ESTADO SE LEE, NO SE RECUERDA
 * ═══════════════════════════════════════════════════════════════════════════
 * La luz **se apaga sola**: por inactividad (120 s) y por tope duro (900 s). Así
 * que un `useState` que guardara «yo la encendí» pintaría el botón encendido
 * sobre un sensor a oscuras. La verdad es `/estado_robot.color_activo`.
 *
 * ⚠️ Y NO se deduce de que `/color` traiga ceros: **publica igual con la luz
 *    apagada** y un negro de verdad también da valores bajos. El topic dice qué
 *    se ve; el campo, si hay luz para verlo.
 */


import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { SIN_DATO, numero } from '@/lib/interfaz/formato'
import { Dato } from '@/componentes/ui/Dato'
import { MedirColor } from '@/componentes/robot/MedirColor'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { useMuestreo } from './useMuestreo'

/** Cuánto se espera a que `/color` deje de traer ceros. A 13 Hz sobra. */

/** Un canal 0..255 válido, o `null`. */
function canal(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255 ? v : null
}

export function PanelColor() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/color')
  const estado = useTopic(transporte, '/estado_robot')


  const rgb = ultimo?.rgb_color
  const r = canal(rgb?.[0])
  const g = canal(rgb?.[1])
  const b = canal(rgb?.[2])
  // 🔴 La FUENTE DE VERDAD. `null` mientras no llegue `/estado_robot`: no se
  //    inventa un `false`, que se leería como «apagado» sobre algo que no se sabe.
  const luz: boolean | null = estado === null ? null : estado.color_activo === true

  /*
   * 🔴 AQUI VIVIA `conmutar()`, Y SU LECCION SE CONSERVA PORQUE COSTO CARA.
   *
   * Llamaba a `/enable_color` y **esperaba al testigo**: `color_activo` con un
   * `latido` estrictamente mayor, porque `/estado_robot` va TRANSIENT_LOCAL y el
   * primer mensaje que llega puede ser un enlatado ANTERIOR a la orden. Sin esa
   * guarda la pantalla confirmaba con un dato viejo.
   *
   * → Se retiró con el botón duplicado, no porque la idea sobrara. El testigo
   *   **sigue estando**, en `MedirColor`: en vez de esperarlo UNA vez tras
   *   pulsar, se pinta CONTINUAMENTE («el robot confirma la luz apagada, que es
   *   lo que pide este modo»). Es más fuerte, no menos: cubre además el apagado
   *   automático a los 15 minutos, que ocurre sin que nadie pulse nada y que un
   *   testigo de una sola vez no habría visto nunca.
   */

  return (
    <Tarjeta
      titulo="Sensor de color"
      subtitulo="Mira hacia abajo, al suelo. Es el sensor del seguidor de línea."
      pie={ultimo === null ? (
        <p>Todavía no ha llegado ningún <code>/color</code>.</p>
      ) : undefined}
    >
      {/*
        🔴🔴 AQUI HABIA UN SEGUNDO CONTROL DE LA MISMA LUZ, Y SE QUITO EL
             2026-08-08 NADA MAS VERLO EN UNA CAPTURA.

        Era un botón «Encender la luz» al lado del selector de modo del medidor.
        Los dos llaman a `/enable_color`, o sea que **dos controles mandaban sobre
        el mismo estado del robot**: pulsar uno dejaba al otro describiendo algo
        que ya no era cierto, y el alumno con dos versiones de la verdad en la
        misma tarjeta.

        Este proyecto ya tiene la regla escrita para el caso peor —«dos controles
        de parada juntos es la confusión que la franja de seguridad existe para
        evitar»—; aquí no hay peligro, pero la forma es la misma.

        → El modo manda. La luz dejó de ser algo que se enciende y pasó a ser una
          consecuencia de responder «¿qué hay debajo del robot?», que es la
          pregunta que de verdad decide si la medida sale bien o al revés.
      */}
      {/*
        ⚠️ QUE SE APAGA SOLA HAY QUE DECIRLO. Si no, el alumno ve el sensor
           apagarse a mitad de una práctica y concluye que se rompió — y esa
           conclusión es la que esta interfaz existe para evitar.

        🔴 PERO SE DICE EL TOPE DURO, NO EL DE INACTIVIDAD. Una versión anterior
           anunciaba «120 s sin que nadie lea el color», y **con esta pantalla
           abierta eso no ocurre nunca**: estar suscrito a `/color` YA cuenta como
           actividad, que es justamente para lo que se diseñó así. Anunciar un
           plazo que no se va a cumplir enseña a no fiarse del aviso.

           El que sí ignora la actividad, a propósito, es el tope de 15 min. Ese
           salta con la pantalla delante, y sin avisar parecería una avería.
      */}
      {luz === true && (
        <div className="mb-3">
          <Aviso nivel="ATENCION" titulo="Se apagará sola a los 15 minutos">
            Y lo hará <strong>aunque tengas esta pantalla abierta</strong>: es un tope duro, no un
            temporizador de inactividad. No es una avería — la luz es un LED blanco bajo el chasis
            y gasta batería del RVR, que es de donde también se alimenta la Raspberry. Si se apaga
            a mitad de una medida, vuelve a encenderla.
            <br /><br />
            Hay además un apagado por inactividad a los 120 s, pero{' '}
            <strong>mientras esta pantalla esté abierta no se cumple</strong>: leer el color cuenta
            como actividad.
          </Aviso>
        </div>
      )}

      <div className="mb-4">
        <MedirColor />
      </div>

      {/*
        📝 Lo de abajo es el TOPIC, que va a 16 Hz y sirve para ver el sensor
           moverse. El medidor de arriba usa el SERVICIO, que trae además el canal
           claro y funciona en los dos modos. No son redundantes: el topic solo
           dice algo en modo reflejo.
      */}
      <div className="rejilla sm:grid-cols-2 xl:grid-cols-4">
        <Dato etiqueta="Rojo" valor={r === null ? SIN_DATO : numero(r, 0)} crudo={r ?? undefined} />
        <Dato etiqueta="Verde" valor={g === null ? SIN_DATO : numero(g, 0)} crudo={g ?? undefined} />
        <Dato etiqueta="Azul" valor={b === null ? SIN_DATO : numero(b, 0)} crudo={b ?? undefined} />
        {/*
          🔴 LA CONFIANZA ES SIEMPRE 0, Y NO POR FALTA DE CONFIGURACION.
             `get_active_color_palette` devuelve cinco colores cargados y activos:
             vale 0 porque las superficies del laboratorio no se parecen a esos
             cinco, no porque falte nada. Una explicación anterior decía lo
             contrario y era falsa.
        */}
        <Dato
          etiqueta="Confianza"
          valor={ultimo === null ? SIN_DATO : numero(ultimo.confidence, 2)}
          nota="Del clasificador del RVR. Es 0 porque las superficies no se parecen a su paleta."
        />
      </div>


      <Contexto>
      <p>
        El sensor <strong>no ve nada sin su propia luz</strong>: se midió 4 con el LED apagado
        contra 741 encendido, o sea 185 veces. Por eso arranca apagada en los dieciséis robots y
        hay que pedirla.
      </p>
      <p>
        Este topic <strong>no trae el canal claro</strong>, que es el que mejor separa una línea
        de su fondo —recorre 12,6 veces entre negro y blanco, mientras que el color se normaliza
        por el verde—. Sí lo devuelve el servicio <code>get_rgbc_sensor_values</code>, que es el
        que usa el medidor de arriba.
      </p>
      <p>
        🔴 <strong>Y el topic solo dice algo en modo reflejo.</strong> Con la luz apagada lo que
        publica es oscuridad aunque haya una pantalla encendida debajo: para medir una superficie
        luminosa hay que <strong>preguntar por el servicio</strong>, no mirar aquí. Es la trampa
        de ese modo, y está medida.
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
