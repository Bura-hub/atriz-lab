/**
 * QUÉ SE PUEDE DECIR CUANDO UN OBJETIVO DE NAV2 TERMINA — sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LOS DOS DESENLACES MIENTEN, ASÍ QUE EL DESENLACE NO PUEDE SER EL TITULAR
 * ═══════════════════════════════════════════════════════════════════════════
 * Medido en el robot, y son dos fallos independientes:
 *
 *   · `SUCCEEDED` a **41,3 cm** de un objetivo con 10 de tolerancia, sobre un
 *     mapa que no era del sitio. Sin una línea de error en ningún log.
 *   · `ABORTED` sobre un robot que **llegó diez segundos después**:
 *     `bt_navigator` tenía `default_server_timeout: 20` —veinte milisegundos
 *     para que el controlador acusara recibo— y se rendía mientras
 *     `controller_server` conducía. Tres tandas dadas por fallidas eran buenas.
 *
 * → **Ni terminar ni fallar dicen dónde está el robot.** Lo dice el propio
 *   robot: *«lo que sí se puede mostrar es el desplazamiento por `/odom`, que
 *   es la fuente que acierta a 0,3-4,2 cm»*.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ESTE FICHERO EXISTE: LA PROSA SE LEÍA CON EL ROBOT EN MARCHA
 * ═══════════════════════════════════════════════════════════════════════════
 * El desenlace se pintaba como **un párrafo de ~400 caracteres** —600 en el
 * caso de fallo—, con la historia del mapa rancio, los 41 cm, el plazo de 20 ms
 * y la curva de anchos de hueco, todo seguido. Y se lee **justo cuando el robot
 * acaba de pararse en el aula**, que es el peor instante posible para pedir
 * cuatro renglones de contexto.
 *
 * La partición es la que ya usa `Contexto`: **¿cambia con lo que hace el robot
 * ahora mismo?**
 *   · Sí  → estado. Va arriba, grande, y no se pliega:
 *           el desplazamiento medido, lo que dijo la acción, qué hacer ahora.
 *   · No  → contexto. Los 41 cm, el plazo de 20 ms y la curva de huecos son
 *           verdad siempre; se pliegan y siguen ahí para quien investigue.
 *
 * 📌 Y el orden importa: **lo medido primero, lo que dijo Nav2 después.** Es la
 *    inversión que hace honesta a la pantalla — si el titular fuera «terminó»,
 *    la interfaz estaría repitiendo la afirmación que se sabe falsa.
 */

/**
 * Lo que dijo el servidor de acción. **No es lo que hizo el robot.**
 *
 * 📝 Se llaman así y no `EXITO`/`FALLO` a propósito: nombrar al desenlace por su
 *    valor de verdad —«éxito»— es la mitad del error que costó tres tandas.
 */
export type QueDijoLaAccion = 'TERMINO' | 'FALLO'

export interface Punto { x: number; y: number }

export interface ResultadoObjetivo {
  hora: string
  accion: QueDijoLaAccion
  /**
   * Metros que se movió el robot según `/odom`, entre mandar el objetivo y el
   * desenlace. `null` = no se pudo medir, y **no es cero**.
   */
  recorrido: number | null
  /** El mensaje del servidor de acción. Solo cuando falló. */
  motivo: string | null
}

/**
 * Cuánto se movió el robot entre dos poses de `/odom`.
 *
 * 🔴 **ESTO NO ES LA DISTANCIA AL OBJETIVO**, y confundirlas es fácil porque las
 *    dos se miden en metros y salen en la misma tarjeta. Para la distancia al
 *    objetivo haría falta cruzar el marco `map` con el `odom`, **y ese cruce es
 *    justamente el que se equivoca** — es lo que produce los 41,3 cm. Se muestra
 *    lo que se sabe.
 *
 * 🔴 `Math.hypot` DE UN `NaN` DEVUELVE `NaN`, y `NaN` pintado es «NaN m» en la
 *    pantalla de un instrumento. Se comprueba `isFinite` **antes de restar**,
 *    que es la regla que este proyecto pagó con `limitar(nan)` devolviendo el
 *    tope de velocidad.
 */
export function recorridoEntre(a: Punto | null, b: Punto | null): number | null {
  if (a === null || b === null) return null
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  return Number.isFinite(d) ? d : null
}

/**
 * La frase corta que se lee con el robot delante. **Una acción, no una lección.**
 *
 * ⚠️ El techo es deliberado: si esto crece, ha vuelto el párrafo. Lo que se
 *    quiera añadir va al `Contexto`, que está a un clic y no estorba.
 */
export const TECHO_QUE_HACER = 120

export function queHacerAhora(accion: QueDijoLaAccion): string {
  return accion === 'TERMINO'
    ? 'Mira dónde paró: que la acción termine no dice dónde terminó.'
    : 'Mira dónde está antes de repetirlo: puede haber llegado igual.'
}

/**
 * Qué nivel de aviso merece.
 *
 * 🔴 UN FALLO DE LA ACCIÓN **NO** ES UN `ERROR` DE LA PANTALLA, y esto se
 *    equivocaba: se pintaba en rojo de error. Pero se ha medido que un `ABORTED`
 *    puede ser un robot que llegó, así que el rojo estaría afirmando un fracaso
 *    que la propia pantalla dice a continuación que no se sabe. Es `ATENCION`:
 *    hay que ir a mirar, no hay una avería confirmada.
 *
 * 📌 Y hay una razón más dura, de este proyecto: **el rojo `--destructive` es
 *    exclusivo de la parada de emergencia.** Cada rojo de más se lo come.
 */
export function nivelDe(accion: QueDijoLaAccion): 'NOTA' | 'ATENCION' {
  return accion === 'TERMINO' ? 'NOTA' : 'ATENCION'
}

/** El rótulo del marcador de estado. Corto: va al lado de una cifra. */
export function rotuloDe(accion: QueDijoLaAccion): string {
  return accion === 'TERMINO' ? 'terminó' : 'falló'
}
