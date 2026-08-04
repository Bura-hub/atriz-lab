/**
 * EL BARRIDO DEL LIDAR, CONVERTIDO A PUNTOS. PURO: sin React y sin canvas.
 *
 * Toda la geometria vive aqui para que se pueda probar en Node. El componente
 * solo dibuja lo que esto devuelve.
 */

import { MensajeScan } from '../../hooks/useTopic'

/** Un punto en el marco del ROBOT: x adelante, y a la izquierda (REP-103). */
export interface Punto { x: number; y: number }

/**
 * 🔴 EL LIDAR NO ESTA EN EL CENTRO DEL ROBOT.
 *
 * Medido con cinta el 2026-08-02: el chasis mide 19,0 cm de frente a atras, o
 * sea centro geometrico en 9,5; y el centro del tambor esta a 9,0 cm del borde
 * trasero. **`laser_x = -0.005 m`**: medio centimetro POR DETRAS del centro.
 *
 * El modelo decia `0`, anotado «centrado» **sin cinta detras** — igual que
 * `laser_z`, que al medirse resulto estar 2 cm mal. Lo destapo una discrepancia
 * de ~2 cm entre lo que leia `/scan` y lo que se media en el suelo.
 */
export const LASER_X = -0.005
export const LASER_Y = 0

/**
 * Convierte un `LaserScan` en puntos del marco del robot, **descartando los
 * invalidos**.
 *
 * 🔴 Los huecos NO son ceros. Medido contra el robot el 2026-08-04: **260 puntos
 * por barrido**, de los que el **83-89 % son validos**; el resto llegan como
 * `Infinity` o `NaN`. Pintar un hueco como 0 dibuja un obstaculo pegado al robot
 * que no existe — y sobre una pantalla de seguridad eso es peor que no dibujar
 * nada.
 *
 * 📝 Se recorre `ranges.length`, NO un tamaño supuesto. Hoy salen 260 en las 35
 * tomas, pero con `fixed_resolution: false` el X2 alternaba 254/255 y
 * `slam_toolbox` descartaba barridos enteros por haber registrado el sensor con
 * el tamaño del PRIMERO.
 */
export function puntosDelBarrido(s: MensajeScan): Punto[] {
  const puntos: Punto[] = []
  for (let i = 0; i < s.ranges.length; i++) {
    const r = s.ranges[i]
    // Las tres condiciones hacen falta: `isFinite` descarta Infinity y NaN, y
    // los limites descartan lo que el propio sensor declara fuera de rango.
    if (!Number.isFinite(r) || r < s.range_min || r > s.range_max) continue
    const a = s.angle_min + i * s.angle_increment
    puntos.push({ x: LASER_X + r * Math.cos(a), y: LASER_Y + r * Math.sin(a) })
  }
  return puntos
}

/** Cuantos de los `ranges` eran utilizables. Se enseña: 89 % es lo NORMAL. */
export function contarValidos(s: MensajeScan): { validos: number; total: number } {
  return { validos: puntosDelBarrido(s).length, total: s.ranges.length }
}

/**
 * La distancia libre mas corta del barrido, en metros, o `null` si no hay ni un
 * punto valido.
 *
 * ⚠️ **No es «la distancia al obstaculo mas cercano» de forma fiable**, y
 * conviene no venderla asi: el X2 tira un rayo cada 1,7 cm a 0,68 m, asi que un
 * objeto fino de 5 cm da 2-3 puntos y **en un barrido suelto puede desaparecer**.
 * Vale para orientarse, no para decidir.
 */
export function distanciaMinima(s: MensajeScan): number | null {
  let min = Infinity
  for (let i = 0; i < s.ranges.length; i++) {
    const r = s.ranges[i]
    if (!Number.isFinite(r) || r < s.range_min || r > s.range_max) continue
    if (r < min) min = r
  }
  return min === Infinity ? null : min
}

/**
 * Escala metros -> pixeles para que quepa `radioM` metros en un lienzo de
 * `ladoPx` pixeles, con el robot en el centro.
 */
export function escala(ladoPx: number, radioM: number): number {
  return (ladoPx / 2) / radioM
}
