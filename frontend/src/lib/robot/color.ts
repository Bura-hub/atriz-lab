/**
 * EL SENSOR DE COLOR Y SUS DOS MODOS. PURO: sin React y sin red.
 *
 * Todo lo de aquí sale de `03_operacion/SENSOR_COLOR.md` del repositorio de
 * migración, medido en rvr-01 el 2026-08-08 (evidencia 86). Ni un número está
 * puesto a ojo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL MISMO COCIENTE SIGNIFICA COSAS DISTINTAS EN CADA MODO
 * ═══════════════════════════════════════════════════════════════════════════
 * No es un matiz: es **la** razón de que este fichero exista. Medido sobre una
 * pantalla de móvil, sin mover el robot entre colores:
 *
 *              luz APAGADA (emisión)        luz ENCENDIDA (reflejo)
 *             R/G     B/G    claro         R/G     B/G    claro
 *   ROJO     5.12    0.15      150        0.66    0.49     1238
 *   VERDE    0.17    0.20      387        0.37    0.40     1467
 *   AZUL     0.11    4.57      190        0.46    0.73     1230
 *
 * ✅ Apagada, los tres se separan por un factor **25-30**.
 * 🔴 Encendida, los seis cocientes viven entre **0,37 y 0,73**: el reflejo lo
 *    aplana todo, y el rojo da `R/G = 0,66` —**menos rojo que verde** sobre una
 *    pantalla roja a tope—. No pierde precisión: **engaña**.
 *
 * → Por eso `interpretar()` **exige el modo** y no acepta un valor por defecto.
 *   Una función que adivinara el modo produciría justo la lectura invertida.
 */

/** Con luz: superficies mates. Sin luz: superficies que emiten. */
export type Modo = 'REFLEJO' | 'EMISION'

export interface Lectura {
  rojo: number
  verde: number
  azul: number
  claro: number
  /** 🔴 EL DISCRIMINANTE. `claro = 0` NO es un fallo: ver `hayLectura()`. */
  success: boolean
  /** Del driver, tal cual. Avisa cuando la luz está apagada. */
  message: string
}

export interface Proporciones {
  rg: number
  bg: number
  /**
   * 🔴 EL VERDE CRUDO VIAJA CON EL COCIENTE, y no es redundante: un cociente sin
   *    su denominador **no dice si significa algo**. `R/G = 0` con G = 1 y con
   *    G = 400 son el mismo número y dos hechos distintos.
   */
  verde: number
}

/**
 * 🔴 `null` CUANDO EL VERDE ES CERO, y ese caso OCURRE — no es defensa teórica.
 *
 * La casilla «refleja + luz apagada» del 2×2 dio **cero absoluto**: los cuatro
 * canales a 0, doce lecturas, dispersión 0, **y `success=True` en las doce**.
 * Son doce lecturas válidas que valen cero, no doce ausencias de respuesta.
 * Dividir ahí daría `Infinity` o `NaN`, y `NaN > 1` es `false`, así que un
 * clasificador descuidado lo llamaría «verde» con toda tranquilidad.
 */
export function proporciones(l: Pick<Lectura, 'rojo' | 'verde' | 'azul'>): Proporciones | null {
  if (!Number.isFinite(l.verde) || l.verde === 0) return null
  if (!Number.isFinite(l.rojo) || !Number.isFinite(l.azul)) return null
  return { rg: l.rojo / l.verde, bg: l.azul / l.verde, verde: l.verde }
}

/**
 * ¿Hay señal? 🔴 **El discriminante es `success`, NO el valor de `claro`.**
 *
 * Lo dice el contrato del robot con esas palabras, y tiene una medida detrás:
 * en modo emisión `claro = 42` es una lectura **excelente** —el color sale
 * inconfundible porque el suelo de ruido es CERO— mientras que esas mismas 42
 * cuentas en modo reflejo serían oscuridad. **El umbral de «hay señal» depende
 * del modo y no se puede copiar de uno a otro**, así que no se pone ninguno.
 */
export const hayLectura = (l: Lectura): boolean => l.success

export type Veredicto = 'ROJO' | 'VERDE' | 'AZUL' | 'NO_SE_PUEDE_DECIR'

