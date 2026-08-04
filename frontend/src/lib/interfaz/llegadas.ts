/**
 * La contabilidad de LLEGADAS de un topic, y el ritmo que se puede afirmar a
 * partir de ella. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO NO ES «LA FRECUENCIA DEL ROBOT», Y HAY QUE DECIRLO EN LA
 *      PANTALLA
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se cuenta aqui son mensajes que LLEGAN AL NAVEGADOR, con la marca de
 * tiempo que les pone el navegador. Entre el publicador del robot y este
 * contador hay: el ejecutor de ROS, rosbridge (que serializa a JSON y comparte
 * UNA suscripcion entre todos los clientes), el WiFi del aula, la pila TCP y el
 * bucle de eventos de JavaScript. Cualquiera de esos seis puede perder o
 * agrupar mensajes.
 *
 * En este proyecto el instrumento ya ha mentido CINCO veces, y una de ellas es
 * exactamente esta: `rclpy.spin_once()` en bucle media **11,3 Hz sobre un robot
 * que iba a 16,5** -y la comprobacion PASABA, porque el umbral era «> 10 Hz»,
 * asi que habria mandado a arreglar un driver sano.
 *
 * → Por eso este numero se etiqueta SIEMPRE como «observado en el navegador» y
 *   se pinta al lado del valor MEDIDO EN EL ROBOT. Un ritmo observado por
 *   debajo del de referencia dice «algo entre el robot y esta pestaña esta
 *   perdiendo mensajes»; NO dice «el robot publica despacio».
 *
 * → Y por eso `salud.ts` decide por ANTIGUEDAD y no por Hz. Esto es para mirar,
 *   no para decidir.
 */

export interface Llegadas {
  /** Cuantos mensajes han llegado desde que se monto la vista. */
  n: number
  /** Marca de tiempo del primero, en ms. `null` = no ha llegado ninguno. */
  tPrimero: number | null
  /** Marca de tiempo del ultimo, en ms. `null` = no ha llegado ninguno. */
  tUltimo: number | null
}

export const LLEGADAS_VACIAS: Llegadas = { n: 0, tPrimero: null, tUltimo: null }

/** Anota una llegada. Devuelve un objeto nuevo: no muta el que recibe. */
export function acumularLlegada(l: Llegadas, ahora: number): Llegadas {
  return {
    n: l.n + 1,
    tPrimero: l.tPrimero === null ? ahora : l.tPrimero,
    tUltimo: ahora,
  }
}

/**
 * Mensajes por segundo OBSERVADOS EN EL NAVEGADOR. Lee el aviso de la cabecera
 * antes de usarlo para nada que no sea mirar.
 *
 * 🔴 `null` con menos de DOS llegadas, y no 0. Con un solo mensaje no hay
 * ningun intervalo que medir: devolver 0 seria afirmar «este topic va a cero
 * Hz» justo cuando acaba de llegar algo. Es el mismo error que devolver 0 en un
 * presupuesto sin haber sumado.
 *
 * 🔴 `null` tambien si el intervalo no es positivo. `Date.now()` no es monotono:
 * un salto de NTP hacia atras da un intervalo negativo, y dividir por el
 * produce un ritmo negativo -un numero que parece una medida y no lo es.
 */
export function ritmoObservado(l: Llegadas): number | null {
  if (l.n < 2 || l.tPrimero === null || l.tUltimo === null) return null
  const intervaloMs = l.tUltimo - l.tPrimero
  if (intervaloMs <= 0) return null
  return (l.n - 1) / (intervaloMs / 1000)
}

/**
 * Los ritmos MEDIDOS EN EL ROBOT, para poner al lado del observado. Salen de la
 * tabla de valores de referencia del proyecto, medidos sobre rvr-01:
 *
 *   /odom           16,53 Hz   (2026-07-31, 30 s, sigma 2,2 ms)
 *   /encoders       16,57 Hz   (2026-08-01)
 *   /motor_status    1 Hz      republicado por `create_timer(1.0, ...)` del driver
 *   /battery_state   1/30 Hz   cada 30,0 s exactos: es el latido del keepalive
 *
 * ⚠️ NO hay una entrada para `/imu` a proposito, aunque este medido: su ritmo
 * NO es estable -13,338 · 16,297 · 16,505 Hz en tres tomas, un ±11 % que este
 * proyecto NO tiene explicado-, asi que citar un numero suelto como si fuera su
 * frecuencia seria inventar una precision que no existe. La web tampoco lo
 * modela.
 */
export const RITMO_MEDIDO_HZ: Readonly<Record<string, number>> = {
  '/odom': 16.53,
  '/encoders': 16.57,
  '/motor_status': 1,
  '/battery_state': 1 / 30,
}

/** `undefined` si nadie lo ha medido: no se estima, igual que en `presupuesto.ts`. */
export const ritmoMedidoDe = (topic: string): number | undefined => RITMO_MEDIDO_HZ[topic]
