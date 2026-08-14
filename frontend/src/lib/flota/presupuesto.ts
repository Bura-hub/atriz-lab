/**
 * El presupuesto de ancho de banda del muro del administrador: lo que impide que
 * dieciseis baldosas tumben el WiFi del aula.
 *
 * Los caudales son MEDIDOS (evidencia 68, robot real, con el barrido apagado),
 * en kB/s de JSON por rosbridge y POR ROBOT. No son estimaciones a ojo, y por
 * eso un topic sin medida no se estima: se lanza (ver `caudalDeFlota`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE NO SE USA `throttle_rate` PARA ESTO
 * ═══════════════════════════════════════════════════════════════════════════
 * `throttle_rate` funciona -medido: `/imu` baja de 16,30 a 1,83 Hz pidiendo 2-,
 * asi que la tentacion es obvia: «que el muro pida 1 Hz y ya esta».
 *
 * No sirve, y el motivo esta en el fuente de rosbridge, no en una conjetura.
 * `subscribe.py:225` hace:
 *
 *     self.throttle_rate = min(f("throttle_rate"))
 *
 * Es un MINIMO sobre TODOS los clientes suscritos a ese topic en ese robot, y
 * rosbridge mantiene UNA sola suscripcion ROS por topic, compartida. O sea:
 * **gana el cliente mas rapido, y su ritmo se le impone a todos los demas**. Un
 * administrador que pida 1 Hz sobre `/scan` recibira a 16,5 en cuanto un alumno abra
 * una pestaña suscrita a ese mismo robot sin limite -sin ningun aviso, porque
 * rosbridge no manda `status` por el socket.
 *
 * → `throttle_rate` baja el coste CUANDO ERES EL UNICO. No te protege de los
 *   demas, asi que no puede sostener un presupuesto. Lo unico que lo sostiene
 *   es NO SUSCRIBIRSE: por eso `TOPICS_MURO` tiene dos topics y no seis.
 *
 * 📝 Es la misma familia de trampa que el QoS: en rosbridge, el primer cliente
 *    que se suscribe a un topic gobierna a todos los que llegan despues.
 */

/**
 * kB/s por robot, medidos. `/scan` no se midio suelto: se sabe que es el **83 %**
 * de los 80,7 kB/s del total navegando, y se deja escrita esa derivacion en vez
 * de un numero magico -si algun dia se re-mide el 83 %, este valor se corrige
 * solo.
 *
 * ⚠️ Lo que NO esta aqui (`/color`, `/map`, `/tf`, `/tf_static`,
 * `/collision_monitor_state`, `/amcl_pose`) no es que valga cero: es que NADIE
 * LO HA MEDIDO. `caudalDeFlota` lanza al encontrarlos, a proposito: devolver 0
 * seria un presupuesto que aprueba sin haber sumado, que es la forma que este
 * proyecto ya ha pagado varias veces -un codigo de salida 0 que no prueba nada.
 */
export const CAUDAL_KBS: Readonly<Record<string, number>> = {
  '/odom': 13.05,
  '/imu': 9.48,
  '/encoders': 1.39,
  '/motor_status': 0.45,
  '/battery_state': 0.03,
  '/scan': 80.7 * 0.83,
}

/**
 * Los dos unicos topics del muro del administrador: **0,48 kB/s por robot**, 7,7 kB/s
 * con los 16. Con `/odom` dentro se pasaria de 200 kB/s, que sobre una sola AP
 * compartida con los portatiles del aula es otra conversacion.
 *
 * `/motor_status` va a 1 Hz (el driver lo republica con su propio temporizador,
 * `create_timer(1.0, ...)`), asi que ademas de la salud de motores es el LATIDO
 * del muro: sigue llegando aunque el RVR este apagado, lo que distingue «la Pi
 * esta viva» de «no hay nadie». `/battery_state` va cada 30,0 s y trae el
 * `voltage`, que es lo unico que decide si hay que cargar.
 */
export const TOPICS_MURO = ['/battery_state', '/motor_status', '/estado_robot'] as const

