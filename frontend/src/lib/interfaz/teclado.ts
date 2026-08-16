/**
 * CONDUCIR CON EL TECLADO — la parte que se puede probar sin navegador.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ HACÍA FALTA: EL MANDO PROMETÍA TECLADO Y NO LO TENÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Las cuatro celdas de la cruz llevan `focus-ring` desde que existen, o sea que
 * **se pueden enfocar con el tabulador** — y una vez enfocado, `Enter` o
 * `Espacio` disparan `click`… que en este mando **no hace nada**, porque conduce
 * con `pointerdown`/`pointerup`. La interfaz decía «puedes usar el teclado» con
 * un anillo de foco y no cumplía.
 *
 * Y en el aula importa más que la accesibilidad genérica: un alumno con el robot
 * delante y una cinta en la otra mano no está mirando la pantalla para apuntar
 * con el ratón.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 UNA DIRECCIÓN A LA VEZ, IGUAL QUE LOS BOTONES
 * ═══════════════════════════════════════════════════════════════════════════
 * No se combinan teclas para trazar curvas. La cruz de mando tampoco lo hace
 * —sus cuatro celdas son excluyentes— y dos formas de conducir que se comportan
 * distinto sobre el mismo robot es cómo alguien aprende una y se confunde con la
 * otra. Manda **la última pulsada**, que es lo que hace cualquier mando.
 */

/** Lo que se le pide al robot: `v` adelante/atrás, `w` giro. Normalizados. */
export interface Direccion {
  v: number
  w: number
  /** El mismo nombre que la celda de la cruz, para poder decirlo en pantalla. */
  etiqueta: string
}

/**
 * 🔴 FLECHAS **Y** WASD. Las flechas son la convención; WASD deja la mano
 *    izquierda libre para el ratón y es lo que un alumno de esta edad tiene en
 *    los dedos. Ninguna de las dos sobra.
 *
 * ⚠️ Las letras se comparan en MINÚSCULA: con Bloq Mayús puesto —o con Shift—
 *    `event.key` llega como `'W'`, y comparar contra `'w'` a secas dejaría el
 *    teclado muerto sin decir por qué.
 */
const TECLAS: Readonly<Record<string, Direccion>> = {
  arrowup: { v: 1, w: 0, etiqueta: 'Adelante' },
  w: { v: 1, w: 0, etiqueta: 'Adelante' },
  arrowdown: { v: -1, w: 0, etiqueta: 'Atrás' },
  s: { v: -1, w: 0, etiqueta: 'Atrás' },
  arrowleft: { v: 0, w: 1, etiqueta: 'Izquierda' },
  a: { v: 0, w: 1, etiqueta: 'Izquierda' },
  arrowright: { v: 0, w: -1, etiqueta: 'Derecha' },
  d: { v: 0, w: -1, etiqueta: 'Derecha' },
}

/** La dirección de una tecla, o `null` si esa tecla no conduce. */
export function direccionDeTecla(tecla: string): Direccion | null {
  return TECLAS[tecla.toLowerCase()] ?? null
}

/**
 * ¿Esta pulsación va para el robot, o para algo que se está escribiendo?
 *
 * 🔴🔴 SIN ESTO, ESCRIBIR UNA `a` EN UN CAMPO PONDRÍA EL ROBOT A GIRAR. Y esta
 *      aplicación tiene campos por todas partes: el editor del Taller, el
 *      cuaderno, el hexadecimal del selector de color, el buscador de robots.
 *      Es el mismo error de forma que el `click` sintético del mapa —un gesto
 *      que significa dos cosas y la que MUEVE EL ROBOT gana—, y ahí costó que
 *      el robot se enredara con unos cables.
 *
 * ⚠️ `isContentEditable` se pasa aparte y no se deduce de la etiqueta: un `div`
 *    editable no es ningún `INPUT` y sería exactamente el caso que se cuela.
 */
export function escribiendo(etiqueta: string, editable: boolean): boolean {
  if (editable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(etiqueta.toUpperCase())
}

/**
 * Qué dirección manda, dadas las teclas que siguen pulsadas EN ORDEN de
 * pulsación.
 *
 * 🔴 GANA LA ÚLTIMA, no la primera, y no es indiferente: quien va hacia delante
 *    y pulsa «izquierda» sin soltar espera girar, no seguir recto. Y al soltar
 *    la de girar, vuelve a la que seguía pulsada — que es lo que hace un mando
 *    de verdad.
 *
 * @returns `null` cuando no queda ninguna: entonces hay que PARAR.
 */
export function mandoVigente(pulsadas: readonly string[]): Direccion | null {
  for (let i = pulsadas.length - 1; i >= 0; i--) {
    const d = direccionDeTecla(pulsadas[i])
    if (d !== null) return d
  }
  return null
}

/**
 * Añade una tecla a la lista de pulsadas, sin repetirla.
 *
 * 🔴 EL AUTO-REPEAT DEL SISTEMA DISPARA `keydown` UNA Y OTRA VEZ mientras la
 *    tecla sigue abajo. Sin esta guarda, la lista crecería sin límite y —peor—
 *    la misma tecla aparecería varias veces, así que soltarla una vez no la
 *    quitaría del todo y **el robot seguiría andando con la tecla suelta**.
 */
export function conTecla(pulsadas: readonly string[], tecla: string): string[] {
  const k = tecla.toLowerCase()
  return pulsadas.includes(k) ? [...pulsadas] : [...pulsadas, k]
}

/** Quita una tecla al soltarla. Quita TODAS sus apariciones, por si acaso. */
export function sinTecla(pulsadas: readonly string[], tecla: string): string[] {
  const k = tecla.toLowerCase()
  return pulsadas.filter((p) => p !== k)
}
