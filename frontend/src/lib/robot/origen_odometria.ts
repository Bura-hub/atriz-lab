/**
 * ¿SE HA PUESTO LA ODOMETRÍA A CERO DE VERDAD? PURO, y por eso se puede probar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 `/set_pos_and_yaw` DEVUELVE `bool success`, Y ESO NO ES EL EFECTO
 * ═══════════════════════════════════════════════════════════════════════════
 * `contrato.ts` lo clasifica como `'SOLO_QUE_NO_LANZO'`: ese booleano sale de
 * `ok, _, _ = self._pedir(...)` en el driver, o sea **la corrutina del SDK no
 * lanzó en 5 s**. No dice que el locator se reiniciara.
 *
 * Pero aquí, al contrario que con la parada, el efecto **se puede ver**: `/odom`
 * publica a 16,5 Hz y tras el reinicio tiene que traer la posición y el rumbo a
 * cero. Así que la pantalla no se cree el `success`: mira el topic.
 *
 * ⚠️ Y NO hace falta el truco del `latido` que sí necesita la parada: `/odom` es
 *    un flujo BEST_EFFORT, no va latcheado, así que no hay ningún «último valor
 *    enlatado de antes de la llamada» que pueda colarse como prueba. La trampa
 *    de `TRANSIENT_LOCAL` es de `/estado_robot`, no de este.
 */

/**
 * Tolerancia de posición, en metros.
 *
 * 📝 1 cm y no 0: entre la llamada y la comprobación caben muestras en vuelo, y
 *    el locator del RVR acierta con 1 mm en 1 m —o sea que 1 cm es diez veces su
 *    error propio y sigue siendo mucho menos que cualquier desplazamiento real
 *    que alguien quisiera borrar.
 */
export const TOLERANCIA_POSICION_M = 0.01

/** Tolerancia de rumbo, en grados. El giro cerrado del robot acierta a 0,74°. */
export const TOLERANCIA_YAW_GRADOS = 1

export interface Pose {
  x: number
  y: number
  /** En GRADOS, ya convertido. Aquí no se hacen cuaterniones. */
  yawGrados: number
}

/**
 * ¿Está esta pose en el origen?
 *
 * ⚠️ Devuelve `false` ante cualquier valor no finito. Un `NaN` comparado con un
 *    umbral da `false` en las dos direcciones, así que sin esta comprobación un
 *    dato roto podría leerse como «no se reinició» —que suena a diagnóstico— en
 *    vez de como «no se sabe». Es la misma disciplina que `limitar()` en
 *    `atriz.py`, donde no comprobarlo mapeó lo peor al máximo.
 */
export function enElOrigen(p: Pose): boolean {
  const finitos = [p.x, p.y, p.yawGrados].every((n) => Number.isFinite(n))
  if (!finitos) return false
  return (
    Math.abs(p.x) <= TOLERANCIA_POSICION_M
    && Math.abs(p.y) <= TOLERANCIA_POSICION_M
    && Math.abs(p.yawGrados) <= TOLERANCIA_YAW_GRADOS
  )
}

/** Cuánto se ha movido el origen. Es lo que se le enseña a quien pulsó. */
export function distanciaAlOrigen(p: Pose): number {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return NaN
  return Math.hypot(p.x, p.y)
}
