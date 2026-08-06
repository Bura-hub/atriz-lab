'use client'

/**
 * PONER LA ODOMETRÍA A CERO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 UN BOTÓN, NO UN FORMULARIO — y eso lo decide el ROBOT, no el diseño
 * ═══════════════════════════════════════════════════════════════════════════
 * `/set_pos_and_yaw` **solo admite (0, 0, 0)**: cualquier otra pose la rechaza
 * con `success=False` y un aviso en el log. Y no es una limitación del driver
 * por pereza — el SDK del RVR no puede fijar una pose arbitraria: tiene
 * `reset_locator_x_and_y()`, que la pone a (0,0), y `reset_yaw()`, que **no hace
 * nada** (el yaw del RVR se pone a cero al ENCENDER el robot, medido).
 *
 * Así que ofrecer tres campos de texto sería pedir algo que el robot va a
 * rechazar, y el alumno leería «no se pudo» sobre una interfaz que le invitó a
 * escribirlo. El driver **rechaza en vez de fingir**; la pantalla no ofrece en
 * vez de invitar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y NO SE CREE EL `success`: MIRA `/odom`
 * ═══════════════════════════════════════════════════════════════════════════
 * `confirmaEfecto('/set_pos_and_yaw')` da `'SOLO_QUE_NO_LANZO'`. Pero aquí, al
 * contrario que con la parada de emergencia, el efecto **se puede ver**: `/odom`
 * va a 16,5 Hz y tras el reinicio tiene que traer posición y rumbo a cero.
 *
 * Se enseña el ANTES y el DESPUÉS, no un «hecho». Un booleano no le dice a nadie
 * qué se ha borrado; «estabas a 0,31 m y −8,5°, ahora a 0,00 m y 0,0°» sí.
 */

import { useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { SIN_DATO, aGrados, grados, horaCorta, metros, yawDeCuaternion } from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { Pose, distanciaAlOrigen, enElOrigen } from '@/lib/robot/origen_odometria'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const SERVICIO = '/set_pos_and_yaw'

/** Cuánto se espera a que `/odom` traiga el cero. A 16,5 Hz sobra de largo. */
const PLAZO_TESTIGO_MS = 4000

interface Resultado {
  hora: string
  antes: Pose | null
  despues: Pose | null
  /** `null` = no se pudo juzgar. Nunca se convierte en «no» por silencio. */
  confirmado: boolean | null
  error: string | null
}

/**
 * Saca la pose de un `/odom` crudo, o `null` si le falta algo.
 *
 * ⚠️ `Transporte.suscribir` entrega `unknown` a propósito, así que la forma se
 *    comprueba aquí campo a campo con `numeroValido` en vez de darla por buena
 *    con una aserción de tipo: un `undefined` comparado contra una tolerancia
 *    produciría un veredicto con pinta de medida.
 */
function poseDe(msg: unknown): Pose | null {
  const m = msg as {
    pose?: {
      pose?: {
        position?: { x?: number; y?: number }
        orientation?: { x?: number; y?: number; z?: number; w?: number }
      }
    }
  }
  const x = numeroValido(m?.pose?.pose?.position?.x)
  const y = numeroValido(m?.pose?.pose?.position?.y)
  const yawRad = yawDeCuaternion(m?.pose?.pose?.orientation)
  if (x === null || y === null || yawRad === null) return null
  return { x, y, yawGrados: aGrados(yawRad) }
}

export function PanelOrigenOdometria() {
  const { transporte, conectado } = useRobot()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const poner = async () => {
    setEnviando(true)
    setResultado(null)
    const hora = horaCorta(Date.now())
    let antes: Pose | null = null
    let cancelar: (() => void) | null = null

    try {
      /*
       * 🔴 SUSCRIBIRSE ANTES DE LLAMAR, igual que al liberar la parada: si el
       *    robot publicara el cero mientras todavía no escucha nadie, el único
       *    testigo se perdería y la pantalla diría «no se pudo comprobar» sobre
       *    un reinicio que sí funcionó.
       */
      const visto: Pose[] = []
      cancelar = transporte.suscribir('/odom', (m) => {
        const p = poseDe(m)
        if (p !== null) visto.push(p)
      })
      // La última muestra anterior a la llamada es el «antes».
      await new Promise((r) => setTimeout(r, 400))
      antes = visto.at(-1) ?? null

      const marca = visto.length
      await transporte.llamar(SERVICIO, {
        position: { x: 0, y: 0, z: 0 },
        yaw: 0,
      })

      // Solo cuentan las muestras POSTERIORES a la llamada.
      const limite = Date.now() + PLAZO_TESTIGO_MS
      let despues: Pose | null = null
      while (Date.now() < limite) {
        const nuevas = visto.slice(marca)
        const buena = nuevas.find(enElOrigen)
        if (buena !== undefined) { despues = buena; break }
        await new Promise((r) => setTimeout(r, 120))
      }
      const ultima = visto.slice(marca).at(-1) ?? null
      setResultado({
        hora,
        antes,
        despues: despues ?? ultima,
        // `null` cuando no llegó ni una muestra posterior: eso es «no se sabe»,
        // que no es lo mismo que «no se reinició».
        confirmado: despues !== null ? true : ultima === null ? null : false,
        error: null,
      })
    } catch (e) {
      setResultado({
        hora, antes, despues: null, confirmado: null,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      cancelar?.()
      setEnviando(false)
    }
  }

  const pose = (p: Pose | null) => (p === null
    ? SIN_DATO
    : `${metros(distanciaAlOrigen(p))} · ${grados(p.yawGrados)}`)

  return (
    <Tarjeta
      titulo="Origen de la odometría"
      subtitulo="Pone posición y rumbo a cero desde donde esté el robot ahora mismo."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { void poner() }}
          disabled={!conectado || enviando}
          aria-busy={enviando}
          className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          {enviando ? 'Esperando a /odom…' : 'Poner a cero'}
        </button>
        {!conectado && (
          <span className="text-[13px] text-muted-foreground">
            Sin enlace no se puede llamar a ningún servicio.
          </span>
        )}
      </div>

      {resultado !== null && (
        <div className="mt-3" role="alert">
          {resultado.error !== null ? (
            <Aviso nivel="ERROR" titulo={`La orden no salió · ${resultado.hora}`}>
              {resultado.error}
            </Aviso>
          ) : resultado.confirmado === true ? (
            <Aviso nivel="NOTA" titulo={`Puesta a cero · ${resultado.hora}`}>
              Y lo confirma <code>/odom</code>: estabas en{' '}
              <strong>{pose(resultado.antes)}</strong> y ahora publica{' '}
              <strong>{pose(resultado.despues)}</strong>.
            </Aviso>
          ) : resultado.confirmado === false ? (
            <Aviso nivel="ATENCION" titulo={`Sin confirmar · ${resultado.hora}`}>
              El servicio contestó, pero <code>/odom</code> siguió publicando{' '}
              <strong>{pose(resultado.despues)}</strong>. Eso no es un silencio: es que el robot
              no ha movido su origen. Mira el robot.
            </Aviso>
          ) : (
            <Aviso nivel="ATENCION" titulo={`No se sabe · ${resultado.hora}`}>
              El servicio contestó y no ha llegado ningún <code>/odom</code> posterior con el que
              juzgar. Desde aquí no se puede decir si se reinició.
            </Aviso>
          )}
        </div>
      )}

      <Contexto>
      <p>
        <strong>Esto no corrige la deriva</strong>, y es la confusión que más importa evitar: mueve
        el origen a donde esté el robot ahora, y el error que se va acumulando después sigue
        acumulándose igual. Si el rumbo se está yendo, poner a cero solo cambia desde dónde se va.
      </p>
      <p>
        Solo se admite el cero. Una pose cualquiera —«ponte en x=2, mirando al este»— el robot la{' '}
        <strong>rechaza</strong> en vez de fingirla: su SDK no sabe fijar una pose, únicamente
        reiniciar el locator. Por eso aquí hay un botón y no tres casillas para escribir.
      </p>
      </Contexto>
    </Tarjeta>
  )
}
