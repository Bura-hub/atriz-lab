'use client'

/**
 * El hook que POSEE el `Transporte` de un robot: lo crea, lo conecta al montar
 * y lo cierra al desmontar. Un WebSocket por robot -al robot lo identifica la
 * CONEXION, no un namespace-, asi que un muro de 16 baldosas monta 16 de estos.
 *
 * 🔴 EL HOOK SOLO OBSERVA. No reconecta, no reintenta, no decide nada del
 * enlace: eso es del `Transporte`, que ya tiene su espera creciente probada.
 * Reconectar de forma SINCRONA desde el oyente de `alCerrarse` esta medido en
 * este proyecto y crea CUATRO sockets -el `onclose` del viejo llega tarde,
 * anula el nuevo, y la cascada se realimenta. Ver el comentario de
 * `montarTransporte`.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ProveedorTestigo } from '@/lib/rosbridge/proveedor_testigo'
import { Aviso, Transporte } from '../lib/rosbridge/transporte'

/**
 * Cada cuanto se MUESTREA el estado del enlace.
 *
 * ⚠️ Y hay que decir por que se muestrea en vez de escucharse: `Transporte`
 * tiene `alCerrarse()` pero **no tiene `alAbrirse()`**, asi que no hay ningun
 * evento que avise de que el socket ya esta OPEN. Añadirselo seria tocar
 * `src/lib/rosbridge/`, que no se toca. La consecuencia medible es que el
 * indicador de «conectado» puede ir hasta medio segundo por detras de la
 * realidad al CONECTAR; al DESCONECTAR no, porque ahi si hay evento.
 *
 * 500 ms deja el retraso muy por debajo del `UMBRAL_SILENCIO_MS` (3000) con el
 * que `salud.ts` decide si un robot esta mudo, asi que no puede invertir un
 * veredicto de salud.
 */
export const PERIODO_MUESTREO_MS = 500

export type FabricaWS = (url: string) => WebSocket

export interface OyentesTransporte {
  /** Se llama cuando el enlace se cae. NO reconectes desde aqui. */
  alCerrarse: () => void
  alAviso: (a: Aviso) => void
}

export interface EstadoTransporte {
  transporte: Transporte
  /** Muestreado cada `PERIODO_MUESTREO_MS`. Ver el comentario de la constante. */
  conectado: boolean
  ultimoAviso: Aviso | null
}

/**
 * EL CUERPO DEL EFECTO, sin React: engancha los oyentes, conecta, y devuelve la
 * limpieza. Es una funcion pura de efectos sobre el `Transporte`, asi que se
 * puede probar en Node -y es donde vive todo lo que puede salir mal.
 *
 * 🔴 Lo que este codigo NO hace, y es lo importante: dentro de `alCerrarse` no
 * llama a `conectar()`. Solo avisa a quien monto el efecto. Si hace falta
 * reconexion automatica se le pide al `Transporte` (`{ reconectar: true }`),
 * que la hace con espera creciente y cancelando su propio temporizador.
 *
 * 🔴 Y la limpieza CIERRA. Un `Transporte` que sobrevive al desmontaje sigue
 * suscrito -`/scan` es el 83 % del trafico de un robot- y sigue reconectandose
 * solo, para siempre, sin nadie mirando.
 */
export function montarTransporte(transporte: Transporte, oyentes: OyentesTransporte): () => void {
  const bajaCierre = transporte.alCerrarse(oyentes.alCerrarse)
  const bajaAviso = transporte.alAviso(oyentes.alAviso)
  transporte.conectar()   // IDEMPOTENTE: un segundo montaje no crea otro socket
  return () => {
    bajaCierre()
    bajaAviso()
    transporte.cerrar()
  }
}

/**
 * Un contador que sube cada `periodoMs`. Es lo que obliga a re-evaluar lo que
 * no tiene evento: el estado del socket y el tiempo transcurrido desde la
 * ultima llegada.
 *
 * ⚠️ Devolver el contador y no un valor derivado es deliberado: quien lo use
 * decide QUE mira en cada tic, y puede evitar el re-render si el valor no ha
 * cambiado. Con 16 baldosas, un re-render incondicional cada 500 ms es caro y
 * no aporta nada.
 */
export function useLatido(periodoMs: number = PERIODO_MUESTREO_MS): number {
  const [tic, setTic] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTic((n) => n + 1), periodoMs)
    return () => clearInterval(id)
  }, [periodoMs])
  return tic
}

/**
 * `fabrica` existe para las pruebas y para nada mas: en el navegador se deja
 * sin pasar y el `Transporte` usa `new WebSocket(url)`.
 *
 * 📝 `useMemo` para crear el `Transporte` es seguro aunque React pueda
 * descartar un memo: si la identidad del `Transporte` cambia, el efecto de
 * abajo -que depende de el- corre su limpieza sobre el ANTERIOR (lo tiene
 * capturado en el cierre) y lo cierra antes de montar el nuevo.
 */
export function useTransporte(
  url: string,
  fabrica?: FabricaWS,
  /*
   * 🆕 FASE B (A7): de donde sale el testigo, si este despliegue lo usa.
   *
   * ⚠️ TIENE QUE SER ESTABLE. Va en las dependencias del `useMemo`, asi que una
   *    funcion nueva en cada render recrearia el `Transporte` —y con el, el
   *    socket— en cada pintada. Quien lo pasa lo memoriza (`ContextoRobot`).
   */
  testigo?: ProveedorTestigo,
): EstadoTransporte {
  const transporte = useMemo(
    // `reconectar: true` es del transporte, no del hook: espera creciente de
    // 1 s a 30 s con ruido, para que 16 navegadores no reintenten a la vez.
    () => new Transporte(url, fabrica, { reconectar: true, testigo }),
    [url, fabrica, testigo],
  )

  const [conectado, setConectado] = useState(false)
  const [ultimoAviso, setUltimoAviso] = useState<Aviso | null>(null)

  useEffect(
    () => montarTransporte(transporte, {
      // Solo apunta el hecho. La reconexion la lleva el propio `Transporte`.
      alCerrarse: () => setConectado(false),
      alAviso: (a) => setUltimoAviso(a),
    }),
    [transporte],
  )

  // El muestreo. `setConectado` con el mismo booleano no provoca re-render:
  // React descarta la actualizacion si el valor no cambia.
  const tic = useLatido()
  useEffect(() => {
    setConectado(transporte.conectado)
  }, [transporte, tic])

  return { transporte, conectado, ultimoAviso }
}
