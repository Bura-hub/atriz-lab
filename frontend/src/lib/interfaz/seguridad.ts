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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 2026-08-09: `APROXIMACION` NO ERA «VA MAS DESPACIO». ERA UN ROBOT MUERTO
 * ═══════════════════════════════════════════════════════════════════════════
 * Hasta hoy este fichero metia `APROXIMACION` en el mismo saco que `RALENTIZAR`
 * y `LIMITAR`, con una razon escrita al lado: *«para quien mira la pantalla son
 * lo mismo»*. **El robot la desmintio midiendo**, con 24 estaciones a mano en
 * las cuatro direcciones (evidencias 93, 94 y 95):
 *
 *     pared DETRAS a 16,8 cm, 188 cm libres delante, por /cmd_vel_raw
 *       AVANZAR alejandose -> 0,0 cm    GIRAR -> 0,0°    RETROCEDER -> 0,0 cm
 *
 * `approach` escala el mando **entero** —lineal y angular— por el tiempo hasta
 * colision, y con un punto ya dentro del circulo ese factor es **0**, sin mirar
 * si el movimiento acerca o aleja. **24 de 24 estaciones dieron TODO-O-NADA.**
 *
 * Lo que la pantalla decia era, entonces, falso por partida doble: ni «va mas
 * despacio» (no va), ni el consejo de «prueba a alejarte» (esta medido que no
 * funciona). Y girando **no rozaria nada**: con el monitor puenteado el robot
 * dio 359,6° sin tocar la pared, con el usuario mirandolo.
 *
 * 📝 La leccion, que vale mas que el arreglo: **agrupar dos codigos porque «para
 *    el usuario son lo mismo» es una hipotesis sobre el efecto**, y hay que
 *    medirla como cualquier otra. Esta llevaba escrita desde que se escribio la
 *    pantalla y sonaba razonable.
 */

import { ACCION_MONITOR, MensajeEstadoMonitor } from '../../hooks/useTopic'

/**
 * 🔴 `polygon_name` NO siempre trae el nombre de un poligono: a veces trae un
 * MOTIVO. Este es el unico observado, y viene del propio Nav2.
 */
export const MOTIVO_FUENTE_INVALIDA = 'invalid source'

/**
 * El radio del circulo de aproximacion, en metros desde `base_footprint`.
 *
 * 🔴 **Cambio de valor el 2026-08-09: era 0.18.** Se bajo a 0.15 con todo medido
 * (evidencia 95), y la decision la tomo el usuario. Reduce la banda en la que el
 * robot queda congelado sin tocar nada de **3,6 cm a 0,6**, conservando 7,4/6,6
 * cm de holgura al parar a velocidad maxima.
 *
 * ⚠️ **Si alguna frase de la interfaz cita una distancia de seguridad, es ESTA**
 *    y no otra. `verificar_robot.sh` da FALLO —no aviso— si encuentra 0.18 en un
 *    robot, porque significa que no le llego el fichero nuevo.
 */
export const RADIO_APROXIMACION_M = 0.15

/**
 * El radio circunscrito del robot: 0,1442 m desde `base_footprint`.
 *
 * 📌 Es el **suelo** del valor de arriba, no un dato suelto. Por debajo, el
 * monitor autorizaria giros que la esquina del chasis no puede hacer; por
 * encima, cada centimetro es banda de inmovilizacion inutil. Son la misma
 * cantidad: `RADIO_APROXIMACION_M − RADIO_CIRCUNSCRITO_M` = **0,6 cm**, que es
 * lo que queda hoy y no se puede quitar sin bajar del ruido del LIDAR (±0,3 cm).
 */
export const RADIO_CIRCUNSCRITO_M = 0.1442

