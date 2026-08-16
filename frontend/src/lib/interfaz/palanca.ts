/**
 * LA PALANCA — de dónde está el dedo a qué se le pide al robot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 POR QUÉ UNA PALANCA Y NO LA CRUZ (2026-08-16)
 * ═══════════════════════════════════════════════════════════════════════════
 * Pedido por el usuario. Y la cruz tenía un límite real: **cuatro botones son
 * cuatro órdenes**. Para trazar un arco había que pulsar «adelante», soltar,
 * pulsar «izquierda» — o sea conducir a saltos. Una palanca da las dos
 * componentes **en un gesto**, que es lo que hace un mando de verdad.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y AQUÍ ESTÁ EL PROBLEMA HONESTO DE UNA PALANCA ANALÓGICA
 * ═══════════════════════════════════════════════════════════════════════════
 * Una palanca continua **puede pedir cualquier valor**, y de este robot solo hay
 * medida una franja:
 *
 *   lineal    0,20 m/s → meseta real 0,199 (100 %) · 0,40 → 0,401 (100 %)
 *   angular   entre 0,5 y 2,0 rad/s cumple el 99-102 % de lo comandado
 *
 * **Por debajo de eso no hay medida.** Un mando que deje pedir 0,02 m/s o
 * 0,1 rad/s está prometiendo un comportamiento que nadie ha comprobado — y en un
 * robot con orugas lo más probable es que ni se mueva, con lo que el alumno
 * concluye «no obedece» sobre un robot sano. Es exactamente la familia de fallo
 * que este proyecto persigue.
 *
 * → **La magnitud se remapea a la franja MEDIDA.** Fuera de la zona muerta, lo
 *   mínimo que se puede pedir es el suelo caracterizado; dentro, cero. Así toda
 *   orden que sale de aquí cae en territorio conocido.
 *
 * 📌 Es la misma decisión que ya tomó la cruz sin decirlo: ofrecía DOS
 *   velocidades, las dos medidas, y un giro fijo de 0,8 rad/s que está dentro de
 *   la banda. Lo que cambia es que ahora es continuo y hay que decirlo.
 */

/** Lo que se le pide al robot. `v` en m/s, `w` en rad/s. */
export interface OrdenMando {
  v: number
  w: number
}

/**
 * 🔴 ZONA MUERTA DEL 18 %, y no es un número redondo por casualidad.
 *
 * Sin ella, soltar el dedo a un píxel del centro deja al robot con una orden
 * mínima puesta, y el bucle de 10 Hz la republica hasta que alguien suelte. Con
 * un ratón se nota; con un dedo en una tableta, no.
 *
 * ⚠️ Y tiene que ser MAYOR que el ruido de un puntero fino: un temblor de 2-3 px
 *    sobre un radio de 84 px es ~3 %. El 18 % deja margen de sobra sin comerse
 *    el recorrido útil, que sigue siendo el 82 %.
 */
export const ZONA_MUERTA = 0.18

/**
 * El suelo del giro, en rad/s. **Medido**: entre 0,5 y 2,0 el robot cumple el
 * 99-102 % de lo que se le pide. Por debajo de 0,5 no hay ninguna medida.
 */
export const W_MIN = 0.5

/**
 * El techo del giro que ofrece esta pantalla, en rad/s.
 *
 * ⚠️ La banda medida llega a 2,0 y aquí se para en 1,2. No es timidez: 2,0 rad/s
 *    son ~115 °/s, o sea media vuelta por segundo, y esta pantalla se usa con el
 *    robot a un metro y mirando la pantalla. La cruz usaba 0,8 fijo; esto lo
 *    rodea por los dos lados.
 */
export const W_MAX = 1.2

/**
 * El suelo de la velocidad lineal, en m/s.
 *
 * 🔴 Es la más baja de las DOS que esta pantalla ofrecía y que están medidas.
 *    Por debajo no hay dato — y con orugas sobre suelo de aula, «no hay dato»
 *    puede significar «no arranca», que se lee como avería.
 */
