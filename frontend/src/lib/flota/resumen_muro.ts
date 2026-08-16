/**
 * LO QUE EL MURO TIENE QUE DECIR DE UN VISTAZO — sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS DOS CIFRAS MÁS GRANDES DEL MURO ERAN EL CAUDAL
 * ═══════════════════════════════════════════════════════════════════════════
 * `POR ROBOT 0,83 kB/s` y `LOS 16 13,28 kB/s`, en la banda de identidad, con el
 * peso de un titular. Y el caudal **importa mucho** en este proyecto —el punto
 * de acceso del aula es un recurso compartido y hay medidas de sobra— pero **no
 * es lo que alguien decide mirando esta pantalla**.
 *
 * La pregunta del profesor, de pie al fondo del aula, es una: **¿tengo que ir a
 * algún robot?** Y esa cifra no estaba en ninguna parte: había que contar
 * baldosas de color a ojo, sobre una losa de dieciséis, proyectada.
 *
 * → El caudal baja a una línea pequeña. Arriba va lo que se decide.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LOS CUATRO CUBOS PARTEN LOS DIECISÉIS, Y ESO SE COMPRUEBA
 * ═══════════════════════════════════════════════════════════════════════════
 * Un resumen cuyas partes no suman el total es peor que ninguno: invita a restar
 * mentalmente y a sacar una quinta categoría que no existe. La prueba lo exige
 * sobre todas las combinaciones, no sobre un caso.
 */

import { Baldosa } from './resumen'
import { EstadoRobot } from '../rosbridge/salud'

export interface ResumenMuro {
  /** Atasco confirmado por el firmware, o batería por debajo de 6,5 V. */
  ir: number
  /** Algo que conviene comprobar, sin ser un hecho grave. */
  mirar: number
  /** Vivos y sin nada que pedir. */
  enLinea: number
  /** No se llega a ellos, o llegan mudos. **No es una avería.** */
  sinSenal: number
  total: number
}

/**
 * @param atenciones qué pide cada robot, por id
 * @param estados    el estado de su enlace, por id
 * @param ids        los robots que hay. Se pasa para no cablear 1..16 aquí.
 *
 * 🔴 EL ORDEN DE LOS CUBOS ES LA PRECEDENCIA, y no es indiferente: `IR` gana a
 *    todo. Un robot con atasco confirmado **y** el enlace a ratos sigue siendo
 *    un robot al que hay que ir — contarlo en «sin señal» lo escondería en el
 *    cubo que la gente aprende a ignorar.
 *
 * ⚠️ Y por construcción no puede haber un `IR` sin señal reciente: `atencion`
 *    sale de `resumirBaldosa()`, que **solo devuelve IR desde un hecho POSITIVO
 *    Y ACTUAL** —nunca desde un hueco—. Esta función no lo vuelve a comprobar:
 *    duplicar esa regla sería tener dos sitios donde cambiarla.
 */
export function resumenDeFlota(
  atenciones: Readonly<Record<number, Baldosa['atencion'] | undefined>>,
  estados: Readonly<Record<number, EstadoRobot | undefined>>,
  ids: readonly number[],
): ResumenMuro {
  let ir = 0
  let mirar = 0
  let enLinea = 0
  let sinSenal = 0

  for (const id of ids) {
    const a = atenciones[id] ?? 'NINGUNA'
    const e = estados[id]

    /*
     * ═════════════════════════════════════════════════════════════════════════
     * 🔴🔴 «NO SE LLEGA A ÉL» GANA A «MIRAR», Y ESTO SE ESCRIBIÓ MAL PRIMERO
     * ═════════════════════════════════════════════════════════════════════════
     * La primera versión contaba `MIRAR` antes de mirar el enlace, y la captura
     * del muro lo destapó en el acto: **«MIRAR 15» sobre quince baldosas que
     * decían «no llegó»**. Dos verdades sobre la misma pantalla, y la de la
     * cifra grande era la falsa.
     *
     * La causa está escrita en `BaldosaRobot`: con `SIN_CONEXION` la ficha se
     * dibuja en vidrio y sin franja, pero **`atencion` sigue valiendo MIRAR** —a
     * propósito, «porque alguien tiene que mirar»—. O sea que el dato es
     * correcto y lo que faltaba aquí era la misma precedencia que la baldosa ya
     * aplicaba al pintar.
     *
     * 📌 Lo cazó **mirar la captura**, no una prueba: mis nueve pruebas pasaban
     *    todas, porque ninguna sabía qué pinta la baldosa. Es la razón por la que
     *    este proyecto exige mirar la pantalla.
     *
     * 🔴 `IR` SIGUE GANANDO A TODO, y no es una excepción arbitraria: solo sale
     *    de un hecho POSITIVO Y ACTUAL —atasco confirmado por el firmware, o
     *    batería bajo 6,5 V con señal reciente—, así que no puede convivir con
     *    un robot inalcanzable. Si alguna vez conviviera, ir a mirarlo seguiría
     *    siendo lo correcto.
     */
    if (a === 'IR') { ir++; continue }
    if (e === 'SIN_CONEXION') { sinSenal++; continue }
    if (a === 'MIRAR') { mirar++; continue }
    /*
     * 🔴 `undefined` CUENTA COMO SIN SEÑAL, y es el lado correcto: al abrir la
     *    página todavía no ha llegado nada de nadie. Contarlo como «en línea»
     *    haría que el muro dijera «16 en línea» medio segundo antes de saber
     *    absolutamente nada — y ese medio segundo es lo primero que se ve.
     */
    /*
     * 📝 Aquí ponía `e === 'SIN_CONEXION'` otra vez, y TypeScript demostró que
     *    ya no podía ser cierto: ese caso sale arriba, tres líneas antes.
     *    Comprobación muerta con aspecto de defensa — la misma forma que
     *    `hayQueAvisar` destapó en el muro y en el marco del robot.
     */
    if (e === undefined || e === 'SIN_DATOS') { sinSenal++; continue }
    enLinea++
  }

  return { ir, mirar, enLinea, sinSenal, total: ids.length }
}

/**
 * ¿Hay que ir a mirar algo? Atajo para no repetir la comparación.
 *
 * 📝 `sinSenal` NO cuenta: un robot cargando —RVR apagado con la Raspberry Pi
 *    viva— es el estado más común del laboratorio, y llamar a eso «atención
 *    requerida» pondría el muro en alarma permanente. Un aviso que sale siempre
 *    deja de leerse, que es la regla de este proyecto en todas partes.
 */
export const pideAlgo = (r: ResumenMuro): boolean => r.ir > 0 || r.mirar > 0
