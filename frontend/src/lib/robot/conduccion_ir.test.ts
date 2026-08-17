import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CODIGO_MODO, NOMBRE_MODO_CONDUCCION, SEGUNDOS_POR_DEFECTO, TOPE_SEGUNDOS,
  type ModoConduccionIR, peticionConduccionIR,
} from './conduccion_ir'

describe('peticionConduccionIR', () => {
  it('construye la peticion de seguir y de huir', () => {
    expect(peticionConduccionIR('seguir', 3, 5, 10))
      .toEqual({ modo: 1, far_code: 3, near_code: 5, segundos: 10 })
    expect(peticionConduccionIR('huir', 0, 7, 1))
      .toEqual({ modo: 2, far_code: 0, near_code: 7, segundos: 1 })
  })

  it('acepta justo el tope y rechaza un pelo por encima', () => {
    expect(peticionConduccionIR('seguir', 1, 1, TOPE_SEGUNDOS)).not.toBeNull()
    expect(peticionConduccionIR('seguir', 1, 1, TOPE_SEGUNDOS + 0.001)).toBeNull()
  })

  /*
   * 🔴 EL PLAZO ES OBLIGATORIO, y es la mitad del diseño: sin el, un alumno que
   *    arranca un seguimiento y se va deja un robot conduciendo por el aula
   *    indefinidamente, con el `collision_monitor` FUERA del circuito.
   */
  it('no existe la peticion «para siempre»', () => {
    for (const s of [0, -1, -0.001]) {
      expect(peticionConduccionIR('seguir', 1, 1, s), `segundos=${s}`).toBeNull()
    }
  })

  /*
   * 🔴 `NaN` e `Infinity` por separado. Con `NaN` las DOS comparaciones de rango
   *    son falsas, asi que una guarda escrita al reves lo dejaria pasar — es la
   *    forma exacta de `limitar(nan)`, que devolvia EL TOPE de velocidad.
   */
  it('NaN e Infinity no son plazos', () => {
    expect(peticionConduccionIR('seguir', 1, 1, NaN)).toBeNull()
    expect(peticionConduccionIR('seguir', 1, 1, Infinity)).toBeNull()
    expect(peticionConduccionIR('seguir', 1, 1, -Infinity)).toBeNull()
  })

  it('devuelve null con codigos fuera de 0-7, y no los recorta', () => {
    for (const [f, n] of [[8, 0], [0, 8], [-1, 0], [1.5, 0], [0, NaN]] as const) {
      expect(peticionConduccionIR('seguir', f, n, 5), `far=${f} near=${n}`).toBeNull()
    }
  })

  /*
   * 🔴🔴 APAGAR NO PUEDE FALLAR NUNCA, y aqui pesa mas que en la baliza: lo que
   *    se apaga es un robot EN MARCHA. Un mando que apaga algo no puede quedarse
   *    bloqueado porque haya un valor raro en otro control de la pantalla.
   */
  it('apagar funciona siempre, con cualquier basura en los otros campos', () => {
    for (const [f, n, s] of [[99, -3, NaN], [0, 0, 0], [1.5, 8, -7]] as const) {
      expect(peticionConduccionIR('off', f, n, s), `far=${f} near=${n} s=${s}`)
        .toEqual({ modo: 0, far_code: 0, near_code: 0, segundos: 0 })
    }
  })

  /*
   * 📌 La forma del objeto es el contrato con el `.srv` que falta por escribir en
   *    la Pi. Si aqui aparece un campo de mas, rosbridge lo aceptaria y el driver
   *    lo ignoraria en silencio.
   */
  it('no manda campos que el .srv no va a tener', () => {
    expect(Object.keys(peticionConduccionIR('seguir', 1, 2, 3) ?? {}).sort())
      .toEqual(['far_code', 'modo', 'near_code', 'segundos'])
  })
})

describe('los tres modos', () => {
  it('off es 0, y eso importa: es el valor por defecto de un uint8', () => {
    // Un mensaje mal formado o un campo que falte llega como 0 — y 0 tiene que
    // ser APAGAR, nunca conducir. Si `seguir` fuera 0, un cuerpo incompleto
    // pondria el robot en marcha.
    expect(CODIGO_MODO.off).toBe(0)
    expect(CODIGO_MODO.seguir).not.toBe(0)
    expect(CODIGO_MODO.huir).not.toBe(0)
  })

  it('los tres codigos son distintos', () => {
    const vals = Object.values(CODIGO_MODO)
    expect(new Set(vals).size).toBe(vals.length)
  })

  it('cada modo tiene nombre en español, y ninguno se queda sin el', () => {
    for (const m of Object.keys(CODIGO_MODO) as ModoConduccionIR[]) {
      expect(NOMBRE_MODO_CONDUCCION[m], m).toBeTruthy()
    }
  })
})

