/**
 * QUÉ SE PUEDE LEER DEL ROBOT PARA EL CUADERNO — sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL CUADERNO NO LEÍA NI UN NÚMERO DEL ROBOT, Y ES LA MITAD DE SU RAZÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * Su asunto es **comparar lo que dijo el robot con lo que mide una cinta**, y el
 * campo «dijo el robot» se tecleaba a mano: había que abrir otra pestaña, leer
 * un número, memorizarlo y volver. Con una cinta métrica en la otra mano.
 *
 * Y la copia a mano no es solo incómoda: es **donde entran los errores** que
 * esta pantalla existe para cazar. Un dígito mal copiado se convierte en una
 * discrepancia robot/persona que no ocurrió.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS TRES MAGNITUDES, Y POR QUÉ SOLO ESTAS TRES
 * ═══════════════════════════════════════════════════════════════════════════
 * Son las que una práctica compara contra un instrumento físico, y las que
 * salen de topics **baratos**:
 *
 *   · desplazamiento y rumbo → `/odom`, 13,05 kB/s
 *   · voltaje                → `/battery_state`, 0,35 kB/s
 *
 * ⚠️ **NO se ofrece la distancia frontal**, que sería la cuarta natural: sale de
 *    `/scan`, que son 66,98 kB/s — el 83 % del tráfico del robot. Suscribirse
 *    desde el cuaderno para leer un número una vez costaría más que toda la
 *    pestaña de telemetría. Quien la necesite la tiene en «Lo que ve».
 */

/** Lo mínimo de `/odom` que hace falta aquí. */
export interface Odometria {
  x: number
  y: number
  /** En grados, ya convertido del cuaternión por quien llama. */
  yaw: number
}

export type Magnitud = 'DESPLAZAMIENTO' | 'RUMBO' | 'VOLTAJE'

export interface Definicion {
  /** Lo que se pone en el campo «qué se mide» si estaba vacío. */
  que: string
  unidad: string
  /** Una frase que dice CONTRA QUÉ se compara. Es lo que hace útil la lectura. */
  contra: string
}

export const MAGNITUDES: Readonly<Record<Magnitud, Definicion>> = {
  DESPLAZAMIENTO: {
    que: 'desplazamiento desde el origen',
    unidad: 'cm',
    contra: 'Mide con la cinta desde la marca de salida. Pon la odometría a cero en «Acciones» '
      + 'ANTES de mover el robot, o esto contará desde donde estuviera el origen.',
  },
  RUMBO: {
    que: 'rumbo (yaw)',
    unidad: '°',
    contra: 'Mide con transportador. El origen del yaw es «donde miraba al arrancar el driver», '
      + 'no el norte: lo que se compara es el GIRO entre dos lecturas, no el valor absoluto.',
  },
  VOLTAJE: {
    que: 'voltaje de la batería',
    unidad: 'V',
    contra: 'Contra un multímetro en los bornes. Y no contra el porcentaje del firmware, que '
      + 'marcó 100 % con la batería a 8,29 V.',
  },
}

/**
 * El desplazamiento desde el origen de la odometría, EN CENTÍMETROS.
 *
 * 🔴 `hypot(x, y)` y no `x` a secas. El marco del locator del RVR está **90°
 *    girado** respecto al «adelante» del robot —medido, y por eso avanzar recto
 *    da siempre −90° en su marco—, así que leer una sola componente daría casi
 *    cero mientras el robot cruza la habitación. Es el mismo error que el driver
 *    cometía copiando `Velocity.X` a `linear.x`.
 *
 * ⚠️ Y por eso NO tiene signo: es una distancia, no una coordenada. Un
 *    retroceso de 30 cm da 30, no −30.
 */
export function desplazamientoCm(o: Odometria): number | null {
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return null
  return Math.hypot(o.x, o.y) * 100
}

/**
 * El valor que se escribe en el campo, ya como texto con coma.
 *
 * 🔴 DOS DECIMALES Y COMA. El cuaderno tiene escrito que las dos marcas
 *    decimales en la misma pantalla fue un defecto suyo —el campo decía `30,2` y
 *    la tabla `30.2`—, y este valor cae justo en el campo que se compara. Que
 *    venga del robot no lo exime.
 *
 * @returns `null` cuando no hay nada que escribir. Nunca `'0'`: un cero
 *          inventado en el campo que se compara con una cinta es peor que un
 *          campo vacío.
 */
export function paraElCampo(valor: number | null): string | null {
  if (valor === null || !Number.isFinite(valor)) return null
  return valor.toFixed(2).replace('.', ',')
}
