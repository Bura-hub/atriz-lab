'use client'

/**
 * LEER UN NÚMERO DEL ROBOT, DESDE EL CUADERNO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL DEFECTO Nº8 DE LA AUDITORÍA: «el cuaderno no lee ni un número del robot»
 * ═══════════════════════════════════════════════════════════════════════════
 * El asunto de esta pantalla es **comparar lo que dijo el robot con lo que mide
 * una cinta**, y el campo «dijo el robot» se tecleaba a mano: abrir otra
 * pestaña, leer un número, memorizarlo y volver. Con una cinta métrica en la
 * otra mano.
 *
 * Y la copia a mano no es solo incómoda: **es donde entran los errores que esta
 * pantalla existe para cazar**. Un dígito mal copiado se convierte en una
 * discrepancia robot/persona que no ocurrió.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL SOCKET SE ABRE AL ENTRAR; LA SUSCRIPCIÓN, SOLO AL PEDIRLA
 * ═══════════════════════════════════════════════════════════════════════════
 * Son dos costes distintos y se pagan distinto:
 *
 *   · **El socket** se abre mientras el cuaderno está abierto. Sin suscripciones
 *     no lleva tráfico, y tenerlo listo evita los ~2,7 s de resolución mDNS en
 *     frío justo cuando alguien pulsa «leer» — medido en el navegador.
 *   · **La suscripción** solo existe entre que se pulsa y llega el primer
 *     mensaje. `/odom` son 13,05 kB/s: dejarla puesta mientras se rellena un
 *     formulario sería pagar el topic más caro de los baratos por nada.
 *
 * ⚠️ Y si el robot elegido no es el que está encendido, esto **no dice que esté
 *    averiado**: dice que no llegó. Es la regla de siempre — no saber no es un no.
 */

import { useEffect, useState } from 'react'
import { ProveedorRobot, useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { numeroValido, voltajeDe } from '@/lib/interfaz/lecturas'
import { yawDeCuaternion, aGrados } from '@/lib/interfaz/formato'
import { MAGNITUDES, Magnitud, desplazamientoCm, paraElCampo } from '@/lib/cuaderno/lecturas_robot'

export interface PropsLectura {
  /** El número 1..16. Del selector del formulario. */
  robot: number
  /** Se llama con el valor ya formateado y la unidad. */
  alLeer: (valor: string, magnitud: Magnitud) => void
}

export function LecturaDelRobot({ robot, alLeer }: PropsLectura) {
  return (
    /*
     * 🔴 UN PROVEEDOR POR ROBOT, y la clave lo dice: al cambiar de robot en el
     *    selector, React desmonta este árbol y monta otro. Eso cierra el socket
     *    viejo ANTES de abrir el nuevo, que es la garantía que `ProveedorRobot`
     *    documenta y por la que la conexión vive en el layout del robot y no más
     *    arriba. Sin la clave, el proveedor se reutilizaría con otra URL.
     */
    <ProveedorRobot key={robot} robot={robot}>
      <Boton alLeer={alLeer} />
    </ProveedorRobot>
  )
}

function Boton({ alLeer }: { alLeer: PropsLectura['alLeer'] }) {
  const { conectado } = useRobot()
  const [pidiendo, setPidiendo] = useState<Magnitud | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  /*
   * 🔴 UN PLAZO, Y NO SOLO POR COMODIDAD. Sin él, pedir una lectura a un robot
   *    apagado deja el botón en «leyendo…» para siempre — el mismo perfil de
   *    fallo que este proyecto persigue: algo que se cuelga es peor que algo que
   *    falla, porque no hay nada que reintentar ni nada que enseñar.
   *
   * ⚠️ 6 s: `/odom` llega a 16,5 Hz y `/battery_state` cada 30,0 s exactos, así
   *    que el voltaje puede tardar de verdad. Se dice en el aviso en vez de
   *    fingir que el robot no contesta.
   */
  useEffect(() => {
    if (pidiendo === null) return
    const t = setTimeout(() => {
      setPidiendo(null)
      setFallo('No llegó ningún dato. El robot puede estar apagado, o cargando con la Raspberry Pi '
        + 'encendida — que es el estado más común del laboratorio y no es una avería.')
    }, 6000)
    return () => clearTimeout(t)
  }, [pidiendo])

  const recibir = (valor: number | null, m: Magnitud) => {
    const texto = paraElCampo(valor)
    setPidiendo(null)
    if (texto === null) {
      // Un `NaN` que llega NO es lo mismo que nada: se dice cuál de los dos es.
      setFallo('El robot mandó el dato, pero no es un número válido.')
      return
    }
    setFallo(null)
    alLeer(texto, m)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="microetiqueta shrink-0">leer del robot</span>
        {(Object.keys(MAGNITUDES) as Magnitud[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!conectado || pidiendo !== null}
            onClick={() => { setFallo(null); setPidiendo(m) }}
            title={MAGNITUDES[m].contra}
            className="rounded-none border border-border bg-secondary px-3 py-1.5 text-[13px] text-secondary-foreground focus-ring hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
          >
            {pidiendo === m ? 'leyendo…' : MAGNITUDES[m].que}
          </button>
        ))}
      </div>

      {!conectado && (
        <p className="text-[12px] leading-snug text-muted-foreground">
          Sin conexión con ese robot. <strong>No dice que esté averiado</strong>: dice que no se
          llega a él — puede estar apagado, o ser otro el que está encendido.
        </p>
      )}

      {fallo !== null && (
        <p className="text-[12px] leading-snug text-muted-foreground">{fallo}</p>
      )}

      {/*
        🔴 LA SUSCRIPCIÓN SOLO EXISTE MIENTRAS SE PIDE. Este hijo se monta al
           pulsar y se desmonta con el primer dato: `useTopic` se da de baja al
           desmontar, así que `/odom` —13,05 kB/s— no se queda puesto mientras
           alguien rellena un formulario.
      */}
      {pidiendo !== null && <Sonda magnitud={pidiendo} alValor={recibir} />}
    </div>
  )
}