/**
 * 🔴🔴 EL MINIMO PARA QUE UN COCIENTE SIGNIFIQUE ALGO — y esto lo encontró el
 *      ROBOT, no una prueba.
 *
 * Validando contra rvr-01 el 2026-08-09, con el robot sobre **suelo mate** y en
 * modo emisión —o sea la casilla del cero absoluto—, el sensor devolvió:
 *
 *     R = 0   G = 1   B = 0   claro = 1
 *
 * `proporciones()` calculó `R/G = 0` y `B/G = 0`, los dos por debajo de 1, y
 * `interpretar()` concluyó **VERDE** — porque en modo emisión verde es el caso
 * POR DESCARTE. La pantalla afirmó *«la luz que sale de la superficie es
 * verde»* sobre un suelo a oscuras.
 *
 * 📝 Y había una prueba escrita **contra este mismo fallo**: comprobaba
 *    `verde === 0`. Aquí verde vale **1**. Una sola cuenta de ruido se cuela por
 *    el borde de la guarda. Es literalmente la lección que este proyecto tiene
 *    escrita —«un test que barre tres puntos representativos puede dejar sin
 *    cubrir justo el tramo donde vive el bug»—, cometida por mí, en el fichero
 *    donde la cité.
 *
 * ── POR QUE 10, Y NO UN NUMERO CUALQUIERA ─────────────────────────────────
 * Las cuentas son ENTERAS. El error de cuantización de `R/G` es ±1/G, así que
 * con G = 1 el cociente tiene un **±100 %** de error: no distingue 0,9 de 1,1,
 * que es justo la frontera con la que se decide el color. Pedir que el cociente
 * quede resuelto mejor que el 10 % da **G ≥ 10**. Es una derivación, no una
 * medida.
 *
 * ⚠️ Y NO se sabe dónde está el suelo de verdad: el propio documento del robot
 *    dice que «dónde está el límite por abajo sigue **sin medir**». La lectura
 *    válida más tenue que existe es `claro = 42`. Este umbral es conservador por
 *    el lado seguro —callarse— y **hay que remedirlo** el día que alguien
 *    caracterice una baldosa de verdad.
 */
export const VERDE_MINIMO_PARA_DECIDIR = 10

/**
 * 🔴 LA BANDA EN LA QUE EL REFLEJO NO DISTINGUE NADA.
 *
 * Con la luz encendida, una pantalla roja a tope da `R/G = 0,53` y un papel azul
 * claro `0,42`: **casi el mismo número**. Los seis cocientes medidos sobre
 * superficies luminosas caen entre 0,37 y 0,73. Dentro de esa banda la interfaz
 * **no nombra un color**, porque nombrarlo sería acertar o invertir según lo que
 * haya debajo — y el sensor no sabe cuál de las dos cosas es.
 */
export const BANDA_PLANA = { min: 0.35, max: 0.80 }

/**
 * 📌 Una superficie roja **mate** da `R/G = 2,74` con la luz encendida, contra
 *    0,66 sobre vidrio emisor. Este umbral separa lo primero de la banda plana
 *    con margen por los dos lados; no es un valor medido, es una frontera puesta
 *    ENTRE dos medidas, y por eso está lejos de las dos.
 */
export const UMBRAL_REFLEJO = 1.5

/**
 * El color, **con el modo obligatorio**.
 *
 * - **EMISIÓN**: la regla sale sola de la separación de 25-30×:
 *   `R/G > 1` → rojo · `B/G > 1` → azul · las dos bajas → verde.
 * - **REFLEJO**: solo se nombra un color si el cociente está claramente FUERA de
 *   la banda plana. Dentro, `NO_SE_PUEDE_DECIR` — que es un resultado, no un
 *   fallo.
 */
