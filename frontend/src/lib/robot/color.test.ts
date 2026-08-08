import { describe, expect, it } from 'vitest'
import {
  BANDA_PLANA, LUZ_DE, hayLectura, interpretar, luzConcuerda, motivoDeDuda, proporciones,
  type Lectura, type Modo,
} from './color'

const lec = (p: Partial<Lectura> = {}): Lectura => ({
  rojo: 0, verde: 0, azul: 0, claro: 0, success: true, message: '', ...p,
})

/*
 * 🔴 LAS MEDIDAS DE VERDAD, del 2026-08-08 sobre una pantalla de móvil sin mover
 *    el robot entre colores. Se usan como casos de prueba a propósito: si alguien
 *    toca los umbrales, lo que falla es una MEDICIÓN REAL, no un ejemplo inventado.
 */
const MEDIDO = {
  EMISION: {                                   // luz APAGADA
    ROJO: { rojo: 512, verde: 100, azul: 15, claro: 150 },   // R/G 5.12 · B/G 0.15
    VERDE: { rojo: 17, verde: 100, azul: 20, claro: 387 },   // R/G 0.17 · B/G 0.20
    AZUL: { rojo: 11, verde: 100, azul: 457, claro: 190 },   // R/G 0.11 · B/G 4.57
  },
  REFLEJO: {                                   // luz ENCENDIDA, sobre la MISMA pantalla
    ROJO: { rojo: 66, verde: 100, azul: 49, claro: 1238 },   // R/G 0.66 — engaña
    VERDE: { rojo: 37, verde: 100, azul: 40, claro: 1467 },
    AZUL: { rojo: 46, verde: 100, azul: 73, claro: 1230 },
  },
}