/**
 * 🔴🔴 LOS TOPICS DEL MURO A LOS QUE SE SUSCRIBE **SIN CAUDAL MEDIDO**.
 *
 * Encontrado el 2026-08-11, y era un presupuesto que no sumaba lo que gasta:
 * `TOPICS_MURO` declaraba DOS topics mientras `BaldosaConectada` se suscribía a
 * TRES. El tercero —`/estado_robot`, añadido el 2026-08-04— nunca entró aquí, y
 * la cifra que el muro enseña llevaba desde entonces **por debajo de lo real**.
 *
 * 🔴 Y el número que circulaba por el código («~0,03 kB/s por robot», en el
 *    comentario de `BaldosaConectada` y en el mensaje de commit del robot) **no
 *    está medido**: la evidencia 68 midió SEIS topics y `/estado_robot` no es
 *    ninguno — no existía todavía. Ese 0,03 es el de `/battery_state`, que
 *    publica **cada 30 s** (0,07 Hz medidos) mientras `/estado_robot` va a
 *    **1 Hz**. Copiarlo es la trampa que este proyecto ya tiene escrita: *una
 *    cifra correcta en su contexto se vuelve falsa al mudarla de sitio*.
 *
 * 📌 Por comparación, `/motor_status` —también 1 Hz, y de tamaño parecido— mide
 *    **0,45 kB/s**. O sea que lo más probable es que el muro cueste **un orden
 *    de magnitud más** de lo que decía. Pero eso es una comparación, no una
 *    medida, y aquí dentro no entra: se pide al robot y se espera.
 *
 * Mientras tanto la cifra del muro se presenta como lo que es —un **mínimo**— y
 * se dice qué falta. Cambiar un error silencioso por uno declarado no arregla el
 * número, pero deja de fingir que está completo.
 */
export const MURO_SIN_CAUDAL_MEDIDO = ['/estado_robot'] as const

/**
 * kB/s totales de `robots` robots suscritos a `topics`.
 *
 * 🔴 Lanza si un topic no tiene caudal medido, nombrandolo. Y lanza si `robots`
 * no es un entero >= 0: un numero negativo daria un presupuesto negativo, que
 * «cabe» en cualquier limite.
 *
 * 📝 Un topic REPETIDO en la lista se suma dos veces, a proposito. Es un error
 * de quien arma la lista, y el lado seguro del error en un presupuesto de ancho
 * de banda es SOBREestimar: deduplicar en silencio daria un numero mas bonito y
 * mas bajo que el real.
 */
export function caudalDeFlota(topics: readonly string[], robots: number): number {
  if (!Number.isInteger(robots) || robots < 0) {
    throw new Error(`el numero de robots tiene que ser un entero >= 0, y llego «${robots}»`)
  }
  let porRobot = 0
  for (const topic of topics) {
    const kbs = CAUDAL_KBS[topic]
    if (kbs === undefined) {
      throw new Error(
        `«${topic}» no tiene caudal MEDIDO en CAUDAL_KBS: no se puede presupuestar lo que nadie ha ` +
          'medido, y devolver 0 seria aprobar sin sumar. Midelo en el robot y añadelo aqui.',
      )
    }
    porRobot += kbs
  }
  return porRobot * robots
}

/**
 * Lo que cuesta el muro con `robots` baldosas, **diciendo lo que no ha podido
 * sumar**.
 *
 * Devuelve un objeto y no un número a propósito: un número suelto se pinta como
 * si fuera el total, y aquí NO lo es mientras quede un topic sin medir. Es la
 * misma decisión que `confirmaEfecto()`, que dejó de devolver un booleano
 * porque el tipo prometía una confirmación que ningún servicio daba.
 *
 * `kbs` es un **suelo**: lo que suman los topics con caudal medido.
 */
export function presupuestoMuro(robots: number): {
  kbs: number
  sinMedir: readonly string[]
  completo: boolean
} {
  const medidos = TOPICS_MURO.filter(
    (t) => !(MURO_SIN_CAUDAL_MEDIDO as readonly string[]).includes(t),
  )
  const sinMedir = TOPICS_MURO.filter(
    (t) => (MURO_SIN_CAUDAL_MEDIDO as readonly string[]).includes(t),
  )
  return { kbs: caudalDeFlota(medidos, robots), sinMedir, completo: sinMedir.length === 0 }
}
