/**
 * CUÁNTO DURA LA ENTRADA EN CASCADA. Puro: sin React, sin DOM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EXISTE ESTE FICHERO: LA CASCADA SE REPETÍA EN CADA PESTAÑA
 * ═══════════════════════════════════════════════════════════════════════════
 * `.escalonado` vive en el `<main>` del marco del robot, y el `<main>` **no se
 * desmonta** al cambiar de pestaña — lo que se desmonta y vuelve a montar son
 * sus hijos. Resultado: la cascada de entrada se reproducía **entera en cada
 * clic**, y con ella ~540 ms de tarjetas apareciendo.
 *
 * Eso no se notaba cuando la navegación costaba lo que costaba en el servidor
 * de desarrollo. Medido el 2026-08-17, contra rvr-01 encendido:
 *
 *     por pestaña          next dev en frío   next dev caliente   PRODUCCIÓN
 *     ida y vuelta            1369-1665 ms       195-238 ms        13-39 ms
 *
 * 🔴 En producción la navegación cuesta **~20 ms**, así que esta animación
 *    pasó a ser **el 96 % de lo que la persona espera**. Dejó de ser un adorno
 *    encima del tiempo de carga: se convirtió EN el tiempo de carga.
 *
 * → El arreglo no es quitar la cascada —entrar al robot sigue teniendo su
 *   momento orquestado, igual que el muro—, es que **no se repita al cambiar de
 *   pestaña**. Ver `MarcoRobot`.
 *
 * ⚠️ Y una lección de método que conviene no perder: la lentitud se atribuyó
 *    primero a la aplicación, luego a las extensiones del navegador, y las dos
 *    veces se midió que no. **Era el servidor de desarrollo**, o sea el
 *    instrumento con el que se estaba juzgando. Van nueve veces en este
 *    proyecto que miente el medidor y no lo medido.
 */

/**
 * Los retardos de `.escalonado > * > *:nth-child(...)`, en el orden de la hoja.
 *
 * ⚠️ NO son decorativos: el quinto y siguientes comparten el último, así que la
 *    cascada no crece sin fin por muchas tarjetas que tenga una pestaña.
 */
export const RETARDOS_CASCADA_MS = [0, 55, 110, 165, 220] as const

/** `--t-entrada`: lo que tarda UNA tarjeta en entrar. */
export const DURACION_ENTRADA_MS = 320

/**
 * Cuándo ha terminado de aparecer la última tarjeta: el mayor retardo más la
 * duración.
 *
 * 🔴 Este número está escrito a mano y la hoja de estilo podría cambiar sin él.
 *    Por eso `cascada.test.ts` lo COMPARA CON `globals.css` y se pone en rojo si
 *    se separan — es la única forma de que un número duplicado no envejezca, y
 *    este proyecto tiene el precedente de sobra: una cifra correcta copiada a
 *    otro sitio se vuelve falsa sin que nadie la toque.
 */
export const CASCADA_COMPLETA_MS = Math.max(...RETARDOS_CASCADA_MS) + DURACION_ENTRADA_MS