// ═══════════════════════════════════════════════════════════════════════════
describe('proporciones', () => {
  it('normaliza por verde, que es el canal más sensible', () => {
    const p = proporciones({ rojo: 512, verde: 100, azul: 15 })!
    expect(p.rg).toBeCloseTo(5.12, 2)
    expect(p.bg).toBeCloseTo(0.15, 2)
  })

  it('🔴 verde a CERO devuelve null, y ese caso está MEDIDO', () => {
    /*
     * La casilla «refleja + luz apagada» del 2×2 dio cero absoluto: los cuatro
     * canales a 0, doce lecturas, dispersión 0, y `success=True` en las doce.
     * Sin esta guarda saldría Infinity o NaN — y `NaN > 1` es `false`, así que
     * el clasificador lo llamaría VERDE con toda tranquilidad.
     */
    expect(proporciones({ rojo: 0, verde: 0, azul: 0 })).toBeNull()
    expect(interpretar(proporciones({ rojo: 0, verde: 0, azul: 0 }), 'EMISION'))
      .toBe('NO_SE_PUEDE_DECIR')
  })

  it('un canal no finito tampoco produce una proporción', () => {
    expect(proporciones({ rojo: NaN, verde: 100, azul: 10 })).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('🔴 el MODO decide, y el mismo número significa cosas distintas', () => {
  it.each(['ROJO', 'VERDE', 'AZUL'] as const)(
    'en EMISIÓN acierta el %s medido', (color) => {
      expect(interpretar(proporciones(MEDIDO.EMISION[color]), 'EMISION')).toBe(color)
    })

  it('🔴🔴 el ROJO medido en REFLEJO sobre vidrio NO se llama rojo — ni se llama nada', () => {
    /*
     * ESTA es la prueba que justifica todo el fichero. `R/G = 0,66` sobre una
     * pantalla ROJA A TOPE: menos rojo que verde. Con la luz encendida el
     * resultado no es impreciso, sale INVERTIDO — y lo honesto es callarse.
     */
    expect(interpretar(proporciones(MEDIDO.REFLEJO.ROJO), 'REFLEJO')).toBe('NO_SE_PUEDE_DECIR')
    // Y el mismo objeto físico, con la luz apagada, sí se identifica.
    expect(interpretar(proporciones(MEDIDO.EMISION.ROJO), 'EMISION')).toBe('ROJO')
  })

  it('🔴 los TRES colores en REFLEJO sobre vidrio caen en la banda plana', () => {
    // Los seis cocientes medidos viven entre 0,37 y 0,73: ninguno se puede nombrar.
    for (const c of ['ROJO', 'VERDE', 'AZUL'] as const) {
      expect(interpretar(proporciones(MEDIDO.REFLEJO[c]), 'REFLEJO'), c).toBe('NO_SE_PUEDE_DECIR')
    }
  })

  it('en REFLEJO sí nombra una superficie MATE roja (R/G medido 2,74)', () => {
    expect(interpretar({ rg: 2.74, bg: 0.5 }, 'REFLEJO')).toBe('ROJO')
  })

  it('🔴 y la MISMA lectura cambia de veredicto según el modo', () => {
    // 0,66 / 0,49 es el rojo sobre vidrio con luz. En emisión sería «verde»
    // —los dos cocientes por debajo de 1—; en reflejo, banda plana. Ninguna de
    // las dos es «rojo», y por eso el modo no puede tener valor por defecto.
    const p = { rg: 0.66, bg: 0.49 }
    expect(interpretar(p, 'EMISION')).toBe('VERDE')
    expect(interpretar(p, 'REFLEJO')).toBe('NO_SE_PUEDE_DECIR')
  })

  it('en EMISIÓN, los dos cocientes por encima de 1 no es ningún color medido', () => {
    expect(interpretar({ rg: 2, bg: 2 }, 'EMISION')).toBe('NO_SE_PUEDE_DECIR')
  })

  it('la banda plana está entre las dos medidas, no encima de ninguna', () => {
    // 0,73 es el mayor cociente medido sobre vidrio; 2,74 el del rojo mate.
    expect(BANDA_PLANA.max).toBeGreaterThan(0.73)
    expect(BANDA_PLANA.max).toBeLessThan(2.74)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('🔴 hayLectura: el discriminante es success, NO claro', () => {
  it('claro = 0 con success = true ES una lectura válida', () => {
    // Doce lecturas de cero absoluto, todas con success=True. Tratarlas como
    // fallo diría «el sensor no responde» sobre un sensor que responde.
    expect(hayLectura(lec({ claro: 0, success: true }))).toBe(true)
  })

  it('claro alto con success = false NO lo es', () => {
    expect(hayLectura(lec({ claro: 1467, success: false }))).toBe(false)
  })

  it('🔴 42 cuentas son una lectura excelente en emisión, y oscuridad en reflejo', () => {
    // Por eso no hay ningún umbral numérico aquí: el umbral depende del modo y
    // el contrato del robot prohíbe copiarlo de uno a otro.
    expect(hayLectura(lec({ claro: 42, success: true }))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('la luz y el modo', () => {
  it('reflejo pide la luz encendida; emisión, apagada', () => {
    expect(LUZ_DE('REFLEJO')).toBe(true)
    expect(LUZ_DE('EMISION')).toBe(false)
  })

  it('🔴 color_activo=false CONCUERDA con el modo emisión, no es un fallo', () => {
    // El contrato del robot lo prohíbe con esas palabras: ese campo dice si la
    // LUZ está encendida, no si el sensor sirve.
    expect(luzConcuerda(false, 'EMISION')).toBe(true)
    expect(luzConcuerda(true, 'REFLEJO')).toBe(true)
    expect(luzConcuerda(false, 'REFLEJO')).toBe(false)
    expect(luzConcuerda(true, 'EMISION')).toBe(false)
  })

  it('sin dato del robot no se afirma que concuerde ni que no', () => {
    expect(luzConcuerda(null, 'REFLEJO')).toBeNull()
  })
})

describe('motivoDeDuda', () => {
  it('cada duda trae su motivo, y ninguno es genérico', () => {
    for (const m of ['REFLEJO', 'EMISION'] as Modo[]) {
      expect(motivoDeDuda(null, m).length).toBeGreaterThan(60)
      expect(motivoDeDuda({ rg: 0.5, bg: 0.5 }, m).length).toBeGreaterThan(60)
    }
  })

  it('🔴 en reflejo, el motivo dice QUÉ HACER: cambiar de modo', () => {
    // Un «no se sabe» sin salida manda a buscar una avería que no hay.
    expect(motivoDeDuda({ rg: 0.5, bg: 0.5 }, 'REFLEJO')).toContain('modo emisión')
    expect(motivoDeDuda({ rg: 0.5, bg: 0.5 }, 'REFLEJO')).toContain('invertido')
  })

  it('el verde a cero se explica distinto en cada modo', () => {
    expect(motivoDeDuda(null, 'EMISION')).toContain('nada encendido')
  })
})
