'use client'

/**
 * La teleoperacion atada al ciclo de vida de un componente.
 *
 * 🔴🔴 LA REGLA QUE JUSTIFICA ESTE FICHERO: **la limpieza tiene que llamar a
 * `desmontar()`**. El bucle de mando es un `setInterval` a 10 Hz que publica en
 * `/cmd_vel_raw`; si sobrevive al desmontaje, **el robot sigue moviendose** con
 * la pestaña ya en otra pagina y sin nadie sujetando el joystick. No es una fuga
 * de memoria: es un robot conduciendo solo.
 *
 * 📝 El watchdog del driver corta a los 0,3 s sin `cmd_vel_raw`, asi que en
 * cuanto el bucle para de verdad, el robot para solo en <= 0,3 s. Esa es la red
 * de seguridad; esto es la puerta que no hay que dejar abierta.
 */

import { useEffect, useMemo, useState } from 'react'
import { Liberacion, Teleoperacion } from '../lib/rosbridge/teleoperacion'
import { Aviso, Transporte } from '../lib/rosbridge/transporte'

export interface ControlTeleoperacion {
  /** Arranca o actualiza el bucle de 10 Hz. El ritmo lo impone el temporizador. */
  mover: (v: number, w: number) => void
  /** Twist cero y corta el bucle. 🔴 LANZA si no hay enlace: hay que enterarse. */
  parar: () => void
  /** Publica en `/emergency_stop`. 🔴 LANZA si no hay enlace, a proposito. */
  paradaEmergencia: () => void
  /** Espera un `/scan` REAL, no el codigo de retorno de `/start_scan`. */
  arrancarBarrido: (plazoMs?: number) => Promise<void>
  /**
   * Llama a `/release_emergency_stop` y **espera a que el robot lo atestigue**.
   * `confirmada: true` SOLO cuando `/estado_robot` baja la bandera en un mensaje
   * posterior a la referencia — la respuesta del servicio esta vacia y no prueba
   * nada. 🔴 No reanuda el bucle de mando.
   */
  liberarParada: (plazoMs?: number) => Promise<Liberacion>
  /**
   * El ultimo aviso local. Hoy solo uno: el tick del bucle fallo y se corto.
   * 🔴 Hay que pintarlo. `console.error` es MUDO para quien teleopera: el alumno
   * seguiria empujando el joystick contra un robot que ya no recibe nada.
   */
  ultimoAviso: Aviso | null
}

/**
 * EL CUERPO DEL EFECTO, sin React. La limpieza hace las dos cosas y en este
 * orden: suelta el oyente de avisos y **desmonta la teleoperacion**, que corta
 * el bucle de 10 Hz y suelta su propio oyente de `alCerrarse` en el transporte.
 */
export function montarTeleoperacion(
  teleoperacion: Teleoperacion,
  alAviso: (a: Aviso) => void,
): () => void {
  const bajaAviso = teleoperacion.alAviso(alAviso)
  return () => {
    bajaAviso()
    teleoperacion.desmontar()
  }
}

export function useTeleoperacion(transporte: Transporte): ControlTeleoperacion {
  const teleoperacion = useMemo(() => new Teleoperacion(transporte), [transporte])
  const [ultimoAviso, setUltimoAviso] = useState<Aviso | null>(null)

  useEffect(
    () => montarTeleoperacion(teleoperacion, (a) => setUltimoAviso(a)),
    [teleoperacion],
  )

  // 🔴 Los cinco se envuelven en vez de exponer la instancia: asi la interfaz
  //    no puede quedarse con una referencia a una `Teleoperacion` ya desmontada
  //    y seguir llamandola.
  //
  // ⚠️ `liberarParada` se expone desde el 2026-08-06 y **este comentario decia
  //    antes que no debia existir**. El peligro que lo justificaba esta cerrado
  //    y medido: liberar con un objetivo de Nav2 vivo hacia que el robot
  //    arrancara solo -34,7 cm-, y `cancelar_nav2` lo dejo en 0,0 con control.
  //    Lo que sigue siendo cierto, y por eso este hook NO lo llama nunca por su
  //    cuenta, es que liberar es un acto humano deliberado: aqui solo se pone la
  //    palanca al alcance de la pantalla, que la pide con confirmacion y sesion.
  const acciones = useMemo(
    () => ({
      mover: (v: number, w: number) => teleoperacion.mover(v, w),
      parar: () => teleoperacion.parar(),
      paradaEmergencia: () => teleoperacion.paradaEmergencia(),
      arrancarBarrido: (plazoMs?: number) => teleoperacion.arrancarBarrido(plazoMs),
      liberarParada: (plazoMs?: number) => teleoperacion.liberarParada(plazoMs),
    }),
    [teleoperacion],
  )

  return { ...acciones, ultimoAviso }
}