export type EfectoSeguridad =
  | 'DESCONOCIDO'        // no ha llegado ningun mensaje: NO es «todo bien»
  | 'SIN_RESTRICCION'    // DO_NOTHING
  | 'BLOQUEA'            // STOP
  | 'INMOVILIZA'         // APPROACH, y se ha VISTO que el robot no se mueve
  | 'PUEDE_INMOVILIZAR'  // APPROACH sin saber si se mueve: puede ser cero
  | 'RALENTIZA'          // SLOWDOWN / LIMIT
  | 'NO_RECONOCIDO'      // un action_type fuera del enum del .msg

export interface Seguridad {
  efecto: EfectoSeguridad
  /** Frase para el usuario. Nunca afirma nada que el mensaje no diga. */
  explicacion: string
  /** Qué puede hacer quien lo lee. Vacio si no hay nada que hacer. */
  queHacer: string
  /** true solo cuando la causa es que no llega `/scan`. */
  faltaBarrido: boolean
  /**
   * 🔴 **La web no puede sacar al robot de aqui, y la pantalla no debe fingir
   * que si.** Cuando vale `true` esta medido que mandar movimiento —en cualquier
   * sentido, incluido alejarse— da 0,0 cm. Lo unico que lo saca es una mano.
   *
   * → Quien pinte esto **no ofrece un boton**, no sugiere marcha atras, y no
   *   propone repetir la orden. Las tres cosas las desmiente la evidencia 93.
   */
  sinSalidaDesdeLaWeb: boolean
}

/**
 * Lo que se ha VISTO hacer al robot, para distinguir «frenado» de «congelado».
 *
 * 🔴 El `action_type` **no lo dice**: `APROXIMACION` cubre desde «un poco mas
 * lento» hasta «exactamente cero», y el mensaje es el mismo. La unica forma de
 * separarlos es la que este proyecto usa para todo lo demas: **mirar el efecto**.
 */
export interface MovimientoObservado {
  /** ¿Se le está pidiendo que se mueva ahora mismo? */
  mandando: boolean
  /**
   * ¿Se mueve? `null` = no se sabe (no llega `/odom`, o no se está mandando).
   *
   * ⚠️ Quien lo calcule debe decir **con qué resolucion**. `QUIETO_MS` de abajo
   *    existe para no tener que inventarse un umbral.
   */
  moviendose: boolean | null
}

/**
 * El umbral de «quieto», en m/s y rad/s.
 *
 * 🔴 **No es un numero inventado: es la resolucion de lo que se pinta.** La
 * pantalla muestra la velocidad medida con **tres decimales**, asi que por
 * debajo de medio milesimo lo que se ve es `0,000`. Decir «no se mueve» cuando
 * la pantalla muestra un cero exacto es una afirmacion que quien mira puede
 * comprobar; cualquier otro umbral seria una cifra sin origen, que es justo lo
 * que este proyecto ha pagado varias veces.
 *
 * 📝 Y por eso NO se usa una fraccion de lo comandado: con `approach` activo el
 *    mando ya sale recortado a un ~1,25 % por centimetro de holgura (perfil
 *    medido `mando ≈ 0,0125 × (distancia − radius)`), asi que «va al 20 % de lo
 *    pedido» es el caso NORMAL y un umbral asi saltaria siempre.
 */
export const QUIETO_MS = 0.0005

/**
 * Traduce el ultimo `/collision_monitor_state`, o `null` si no ha llegado ninguno.
 *
 * @param movimiento Lo observado por `/odom`. Omitirlo es honesto y da el caso
 *   prudente: con `APROXIMACION` se advierte de que **puede** estar inmovilizado.
 */
