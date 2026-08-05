/**
 * EL ORDEN DE LAS FICHAS DEL MURO. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR DEFECTO SIEMPRE POR NÚMERO, Y NO ES UNA PREFERENCIA
 * ═══════════════════════════════════════════════════════════════════════════
 * En un muro que se mira veinte veces por clase, la posición de cada robot es
 * memoria muscular. Si rvr-03 se pone en apuros y salta al primer hueco, los
 * otros trece se recolocan y hay que volver a buscarlos **todos**, incluidos
 * los que no han cambiado.
 *
 * Ordenar por atención es útil **cuando alguien lo pide**, no como estado por
 * defecto que se reordena solo cada vez que un robot cruza un umbral.
 */

import { Baldosa } from './resumen'

export type OrdenMuro = 'NUMERO' | 'ATENCION'

/**
 * Peso de cada nivel de atención. Mayor = más arriba.
 *
 * ⚠️ `NINGUNA` incluye tanto «en línea y sin novedad» como «no llego»: los dos
 *    son «no pide nada» en el vocabulario de la aplicación. El desempate entre
 *    ellos lo hace el número, no un tercer nivel inventado aquí.
 */
const PESO: Readonly<Record<Baldosa['atencion'], number>> = {
  IR: 2,
  MIRAR: 1,
  NINGUNA: 0,
}

/**
 * Ordena una lista de baldosas. **No muta la que recibe.**
 *
 * 🔴 El desempate SIEMPRE es por número, en los dos modos. Sin él, dos robots
 *    con la misma atención podrían intercambiarse de sitio en cada render por
 *    culpa de un orden inestable — y un muro cuyas fichas bailan solas es
 *    exactamente lo que este módulo existe para evitar.
 */
export function ordenarBaldosas<T extends { id: number; baldosa: Baldosa }>(
  fichas: readonly T[],
  orden: OrdenMuro,
): T[] {
  const copia = [...fichas]
  if (orden === 'NUMERO') return copia.sort((a, b) => a.id - b.id)
  return copia.sort(
    (a, b) => PESO[b.baldosa.atencion] - PESO[a.baldosa.atencion] || a.id - b.id,
  )
}