export const V_MIN = 0.10

/**
 * Remapea `t` desde la zona muerta hasta el borde, sobre `[min, max]`.
 *
 * 🔴 EL SALTO EN EL BORDE DE LA ZONA MUERTA ES DELIBERADO. Al cruzarla, lo
 *    primero que se pide es `min` —no cero—, así que el robot **arranca de
 *    verdad**. Un arranque suave desde cero sería más bonito y pediría valores
 *    que nadie ha medido durante todo el tramo inicial.
 */
function escalar(t: number, min: number, max: number): number {
  if (t <= ZONA_MUERTA) return 0
  const util = (t - ZONA_MUERTA) / (1 - ZONA_MUERTA)
  return min + util * (max - min)
}

/**
 * De un desplazamiento del puntero a una orden.
 *
 * @param dx     píxeles a la derecha del centro
 * @param dy     píxeles hacia ABAJO del centro (como el DOM)
 * @param radio  radio útil de la palanca, en píxeles
 * @param vMax   el techo lineal que haya puesto el deslizador, en m/s
 *
 * 🔴 IZQUIERDA ES `w` POSITIVA. Es REP-103 —antihorario positivo— y el SDK del
 *    RVR lo cumple: está verificado mirando el robot, no deducido. La cruz ya lo
 *    hacía así (`Izquierda` → `w: 1`), y cambiarlo aquí habría hecho que dos
 *    mandos de la misma pantalla giraran al revés.
 */
export function ordenDePalanca(dx: number, dy: number, radio: number, vMax: number): OrdenMando {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radio > 0)) return { v: 0, w: 0 }

  /*
   * 🔴 SE RECORTA EL VECTOR ENTERO, no cada eje por su cuenta. Recortando por
   *    eje, arrastrar a una esquina daría magnitud √2 — o sea que la diagonal
   *    pediría un 41 % más que cualquier otra dirección, y el robot trazaría
   *    arcos más rápidos cuanto más diagonal fuera el gesto.
   */
  const m = Math.hypot(dx, dy)
  const escala = m > radio ? radio / m : 1
  const nx = (dx * escala) / radio
  // El DOM crece hacia abajo y «adelante» es hacia arriba.
  const ny = -(dy * escala) / radio

  /*
   * La zona muerta se mide sobre el VECTOR, no sobre cada eje: si no, un gesto
   * casi vertical con 0,17 de componente horizontal saldría con `w = 0` mientras
   * su magnitud total ya está fuera de la zona muerta — el robot iría recto
   * cuando el dedo dice que gire un poco.
   */
  if (Math.hypot(nx, ny) <= ZONA_MUERTA) return { v: 0, w: 0 }

  return {
    v: Math.sign(ny) * escalar(Math.abs(ny), V_MIN, vMax),
    w: -Math.sign(nx) * escalar(Math.abs(nx), W_MIN, W_MAX),
  }
}

/**
 * ¿Está esta orden dentro de lo que se ha medido de este robot?
 *
 * 🔴 EXISTE PARA PODER DECIRLO EN PANTALLA, no para bloquear nada.
 *    `ordenDePalanca` ya remapea a la franja medida, así que hoy siempre es
 *    `true` — y precisamente por eso hace falta: es el control que se pondría
 *    rojo el día que alguien cambie el remapeo y empiece a pedir valores que
 *    nadie ha comprobado.
 */
export function dentroDeLoMedido(o: OrdenMando, vMax: number): boolean {
  const vOk = o.v === 0 || (Math.abs(o.v) >= V_MIN - 1e-9 && Math.abs(o.v) <= vMax + 1e-9)
  const wOk = o.w === 0 || (Math.abs(o.w) >= W_MIN - 1e-9 && Math.abs(o.w) <= W_MAX + 1e-9)
  return vOk && wOk
}
