/**
 * LOS MODOS IR QUE **CONDUCEN** EL ROBOT: seguir y huir. Puro, sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTO NO ES «UN MODO MÁS DEL SENSOR»: MUEVE EL ROBOT SIN CAPA DE SEGURIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * `following` y `evading` son modos del **firmware** del RVR. El robot conduce
 * solo, **sin pasar por `cmd_vel`**, y eso significa exactamente esto:
 *
 *   · el **watchdog** del driver no lo ve — no hay `cmd_vel` que caduque;
 *   · el **`collision_monitor`** no lo ve — no hay mando que recortar, así que
 *     ni el polígono `Precaucion` ni el círculo `Aproximacion` intervienen;
 *   · el LIDAR barre a **15,5 cm del suelo** y por debajo no ve nada, y aquí no
 *     hay nada que use el barrido de todos modos.
 *
 * O sea: es la única forma de mover un robot de este laboratorio **con la capa
 * de seguridad fuera del circuito**. Por eso lleva desde el 2026-08-11 fuera de
 * la lista blanca de rosbridge, y por eso al abrirlo no basta con «ya sabemos
 * quién fue».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ SE PIDE CON UN PLAZO, Y NO CON UN INTERRUPTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * La condición que el propio robot escribió para reabrirlos era *«se reabre
 * cuando exista identidad por usuario, no antes»*, y **se cumplió** con la Fase
 * B el 2026-08-15. Pero identidad cambia **quién responde**, no el peligro: un
 * alumno identificado pone el robot a conducir saltándose el
 * `collision_monitor` exactamente igual que uno anónimo.
 *
 * Lo que sí reduce el peligro es que **no pueda quedarse encendido**. Un alumno
 * que arranca un seguimiento y se va a otra mesa deja un robot conduciendo por
 * el aula por tiempo indefinido; con plazo obligatorio, el firmware se apaga
 * solo. Es la misma forma que `move_timed` en el robot, y la misma que el tope
 * de tiempo que ya protege `avanzar()` en la biblioteca del alumno.
 *
 * 📌 Y es el mismo truco que hizo segura la baliza: **la petición peligrosa no
 *    se puede escribir**. Allí, porque el campo es un booleano y no existe la
 *    cadena `following`. Aquí, porque no existe la petición «para siempre».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ CABLEADO Y EN PRODUCCIÓN DESDE EL 2026-08-17
 * ═══════════════════════════════════════════════════════════════════════════
 * `/set_ir_conduccion` existe en el robot (`SetIRConduccion.srv`, verificado por
 * efecto en la evidencia 128), está en la lista blanca, y el mando vive en
 * `PanelInfrarrojos`. `TOPE_SEGUNDOS` **se contrasta leyendo el `.srv`** en
 * `conduccion_ir.test.ts`, así que si el robot lo cambia, aquí se pone rojo.
 *
 * 📝 AQUÍ PONÍA LO CONTRARIO —«este módulo no está cableado» y «el servicio no
 *    existe aún»— y las dos frases envejecieron **el mismo día en que se
 *    escribieron**, en cuanto la Pi entregó su parte. Lo destapó una auditoría,
 *    no una prueba: **ningún comprobador de este repositorio puede ver que un
 *    comentario dejó de ser cierto.** Es la razón por la que un comentario que
 *    describe el ESTADO de otra máquina hay que revisarlo al cerrar la tarea,
 *    no al empezarla.
 */

import { CODIGO_MAX, CODIGO_MIN } from './infrarrojos'

/**
 * Los tres valores del campo `modo`.
 *
 * 🔴 **ENTEROS, NO UNA CADENA**, y ahí está media seguridad del diseño.
 *    `set_ir_mode` recibe `string mode` libre y la lista blanca de rosbridge
 *    filtra por SERVICIO, no por argumento: abrir aquel abre todo lo que la
 *    cadena admita, hoy y el día que alguien añada un modo nuevo. Con un `uint8`
 *    la enumeración está cerrada en el `.srv`.
 */
export const CODIGO_MODO = { off: 0, seguir: 1, huir: 2 } as const

export type ModoConduccionIR = keyof typeof CODIGO_MODO

/** Lo que se enseña en pantalla. `seguir`/`huir` en imperativo: son órdenes. */
export const NOMBRE_MODO_CONDUCCION: Readonly<Record<ModoConduccionIR, string>> = {
  off: 'apagado',
  seguir: 'seguir a otro robot',
  huir: 'huir de otro robot',
}

/**
 * El tope duro, en segundos.
 *
 * ⚠️ **Está escrito a mano y su fuente de verdad es el `.srv` del robot.** Hoy no
 *    se puede atar porque el `.srv` todavía no existe; cuando exista, va una
 *    prueba que lo lea —igual que `cascada.test.ts` lee `globals.css`— porque un
 *    número duplicado envejece solo, y este proyecto lo ha pagado ya con los
 *    encabezados numerados y con `MIN_PUNTOS`.
 *
 * 🔴 Si los dos se separan, el que manda es el ROBOT: la web pediría 60 y el
 *    driver rechazaría con su motivo. Falla ruidoso y hacia el lado seguro, que
 *    es lo que se quiere de una discrepancia como esta.
 */
export const TOPE_SEGUNDOS = 30

/** Lo que trae el control al abrirse. Corto a propósito: se puede repetir. */
export const SEGUNDOS_POR_DEFECTO = 10

export interface PeticionConduccionIR {
  modo: number
  far_code: number
  near_code: number
  segundos: number
}

/**
 * @returns `null` si algo está fuera de rango — **nunca un valor recortado**.
 *
 * 🔴 No recorta, igual que `peticionIR` y `peticionBaliza`. Aquí importa más que
 *    en ninguno: recortar 120 s a 30 sería poner el robot a conducir un tiempo
 *    que nadie pidió, y este proyecto tiene medido a dónde lleva —`limitar(nan)`
 *    devolvía **el tope** de velocidad porque `abs(nan) <= tope` es falso—.
 *
 * ⚠️ **Apagar no valida nada y no puede fallar.** Es la misma regla que en la
 *    baliza: un mando que apaga algo no puede quedarse bloqueado porque haya un
 *    valor raro en otro control. Y aquí lo que se apaga es un robot en marcha.
 */
export function peticionConduccionIR(
  modo: ModoConduccionIR,
  farCode: number,
  nearCode: number,
  segundos: number,
): PeticionConduccionIR | null {
  if (modo === 'off') {
    return { modo: CODIGO_MODO.off, far_code: 0, near_code: 0, segundos: 0 }
  }
  const codigoValido = (v: number) =>
    Number.isInteger(v) && v >= CODIGO_MIN && v <= CODIGO_MAX
  if (!codigoValido(farCode) || !codigoValido(nearCode)) return null
  // 🔴 `isFinite` ANTES de comparar: con `NaN` las dos comparaciones son falsas,
  //    así que un `!(s > 0)` mal escrito lo dejaría pasar. Es la trampa de
  //    `limitar(nan)`, que este proyecto persigue desde el 2026-08-03.
  if (!Number.isFinite(segundos) || segundos <= 0 || segundos > TOPE_SEGUNDOS) return null
  return {
    modo: CODIGO_MODO[modo],
    far_code: farCode,
    near_code: nearCode,
    segundos,
  }
}