function Sonda({
  magnitud, alValor,
}: {
  magnitud: Magnitud
  alValor: (v: number | null, m: Magnitud) => void
}) {
  const { transporte } = useRobot()
  const deBateria = magnitud === 'VOLTAJE'
  /*
   * 🔴 UN SOLO `useTopic`, con el topic elegido. Los hooks no se pueden llamar
   *    dentro de un `if`, pero SÍ se le puede pasar un argumento distinto — y
   *    llamar a dos habría abierto **las dos suscripciones**, o sea `/odom` a
   *    13,05 kB/s incluso para leer un voltaje. La sonda se remonta al cambiar
   *    de magnitud porque el padre la monta y desmonta con cada petición.
   */
  const mensaje = useTopic(transporte, deBateria ? '/battery_state' : '/odom')

  useEffect(() => {
    if (mensaje === null) return
    if (deBateria) {
      // El estrechamiento sale del propio topic: con `/battery_state`, `useTopic`
      // devuelve la lectura de batería. La aserción dice eso y nada más.
      alValor(voltajeDe(mensaje as Parameters<typeof voltajeDe>[0]), magnitud)
      return
    }
    const p = (mensaje as {
      pose?: { pose?: { position?: { x?: number; y?: number }; orientation?: unknown } }
    }).pose?.pose
    const pos = p?.position
    if (magnitud === 'DESPLAZAMIENTO') {
      alValor(desplazamientoCm({
        x: numeroValido(pos?.x) ?? NaN,
        y: numeroValido(pos?.y) ?? NaN,
        yaw: 0,
      }), magnitud)
      return
    }
    /*
     * 🔴 `yawDeCuaternion` YA DEVUELVE `null` si algún componente no es finito, y
     *    ese `null` NO se convierte en cero: un rumbo de 0° es una lectura, y
     *    «no llegó» no lo es. Es la misma distinción que `paraElCampo` hace un
     *    paso más abajo.
     */
    const rad = yawDeCuaternion(p?.orientation as Parameters<typeof yawDeCuaternion>[0])
    alValor(rad === null ? null : aGrados(rad), magnitud)
  }, [mensaje, deBateria, magnitud, alValor])

  return null
}
