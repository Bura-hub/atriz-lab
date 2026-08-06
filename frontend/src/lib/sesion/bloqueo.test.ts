import { describe, expect, it } from 'vitest'
import {
  BLOQUEO_MAXIMO_S, FALLOS_ANTES_DE_BLOQUEAR, SIN_INTENTOS, castigoS,
  segundosQueFaltan, trasAcertar, trasFallar,
} from './bloqueo'

const AHORA = 1_700_000_000_000

describe('la curva de castigo', () => {
  it('los cuatro primeros fallos son gratis', () => {
    // Teclear mal una contraseña larga es normal. Bloquear al segundo intento
    // convierte una molestia en una llamada al profesor.
    for (let n = 0; n < FALLOS_ANTES_DE_BLOQUEAR; n += 1) expect(castigoS(n)).toBe(0)
  })

  it('la misma curva que SIVE: 30 · 2^(n−5), con tope', () => {
    expect(castigoS(5)).toBe(30)
    expect(castigoS(6)).toBe(60)
    expect(castigoS(7)).toBe(120)
    expect(castigoS(8)).toBe(240)
    expect(castigoS(9)).toBe(BLOQUEO_MAXIMO_S)   // 480 recortado a 300
  })

  it('🔴 el tope no se pasa por muchos fallos que haya', () => {
    // Sin tope, veinte fallos darían meses de bloqueo y la cuenta quedaría
    // inservible hasta editar el fichero a mano.
    expect(castigoS(40)).toBe(BLOQUEO_MAXIMO_S)
  })
})

describe('el recuento', () => {
  it('acumula fallos y empieza a bloquear en el quinto', () => {
    let i = SIN_INTENTOS
    for (let n = 0; n < 4; n += 1) i = trasFallar(i, AHORA)
    expect(i.fallos).toBe(4)
    expect(i.bloqueadoHasta).toBe(0)          // todavía se puede probar

    i = trasFallar(i, AHORA)
    expect(i.fallos).toBe(5)
    expect(segundosQueFaltan(i, AHORA)).toBe(30)
  })

  it('🔴 acertar lo reinicia TODO', () => {
    /*
     * Sin esto, quien se equivoca cuatro veces a lo largo de una mañana acaba
     * bloqueado por un quinto fallo horas después, habiendo entrado bien tres
     * veces por medio.
     */
    let i = SIN_INTENTOS
    for (let n = 0; n < 4; n += 1) i = trasFallar(i, AHORA)
    expect(trasAcertar()).toEqual(SIN_INTENTOS)
  })

  it('el bloqueo se agota solo con el tiempo', () => {
    const i = trasFallar({ fallos: 4, bloqueadoHasta: 0 }, AHORA)
    expect(segundosQueFaltan(i, AHORA)).toBe(30)
    expect(segundosQueFaltan(i, AHORA + 29_000)).toBe(1)
    expect(segundosQueFaltan(i, AHORA + 30_000)).toBe(0)
    // Y pasado, sigue en cero: no se reactiva solo.
    expect(segundosQueFaltan(i, AHORA + 999_000)).toBe(0)
  })

  it('redondea hacia ARRIBA los segundos que faltan', () => {
    // Decir «faltan 0 s» cuando faltan 400 ms hace que el botón siga fallando
    // justo después de que la cuenta atrás llegue a cero.
    const i = trasFallar({ fallos: 4, bloqueadoHasta: 0 }, AHORA)
    expect(segundosQueFaltan(i, AHORA + 29_600)).toBe(1)
  })
})
