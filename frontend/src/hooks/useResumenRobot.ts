'use client'

/**
 * EL RESUMEN DE UN ROBOT: lo mismo que decide una baldosa del muro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO ES UN HOOK Y NO CODIGO DENTRO DE LA BALDOSA
 * ═══════════════════════════════════════════════════════════════════════════
 * Esta receta —que topics hacen falta, cual es el LATIDO, y el truco de guardar
 * la lectura anterior del contador— vivia entera dentro de `BaldosaConectada`.
 * Al querer que la cabecera de la ficha del robot dijera lo MISMO que su baldosa
 * del muro, habia dos caminos:
 *
 *   · copiarla —y entonces el dia que alguien cambie el latido, o el umbral, o
 *     el orden de los motivos, **el muro y la ficha empezarian a discrepar sobre
 *     el mismo robot**, que es exactamente la clase de fallo que este proyecto
 *     lleva meses persiguiendo—;
 *   · o sacarla a un sitio, que es esto.
 *
 * La DECISION sigue estando en `resumirBaldosa()`, que es pura y tiene sus
 * pruebas detras. Aqui solo se reunen sus entradas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE CUESTA, PORQUE EN ESTE PROYECTO EL ANCHO DE BANDA SE ESCRIBE
 * ═══════════════════════════════════════════════════════════════════════════
 * Tres topics baratos: `/battery_state` (cada 30 s), `/motor_status` (1 Hz) y
 * `/estado_robot` (1 Hz, ~0,03 kB/s). Los tres juntos son **0,48 kB/s**, que es
 * el presupuesto medido del muro entero por robot — y ninguno es `/odom` ni
 * `/scan`, que son los que cuestan.
 *
 * ⚠️ En la ficha del robot los tres ya estaban suscritos por otras piezas
 *    (`VoltajeDelMarco`, `BotonParada`, `EstadoMotores`), asi que la cabecera no
 *    añade caudal nuevo salvo `/motor_status` en las pestañas que no lo pedian.
 */

import { useRef } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { Baldosa, resumirBaldosa } from '@/lib/flota/resumen'
import { entradaDeBaldosa } from '@/lib/interfaz/lecturas'

/**
 * El topic del que sale `msDesdeUltimoLatido`.
 *
 * 🔴 NO ES INTERCAMBIABLE. `resumirBaldosa()` usa `UMBRAL_LATIDO_MURO_MS` (5000),
 * calibrado contra este topic de **1 Hz**: son cinco mensajes perdidos. El umbral
 * de `evaluarSalud()` son 3000 ms calibrados contra `/odom` a 16,5 Hz, o sea unos
 * cincuenta. Cambiar el topic sin cambiar el umbral pinta «sin señal de vida» al
 * primer hipo de WiFi.
 */
const TOPIC_LATIDO = '/motor_status'

/** El resumen de ESTE robot, el del `ProveedorRobot` que envuelve al llamante. */
export function useResumenRobot(id: number): Baldosa {
  const { transporte, conectado } = useRobot()
  const bateria = useTopic(transporte, '/battery_state')
  const motores = useTopic(transporte, TOPIC_LATIDO)
  const estado = useTopic(transporte, '/estado_robot')
  // La antiguedad envejece sin que llegue nada: sin este muestreo, un robot mudo
  // se quedaria en «en linea» para siempre.
  useLatido()

  /*
   * 🔴 LA LECTURA ANTERIOR DEL CONTADOR, y no sobra.
   *
   * `/estado_robot` va `TRANSIENT_LOCAL`, asi que un suscriptor nuevo puede
   * recibir el ultimo valor latcheado de un nodo **ya muerto**: «llego un
   * mensaje» no prueba que haya nadie detras. Lo unico que lo prueba es que el
   * numero se mueva, y para eso hacen falta dos lecturas.
   */
  const latidoPrevio = useRef<number | null>(null)
  const latidoAnterior = latidoPrevio.current
  if (estado !== null && estado.latido !== latidoPrevio.current) {
    latidoPrevio.current = estado.latido
  }

  return resumirBaldosa(
    entradaDeBaldosa({
      id,
      conectado,
      bateria,
      motores,
      msDesdeUltimoMotorStatus: transporte.msDesdeUltimo(TOPIC_LATIDO),
      estado,
      latidoPrevio: latidoAnterior,
    }),
  )
}
