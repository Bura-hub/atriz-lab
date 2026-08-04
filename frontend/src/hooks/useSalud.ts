'use client'

/**
 * La salud del robot, decidida por **LLEGADAS**, no por Hz.
 *
 * 🔴 Por que importa la distincion: una comprobacion de «> 10 Hz» de este
 * proyecto PASABA midiendo 11,3 Hz sobre un robot que iba a 16,5 -el medidor
 * perdia mensajes-, asi que habria mandado a arreglar un driver sano. Lo que se
 * mira aqui es CUANTO HACE que llego el ultimo mensaje (`msDesdeUltimo()`, que
 * el `Transporte` anota al recibirlo) y se le pasa a `evaluarSalud()`. No se
 * calcula ninguna frecuencia, ni se cuenta ningun mensaje.
 *
 * 🔴 Y lo que `evaluarSalud()` NUNCA dice: «averiado». `esAveria` es siempre
 * `false`, y `SIN_DATOS` viene con sus causas POSIBLES sin elegir entre ellas.
 * Un RVR cargando -apagado con la Pi viva- es el estado cotidiano del
 * laboratorio y se ve exactamente igual que uno dormido.
 */

import { useEffect, useState } from 'react'
import { EntradaSalud, Salud, evaluarSalud } from '../lib/rosbridge/salud'
import { Transporte } from '../lib/rosbridge/transporte'
import { useLatido } from './useTransporte'

/**
 * `/odom` es el latido de la ficha de UN robot: 16,5 Hz, asi que los 3 s de
 * `UMBRAL_SILENCIO_MS` son ~50 mensajes perdidos y el veredicto es solido.
 *
 * ⚠️ Cuesta 13,05 kB/s por robot. Es asumible en la ficha de un robot y NO lo es
 * en el muro de 16 (ver `lib/flota/presupuesto.ts`, que usa `/motor_status` a
 * 1 Hz y 0,45 kB/s como latido). Este hook es para la ficha; el muro usa
 * `resumirBaldosa()`.
 */
export const TOPIC_LATIDO = '/odom'

/**
 * EL CUERPO DEL EFECTO, sin React.
 *
 * 📝 La suscripcion a `/odom` con un manejador VACIO no es un descuido: lo que
 * alimenta `msDesdeUltimo()` es que el mensaje LLEGUE, y solo llega si hay una
 * suscripcion. El `Transporte` comparte una sola suscripcion por topic entre
 * todos sus oyentes, asi que si la interfaz ya pinta `/odom` con `useTopic`,
 * esta segunda no cuesta ni un byte mas en el cable.
 */
export function montarVigilanciaSalud(transporte: Transporte): () => void {
  return transporte.suscribir(TOPIC_LATIDO, () => {})
}

/**
 * Lee el estado del transporte y lo convierte en la entrada de `evaluarSalud()`.
 * Pura respecto a React: se prueba en Node.
 *
 * ⚠️ `msDesdeUltimoScan` se lee SIN suscribirse a `/scan`. Es deliberado: `/scan`
 * es el 83 % del trafico de un robot, y `salud.ts` ya avisa de que mantener esa
 * suscripcion de forma permanente -solo para afinar el diagnostico de
 * SIN_DATOS- es una decision de coste de la interfaz. Aqui NO se paga. Lo que
 * `Transporte` sepa de `/scan` (p.ej. la muestra que `arrancarBarrido()` espero)
 * se aprovecha; nada mas.
 */
export function entradaSalud(transporte: Transporte, frenando: boolean): EntradaSalud {
  return {
    conectado: transporte.conectado,
    msDesdeUltimoOdom: transporte.msDesdeUltimo(TOPIC_LATIDO),
    msDesdeUltimoScan: transporte.msDesdeUltimo('/scan'),
    frenando,
  }
}

/**
 * Dos `Salud` son la misma cosa. Existe para no re-renderizar cada
 * `PERIODO_MUESTREO_MS` un robot que no ha cambiado: con 16 baldosas eso serian
 * 32 renders por segundo sin ninguna informacion nueva.
 */
export function mismaSalud(a: Salud, b: Salud): boolean {
  return (
    a.estado === b.estado &&
    a.frenando === b.frenando &&
    a.esAveria === b.esAveria &&
    a.causasPosibles.length === b.causasPosibles.length &&
    a.causasPosibles.every((c, i) => c === b.causasPosibles[i])
  )
}

const SIN_CONEXION: Salud = {
  estado: 'SIN_CONEXION', frenando: false, causasPosibles: [], esAveria: false,
}

/**
 * `frenando` viene de `/collision_monitor_state` y lo aporta quien llame: este
 * hook no se suscribe a ese topic para no decidir por la interfaz que topics
 * paga. `false` es el valor de arranque, no una afirmacion de que no frena.
 */
export function useSalud(transporte: Transporte, frenando = false): Salud {
  const [salud, setSalud] = useState<Salud>(SIN_CONEXION)

  useEffect(() => montarVigilanciaSalud(transporte), [transporte])

  const tic = useLatido()
  useEffect(() => {
    const nueva = evaluarSalud(entradaSalud(transporte, frenando))
    setSalud((anterior) => (mismaSalud(anterior, nueva) ? anterior : nueva))
  }, [transporte, frenando, tic])

  return salud
}
