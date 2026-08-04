/**
 * LA CAPA DE SEGURIDAD, TRADUCIDA. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTE FICHERO EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * «El robot no se mueve y no hay ningun error» es el sintoma mas confuso de
 * este laboratorio, y su causa mas frecuente esta medida: **el barrido del
 * LIDAR apagado**, que es el estado de REPOSO NORMAL de los 16 robots. Sin
 * `/scan`, el `collision_monitor` bloquea todo movimiento.
 *
 * Hasta el 2026-08-04 eso no se podia VER desde fuera. Ahora si: el monitor
 * publica `{action_type: 1, polygon_name: 'invalid source'}`, o sea PARAR
 * porque su fuente de datos no vale (evidencia 72, medido contra rvr-01).
 *
 * → Este modulo convierte eso en una frase que el alumno pueda actuar, en vez
 *   de dejarlo mirando un robot que no obedece.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE NO SE PUEDE HACER AQUI
 * ═══════════════════════════════════════════════════════════════════════════
 * **«Sin mensaje» NO significa «todo bien».** El monitor publica **al cambiar**,
 * y solo procesa cuando le llega `cmd_vel_raw`: con el robot quieto no llega
 * nada nunca. Medido: 0 mensajes en 12 s en reposo. Traducir ese silencio a
 * «seguridad OK» seria pintar de verde un estado del que no se sabe nada —el
 * fallo caracteristico de este proyecto—, asi que `null` produce
 * `DESCONOCIDO` y se dice en voz alta.
 *
 * **El enum NO se inventa.** Sale del `.msg` real del robot. Un `action_type`
 * que no este en el enum se reporta como desconocido **con su numero**, no se
 * mapea al valor mas parecido: aqui ya costo caro dar por bueno un valor
 * plausible.
 */

import { ACCION_MONITOR, MensajeEstadoMonitor } from '../../hooks/useTopic'

/**
 * 🔴 `polygon_name` NO siempre trae el nombre de un poligono: a veces trae un
 * MOTIVO. Este es el unico observado, y viene del propio Nav2.
 */
export const MOTIVO_FUENTE_INVALIDA = 'invalid source'

export type EfectoSeguridad =
  | 'DESCONOCIDO'      // no ha llegado ningun mensaje: NO es «todo bien»
  | 'SIN_RESTRICCION'  // DO_NOTHING
  | 'BLOQUEA'          // STOP
  | 'RALENTIZA'        // SLOWDOWN / APPROACH / LIMIT
  | 'NO_RECONOCIDO'    // un action_type fuera del enum del .msg

export interface Seguridad {
  efecto: EfectoSeguridad
  /** Frase para el usuario. Nunca afirma nada que el mensaje no diga. */
  explicacion: string
  /** Qué puede hacer quien lo lee. Vacio si no hay nada que hacer. */
  queHacer: string
  /** true solo cuando la causa es que no llega `/scan`. */
  faltaBarrido: boolean
}

/**
 * Traduce el ultimo `/collision_monitor_state`, o `null` si no ha llegado ninguno.
 */
export function interpretarSeguridad(m: MensajeEstadoMonitor | null): Seguridad {
  if (m === null) {
    return {
      efecto: 'DESCONOCIDO',
      explicacion:
        'no se sabe: la capa de seguridad solo informa cuando el robot recibe ordenes de ' +
        'movimiento, asi que con el robot quieto no dice nada. Esto NO significa que todo este bien.',
      queHacer: '',
      faltaBarrido: false,
    }
  }

  const poligono = m.polygon_name
  const esFuenteInvalida = poligono === MOTIVO_FUENTE_INVALIDA

  switch (m.action_type) {
    case ACCION_MONITOR.NO_HACER_NADA:
      return {
        efecto: 'SIN_RESTRICCION',
        explicacion: 'la capa de seguridad no esta limitando el movimiento',
        queHacer: '',
        faltaBarrido: false,
      }

    case ACCION_MONITOR.PARAR:
      return esFuenteInvalida
        ? {
            efecto: 'BLOQUEA',
            explicacion:
              'la capa de seguridad esta bloqueando el movimiento porque no le llega el barrido ' +
              'del LIDAR. El robot no esta averiado: sin /scan no puede saber si hay algo delante, ' +
              'asi que no deja conducir.',
            queHacer: 'enciende el barrido antes de mover el robot',
            faltaBarrido: true,
          }
        : {
            efecto: 'BLOQUEA',
            explicacion: `la capa de seguridad ha parado el robot: hay algo dentro de «${poligono}»`,
            queHacer: 'aparta el obstaculo, o mueve el robot en sentido contrario',
            faltaBarrido: false,
          }

    // 🔴 Los tres van juntos porque para quien mira la pantalla son lo mismo:
    //    el robot obedece pero mas despacio de lo que se le pide. El polígono
    //    dice cual, y eso basta; distinguir SLOWDOWN de APPROACH exigiria
    //    explicar la configuracion del monitor, que no ayuda a nadie en el aula.
    case ACCION_MONITOR.RALENTIZAR:
    case ACCION_MONITOR.APROXIMACION:
    case ACCION_MONITOR.LIMITAR:
      return {
        efecto: 'RALENTIZA',
        explicacion:
          `el robot va mas despacio de lo que se le pide porque hay algo cerca («${poligono}»). ` +
          'No esta averiado ni desobedeciendo.',
        // 🔴 Esto sale de una medida, y explica una queja real: un retroceso
        //    comandado de 30 cm recorrio 14 porque el poligono es ESTATICO y
        //    frena al 40 % aunque el robot se este ALEJANDO del obstaculo.
        queHacer:
          'si vas marcha atras alejandote, tambien frena: el poligono no sabe hacia donde vas',
        faltaBarrido: false,
      }

    default:
      return {
        efecto: 'NO_RECONOCIDO',
        explicacion:
          `la capa de seguridad ha devuelto un codigo que esta interfaz no conoce ` +
          `(action_type=${m.action_type}, «${poligono}»). No se interpreta: seria adivinar.`,
        queHacer: '',
        faltaBarrido: false,
      }
  }
}
