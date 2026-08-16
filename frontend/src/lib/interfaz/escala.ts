/**
 * LA ESCALA IMPRESA — la aritmética, sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EXISTE, Y ES LA TESIS DE LA DIRECCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * Un multímetro de banco serigrafía «0–20 V ±0,5 %» junto al conector **para
 * siempre**: haya lectura o no, el instrumento te dice contra qué se lee lo que
 * mide. Esta aplicación necesita eso más que un multímetro, porque sus números
 * no se interpretan solos:
 *
 *   · 7,80 V ¿es bueno? Solo si sabes que «baja» son 7,0 y «crítica» 6,5.
 *   · 26,4 cm ¿está mal? Solo si sabes que se pidieron 60.
 *   · un objetivo a 11 cm ¿llegó? Solo si sabes que la tolerancia son 10.
 *
 * Hasta hoy eso se decía **en prosa, al lado**, y en un caso —los umbrales de
 * batería— en una celda aparte con su propio rótulo. La escala lo pone donde
 * corresponde: **debajo del valor, dibujado**, y sin gastar una frase.
 *
 * ⚠️ LO QUE ESTA ESCALA NO ES: una barra de progreso. No dice «cuánto llevas»,
 *    dice «dónde cae esto dentro de lo que el instrumento admite». Por eso
 *    **existe aunque no haya valor** — con el robot apagado la escala sigue
 *    impresa, igual que la serigrafía de un panel apagado.
 *
 * 🔴 Y NO DECIDE NADA. No dice si el valor es bueno: dibuja los umbrales y deja
 *    que el ojo lo vea. El veredicto lo sigue dando quien lo daba —
 *    `nivelBateria()` y compañía—, en un solo sitio. Una escala que además
 *    juzgara sería una segunda fuente de verdad sobre lo mismo.
 */

/** Un umbral serigrafiado en la escala: dónde cae y cómo se llama. */
export interface Marca {
  /** En las unidades del valor, no en porcentaje. */
  en: number
  /** Corto y en minúsculas: se pinta en versalitas. «baja», «crítica». */
  nombre: string
}

export interface Escala {
  min: number
  max: number
  marcas?: readonly Marca[]
}

/**
 * Dónde cae `valor` dentro de `[min, max]`, en 0..1.
 *
 * 🔴 RECORTA A LOS EXTREMOS, y esa decisión tiene un precedente caro en este
 *    proyecto: `limitar(nan)` devolvía **el tope** —0,40 m/s— porque
 *    `abs(nan) <= tope` es `false` y caía en la rama de recorte. Aquí un `NaN`
 *    devolvería una posición y el marcador se pintaría en un sitio inventado.
 *    Por eso lo primero que se comprueba es `isFinite`, **antes** de comparar.
 *
 * @returns `null` cuando no se puede situar. `null` es «no lo pinto», nunca 0:
 *          un marcador en el 0 % es indistinguible de un valor en el mínimo.
 */
export function posicion(valor: number, e: Escala): number | null {
  if (!Number.isFinite(valor)) return null
  if (!Number.isFinite(e.min) || !Number.isFinite(e.max)) return null
  /*
   * ⚠️ Una escala de ancho cero no es un error de quien la usa: puede salir de
   *    dos constantes que resultaron iguales. Dividir daría `Infinity` o `NaN`
   *    según el signo, o sea un marcador en un sitio arbitrario.
   */
  if (e.max <= e.min) return null
  return Math.min(1, Math.max(0, (valor - e.min) / (e.max - e.min)))
}

/**
 * Las marcas que de verdad caen DENTRO de la escala, ordenadas.
 *
 * 🔴 Una marca fuera de rango se descarta en vez de recortarse. Recortada se
 *    pintaría pegada a un extremo y **mentiría sobre dónde está el umbral** —
 *    exactamente el fallo de «una función que recorta a un valor seguro puede
 *    mapear lo peor al máximo». Lo honesto con un umbral que no cabe es no
 *    dibujarlo; si no cabe, la escala está mal elegida y eso se arregla en la
 *    escala, no en el dibujo.
 */
export function marcasVisibles(e: Escala): Marca[] {
  if (e.max <= e.min) return []
  return [...(e.marcas ?? [])]
    .filter((m) => Number.isFinite(m.en) && m.en > e.min && m.en < e.max)
    .sort((a, b) => a.en - b.en)
}