export function interpretarSeguridad(
  m: MensajeEstadoMonitor | null,
  movimiento?: MovimientoObservado | null,
): Seguridad {
  if (m === null) {
    return {
      efecto: 'DESCONOCIDO',
      explicacion:
        'no se sabe: la capa de seguridad solo informa cuando el robot recibe ordenes de ' +
        'movimiento, asi que con el robot quieto no dice nada. Esto NO significa que todo este bien.',
      queHacer: '',
      faltaBarrido: false,
      sinSalidaDesdeLaWeb: false,
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
        sinSalidaDesdeLaWeb: false,
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
            sinSalidaDesdeLaWeb: false,
          }
        : {
            efecto: 'BLOQUEA',
            explicacion: `la capa de seguridad ha parado el robot: hay algo dentro de «${poligono}»`,
            queHacer: 'aparta el obstaculo, o mueve el robot en sentido contrario',
            faltaBarrido: false,
            sinSalidaDesdeLaWeb: false,
          }

    /*
     * 🔴🔴 APPROACH VA SOLO, Y ES EL CASO PEOR DE LOS CINCO.
     *
     * No recorta la velocidad un tanto por ciento: multiplica el mando ENTERO
     * —lineal y angular— por el tiempo hasta colision. Dentro del circulo ese
     * factor es CERO, y entonces el robot no se mueve en ninguna direccion,
     * **tampoco alejandose**. Medido en las cuatro direcciones, 24 de 24
     * estaciones todo-o-nada.
     */
    case ACCION_MONITOR.APROXIMACION: {
      const congelado = movimiento?.mandando === true && movimiento.moviendose === false
      const comun = {
        queHacer:
          'retira el obstaculo, o aparta el robot con la mano. Desde la web no hay forma: ' +
          'mandar marcha atras esta medido y da 0,0 cm igual.',
        faltaBarrido: false,
        sinSalidaDesdeLaWeb: true,
      }
      return congelado
        ? {
            ...comun,
            efecto: 'INMOVILIZA',
            explicacion:
              'el robot esta BLOQUEADO por la capa de seguridad y no puede salir solo. Se le esta ' +
              'mandando movimiento y la velocidad medida es cero: tiene algo a menos de 15 cm ' +
              `(«${poligono}»). No es una averia, y girar tampoco lo saca.`,
          }
        : {
            ...comun,
            efecto: 'PUEDE_INMOVILIZAR',
            explicacion:
              `hay algo dentro del circulo de aproximacion («${poligono}»), a menos de 15 cm. ` +
              'Eso recorta el mando entero, giro incluido, y si el obstaculo esta lo bastante ' +
              'cerca lo deja en CERO: el robot no se mueve en ninguna direccion, ni siquiera para ' +
              'alejarse. Mira si se esta moviendo antes de repetir la orden.',
          }
    }

    // 🔴 Estos dos SI son «va mas despacio», y por eso `APROXIMACION` ya no esta
    //    aqui: se agrupaban los tres con el argumento de que «para quien mira la
    //    pantalla son lo mismo», y la medida del 2026-08-09 lo desmintio.
    case ACCION_MONITOR.RALENTIZAR:
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
        sinSalidaDesdeLaWeb: false,
      }

    default:
      return {
        efecto: 'NO_RECONOCIDO',
        explicacion:
          `la capa de seguridad ha devuelto un codigo que esta interfaz no conoce ` +
          `(action_type=${m.action_type}, «${poligono}»). No se interpreta: seria adivinar.`,
        queHacer: '',
        faltaBarrido: false,
        sinSalidaDesdeLaWeb: false,
      }
  }
}

/**
 * ¿Se mueve el robot, con la resolucion que la pantalla muestra?
 *
 * Pensado para alimentar `movimiento.moviendose` desde `/odom`. `null` si no ha
 * llegado ninguna muestra: **ausencia de dato no es ausencia de movimiento**.
 */
export function seMueve(
  linealX: number | null | undefined,
  angularZ: number | null | undefined,
): boolean | null {
  const v = typeof linealX === 'number' && Number.isFinite(linealX) ? linealX : null
  const w = typeof angularZ === 'number' && Number.isFinite(angularZ) ? angularZ : null
  if (v === null && w === null) return null
  return Math.abs(v ?? 0) >= QUIETO_MS || Math.abs(w ?? 0) >= QUIETO_MS
}