export function interpretar(p: Proporciones | null, modo: Modo): Veredicto {
  if (p === null) return 'NO_SE_PUEDE_DECIR'
  if (!Number.isFinite(p.rg) || !Number.isFinite(p.bg)) return 'NO_SE_PUEDE_DECIR'

  if (modo === 'EMISION') {
    // 🔴 Rojo y azul se comprueban antes que verde, y el orden importa: verde es
    //    «ninguno de los dos», o sea el caso por descarte. Con la separación
    //    medida (25-30×) no hay empates reales, pero si los hubiera, decir
    //    «verde» por defecto sería inventar.
    if (p.rg > 1 && p.bg > 1) return 'NO_SE_PUEDE_DECIR'
    if (p.rg > 1) return 'ROJO'
    if (p.bg > 1) return 'AZUL'
    /*
     * 🔴 Y AQUI NO SE PUEDE CAER POR DESCARTE SI NO HAY SEÑAL. Con G = 1 los dos
     *    cocientes valen 0, los dos son «≤ 1», y sin esta guarda el resultado es
     *    un VERDE afirmado sobre ruido. Medido en el robot: suelo mate en modo
     *    emisión dio (0, 1, 0) y la pantalla dijo «es verde».
     */
    if (p.verde < VERDE_MINIMO_PARA_DECIDIR) return 'NO_SE_PUEDE_DECIR'
    return 'VERDE'
  }

  if (p.rg >= UMBRAL_REFLEJO) return 'ROJO'
  if (p.bg >= UMBRAL_REFLEJO) return 'AZUL'
  // Fuera de la banda por ABAJO en las dos: queda verde, que es lo que hace un
  // seguidor de línea sobre superficie mate.
  if (p.rg < BANDA_PLANA.min && p.bg < BANDA_PLANA.min) return 'VERDE'
  return 'NO_SE_PUEDE_DECIR'
}

/**
 * Por qué no se puede decir, en palabras. 🔴 Un «no se sabe» sin motivo manda a
 * buscar una avería; con motivo manda a cambiar de modo, que es la acción real.
 */
export function motivoDeDuda(p: Proporciones | null, modo: Modo): string {
  if (p === null) {
    return 'El canal verde vale cero, así que no hay proporción que calcular. '
      + 'En modo emisión eso significa que debajo no hay nada encendido; en modo '
      + 'reflejo, que la luz del sensor está apagada.'
  }
  if (modo === 'REFLEJO') {
    return 'Los cocientes caen en la banda donde el reflejo del propio LED lo aplana todo: '
      + 'ahí una pantalla roja a tope da 0,53 y un papel azul claro 0,42, casi el mismo número. '
      + 'Si la superficie EMITE luz, cambia al modo emisión — con la luz encendida el resultado '
      + 'no es impreciso, es que sale invertido.'
  }
  if (p.verde < VERDE_MINIMO_PARA_DECIDIR) {
    return 'Casi no llega luz: el canal verde vale ' + String(p.verde) + ', y con tan pocas cuentas '
      + 'el cociente no distingue un color de otro —una sola cuenta de ruido lo cambia entero—. '
      + 'Si la superficie debería estar encendida, súbele el brillo; si es una superficie normal, '
      + 'cambia al modo de superficie normal para que el robot la ilumine.'
  }
  return 'Los dos cocientes salen por encima de 1 a la vez, que no es ninguno de los tres '
    + 'colores medidos. Mira lo que hay debajo del robot.'
}

/** El nombre del modo para la persona, no para el código. */
export const NOMBRE_MODO: Record<Modo, string> = {
  REFLEJO: 'superficie normal',
  EMISION: 'superficie luminosa',
}

/** Si la luz del sensor debe estar encendida en ese modo. Es lo que se le pide a `/enable_color`. */
export const LUZ_DE = (m: Modo): boolean => m === 'REFLEJO'

/**
 * 🔴 `color_activo` NO es «el sensor sirve»: es «la luz está encendida».
 *
 * El contrato del robot lo prohíbe con esas palabras — presentarlo como «sensor
 * apagado» o «no disponible» sería mentir en modo emisión, donde tener la luz
 * apagada es **el estado correcto** y el sensor está midiendo.
 *
 * Devuelve si lo que dice el robot **concuerda con el modo elegido**, que es la
 * única pregunta útil: `null` mientras no se sepa.
 */
export function luzConcuerda(colorActivo: boolean | null, modo: Modo): boolean | null {
  if (colorActivo === null) return null
  return colorActivo === LUZ_DE(modo)
}