describe('los plazos', () => {
  it('el valor por defecto cabe dentro del tope y es util', () => {
    expect(SEGUNDOS_POR_DEFECTO).toBeGreaterThan(0)
    expect(SEGUNDOS_POR_DEFECTO).toBeLessThanOrEqual(TOPE_SEGUNDOS)
    expect(peticionConduccionIR('seguir', 1, 1, SEGUNDOS_POR_DEFECTO)).not.toBeNull()
  })

  /*
   * 📝 Aquí había un `expect(TOPE_SEGUNDOS).toBe(30)` con la nota «atarlo al
   *    .srv cuando la Pi lo publique». La Pi lo publicó el 2026-08-17, así que
   *    se ha ido: era el MISMO número escrito a mano dos veces, y lo sustituye
   *    el bloque de abajo, que lo LEE del `.srv`. Dejar las dos habría sido
   *    exactamente el duplicado que este proyecto persigue.
   */
})

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * EL TOPE, CONTRA EL `.srv` DEL ROBOT — y la ruta que se escribió mal dos veces
 * ═══════════════════════════════════════════════════════════════════════════
 * Este fichero vive en `Atriz_Web/atriz-lab/frontend/src/lib/robot/` y el
 * hermano es `Atriz_Web/Atriz_rvr/`: son **CINCO** niveles (lib → src →
 * frontend → atriz-lab → Atriz_Web). Se intentó con dos y con seis, y **las dos
 * veces la prueba pasó en verde** — porque cuando no encontraba el fichero se
 * iba por un `return` con un `console.warn`.
 *
 * 🔴 Ese `return` era el defecto de verdad, no la aritmética de la ruta. Una
 *    comprobación que se salta cuando no encuentra su fuente **no puede
 *    distinguir «todo bien» de «no he mirado»**, y avisar por consola no lo
 *    arregla: nadie lee la consola de una tanda en verde. Es la comprobación
 *    nº14 del verificador del robot —la que se saltó sola y en silencio—
 *    cometida aquí otra vez, en la sesión que la citaba.
 *
 * → Por eso ahora **FALLA** si no está, con el motivo en el mensaje.
 */
describe('el tope, contra el .srv del robot', () => {
  const ATRIZ_WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
  const SRV = join(ATRIZ_WEB, 'Atriz_rvr', 'atriz_rvr_msgs', 'srv', 'SetIRConduccion.srv')

  it('el .srv del robot está donde esta prueba lo busca', () => {
    expect(
      existsSync(SRV),
      `no encuentro ${SRV}. Sin él, el tope de ${TOPE_SEGUNDOS} s de esta web no está `
      + 'contrastado con nada. Clona Atriz_rvr al lado de atriz-lab.',
    ).toBe(true)
  })

  it('TOPE_SEGUNDOS coincide con la constante del .srv', () => {
    const m = /^\s*uint8\s+TOPE_SEGUNDOS\s*=\s*(\d+)\s*$/m.exec(readFileSync(SRV, 'utf8'))
    expect(m, 'el .srv ya no declara TOPE_SEGUNDOS: mira si le cambiaron el nombre').not.toBeNull()
    expect(Number(m?.[1])).toBe(TOPE_SEGUNDOS)
  })

  it('y el .srv sigue teniendo los cuatro campos que esta web manda', () => {
    const txt = readFileSync(SRV, 'utf8')
    for (const campo of ['modo', 'far_code', 'near_code', 'segundos']) {
      /*
       * 🔴 SIN PLANTILLA, y no es estilo: en una plantilla `\b` es un
       *    **retroceso** (U+0008), no un límite de palabra, y `\s`/`\w` se
       *    quedan en `s`/`w`. El patrón no casaría nada.
       */
      const patron = new RegExp('^\\s*\\w+\\s+' + campo + '\\b', 'm')
      expect(patron.test(txt), `falta ${campo}`).toBe(true)
    }
  })
})
