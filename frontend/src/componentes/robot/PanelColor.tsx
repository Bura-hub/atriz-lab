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

import { useCallback, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { SIN_DATO, horaCorta, numero } from '@/lib/interfaz/formato'
import { Dato } from '@/componentes/ui/Dato'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { useMuestreo } from './useMuestreo'

const SERVICIO = '/enable_color'
/** Cuánto se espera a que `/color` deje de traer ceros. A 13 Hz sobra. */
const PLAZO_TESTIGO_MS = 4000

/** Un canal 0..255 válido, o `null`. */
function canal(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255 ? v : null
}

export function PanelColor() {
  const { transporte, conectado } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/color')
  const estado = useTopic(transporte, '/estado_robot')

  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ hora: string; texto: string; malo: boolean } | null>(null)

  const rgb = ultimo?.rgb_color
  const r = canal(rgb?.[0])
  const g = canal(rgb?.[1])
  const b = canal(rgb?.[2])
  // 🔴 La FUENTE DE VERDAD. `null` mientras no llegue `/estado_robot`: no se
  //    inventa un `false`, que se leería como «apagado» sobre algo que no se sabe.
  const luz: boolean | null = estado === null ? null : estado.color_activo === true

  const conmutar = useCallback(async (encender: boolean) => {
    setEnviando(true)
    setResultado(null)
    const hora = horaCorta(Date.now())
    let cancelar: (() => void) | null = null
    try {
      /*
       * ═══════════════════════════════════════════════════════════════════════
       * 🔴 EL TESTIGO ES `color_activo`, **NO** QUE `/color` DEJE DE SER CERO.
       * ═══════════════════════════════════════════════════════════════════════
       * La primera versión de esto esperaba a que `/color` trajera algún canal
       * distinto de cero. **Sobre una superficie muy oscura eso puede no llegar
       * nunca**, y entonces el botón diría «no se encendió» con el LED
       * encendido: un falso negativo, y del peor tipo — deja al alumno buscando
       * una avería mientras gasta batería.
       *
       * ⏳ Y no hay número que lo acote: **no está medido** cuánto da `/color`
       *    sobre negro con la luz puesta. Lo único medido es el canal claro
       *    —181 sobre negro contra 2288 sobre blanco—, que este topic no trae.
       *
       * `color_activo` es exacto en los dos sentidos y no depende de lo que haya
       * debajo del robot. `/color` se queda como refuerzo visual, en la rejilla.
       *
       * 🔴🔴 Y `/estado_robot` VA LATCHEADO (`TRANSIENT_LOCAL`), así que el
       *      primer mensaje que llegue puede ser un enlatado **anterior** a la
       *      llamada. Se usa la misma guardia que al liberar la parada: el
       *      primero solo sirve de REFERENCIA, y cuenta uno con `latido`
       *      estrictamente mayor.
       */
      let visto = false
      let referencia: number | null = null
      cancelar = transporte.suscribir('/estado_robot', (m) => {
        const e = m as { latido?: unknown; color_activo?: unknown }
        if (typeof e.latido !== 'number' || typeof e.color_activo !== 'boolean') return
        if (referencia === null) { referencia = e.latido; return }
        if (e.latido <= referencia) return
        if (e.color_activo === encender) visto = true
      })

      await transporte.llamar(SERVICIO, { data: encender })

      const limite = Date.now() + PLAZO_TESTIGO_MS
      while (!visto && Date.now() < limite) await new Promise((s) => setTimeout(s, 120))

      setResultado(visto
        ? {
          hora,
          texto: encender
            ? 'Y lo confirma el robot: su bandera color_activo ha subido en un mensaje posterior a la orden.'
            : 'Y lo confirma el robot: color_activo ha bajado.',
          malo: false,
        }
        : {
          hora,
          texto: 'El servicio contestó, pero el robot no ha confirmado el cambio en 4 s. '
            + 'Puede que no haya llegado ningún /estado_robot posterior, o que la luz siga como '
            + 'estaba. Desde aquí no se distinguen: mira el robot.',
          malo: true,
        })
    } catch (e) {
      // 🔴 Se PINTA. La orden no salió, y quien pulsó tiene que enterarse.
      setResultado({ hora, texto: e instanceof Error ? e.message : String(e), malo: true })
    } finally {
      cancelar?.()
      setEnviando(false)
    }
  }, [transporte])

  return (
    <Tarjeta
      titulo="Sensor de color"
      subtitulo="Mira hacia abajo, al suelo. Es el sensor del seguidor de línea."
      pie={ultimo === null ? (
        <p>Todavía no ha llegado ningún <code>/color</code>.</p>
      ) : undefined}
    >
      {/* ── El interruptor ─────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { void conmutar(luz !== true) }}
          disabled={!conectado || enviando || luz === null}
          aria-busy={enviando}
          className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          {enviando
            ? 'Esperando al sensor…'
            : luz === true ? 'Apagar la luz' : 'Encender la luz'}
        </button>
        <span className="text-[13px] text-muted-foreground">
          {luz === null
            ? 'No llega /estado_robot: desde aquí no se sabe si hay luz.'
            : luz
              ? 'La luz está encendida.'
              : 'La luz está apagada, y sin ella el sensor no ve nada.'}
        </span>
      </div>

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

      {resultado !== null && (
        <div className="mt-3" role="alert">
          <Aviso
            nivel={resultado.malo ? 'ERROR' : 'NOTA'}
            titulo={`${resultado.malo ? 'Sin confirmar' : 'Hecho'} · ${resultado.hora}`}
          >
            {resultado.texto}
          </Aviso>
        </div>
      )}

      <Contexto>
      <p>
        El sensor <strong>no ve nada sin su propia luz</strong>: se midió 4 con el LED apagado
        contra 741 encendido, o sea 185 veces. Por eso arranca apagada en los dieciséis robots y
        hay que pedirla.
      </p>
      <p>
        Este topic <strong>no trae el canal claro</strong>, que es el que mejor separa una línea
        de su fondo —recorre 12,6 veces entre negro y blanco, mientras que el color se normaliza
        por el verde—. Sí lo devuelve el servicio <code>get_rgbc_sensor_values</code>, que esta
        pantalla todavía no usa.
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
