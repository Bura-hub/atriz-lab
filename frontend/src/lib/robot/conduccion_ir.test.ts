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
   * ⚠️ Este numero es una COPIA del `.srv` del robot, que todavia no existe.
   *    Cuando exista, esta prueba tiene que pasar a LEERLO — igual que
   *    `cascada.test.ts` lee `globals.css`— o envejecera sola. Queda escrito
   *    aqui para que quien cablee el servicio se lo encuentre.
   */
  it('⏳ el tope es 30 s — atarlo al .srv cuando la Pi lo publique', () => {
    expect(TOPE_SEGUNDOS).toBe(30)
  })
})
