/**
 * El presupuesto de ancho de banda del muro del profesor: lo que impide que
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
 * profesor que pida 1 Hz sobre `/scan` recibira a 16,5 en cuanto un alumno abra
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
 * Los dos unicos topics del muro del profesor: **0,48 kB/s por robot**, 7,7 kB/s
 * con los 16. Con `/odom` dentro se pasaria de 200 kB/s, que sobre una sola AP
 * compartida con los portatiles del aula es otra conversacion.
 *
 * `/motor_status` va a 1 Hz (el driver lo republica con su propio temporizador,
 * `create_timer(1.0, ...)`), asi que ademas de la salud de motores es el LATIDO
 * del muro: sigue llegando aunque el RVR este apagado, lo que distingue «la Pi
 * esta viva» de «no hay nadie». `/battery_state` va cada 30,0 s y trae el
 * `voltage`, que es lo unico que decide si hay que cargar.
 */
export const TOPICS_MURO = ['/battery_state', '/motor_status'] as const

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
