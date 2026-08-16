import { describe, expect, it } from 'vitest'
import { pideAlgo, resumenDeFlota } from './resumen_muro'
import { Baldosa } from './resumen'
import { EstadoRobot } from '../rosbridge/salud'

const IDS = [1, 2, 3, 4]
type A = Baldosa['atencion']

const ATENCIONES: A[] = ['NINGUNA', 'MIRAR', 'IR']
const ESTADOS: (EstadoRobot | undefined)[] = [undefined, 'SIN_CONEXION', 'EN_LINEA', 'SIN_DATOS']

describe('resumenDeFlota', () => {
  it('sin nada, todos en sin señal', () => {
    // Es el estado de la primera medio segundo: no ha llegado nada de nadie.
    expect(resumenDeFlota({}, {}, IDS)).toEqual({
      ir: 0, mirar: 0, enLinea: 0, sinSenal: 4, total: 4,
    })
  })

  /*
   * 🔴 `undefined` CUENTA COMO SIN SEÑAL, y es el lado correcto. Contarlo como
   *    «en línea» haría que el muro dijera «16 en línea» **antes de saber nada**,
   *    y ese medio segundo es lo primero que ve quien abre la página. No saber
   *    no es saber que está bien.
   */
  it('🔴 no saber no cuenta como estar bien', () => {
    const r = resumenDeFlota({}, { 1: 'EN_LINEA' }, IDS)
    expect(r.enLinea).toBe(1)
    expect(r.sinSenal).toBe(3)
  })

  /*
   * 🔴 `IR` GANA A TODO. Un robot con atasco confirmado y el enlace a ratos
   *    sigue siendo un robot al que hay que ir; contarlo en «sin señal» lo
   *    escondería en el cubo que la gente aprende a ignorar.
   */
  it('🔴 «hay que ir» gana al estado del enlace', () => {
    const r = resumenDeFlota({ 1: 'IR' }, { 1: 'SIN_DATOS' }, IDS)
    expect(r.ir).toBe(1)
    expect(r.sinSenal).toBe(3)
  })

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 «NO SE LLEGA A ÉL» GANA A «MIRAR» — y esta prueba exigía lo contrario
   * ═════════════════════════════════════════════════════════════════════════
   * Decía `expect(r.mirar).toBe(1)` con el enlace en `SIN_CONEXION`. **La
   * captura del muro lo desmintió**: «MIRAR 15» sobre quince baldosas que
   * decían «no llegó». Dos verdades en la misma pantalla, y la de la cifra
   * grande era la falsa.
   *
   * `BaldosaRobot` ya aplicaba esta precedencia al PINTAR —con `SIN_CONEXION`
   * dibuja vidrio y sin franja, aunque `atencion` siga valiendo MIRAR— y lo que
   * faltaba era aplicarla también al CONTAR.
   *
   * 📌 Y mis nueve pruebas pasaban todas: ninguna sabía qué pinta la baldosa.
   *    Por eso este proyecto exige mirar la pantalla.
   */
  it('🔴 un robot inalcanzable cuenta en «sin señal», aunque su atención sea MIRAR', () => {
    const r = resumenDeFlota({ 1: 'MIRAR' }, { 1: 'SIN_CONEXION' }, IDS)
    expect(r.mirar).toBe(0)
    expect(r.sinSenal).toBe(4)
  })

  it('pero con el socket abierto y mudo, MIRAR sí cuenta', () => {
    // `SIN_DATOS` es socket abierto sin datos: el robot está ahí y algo pasa.
    const r = resumenDeFlota({ 1: 'MIRAR' }, { 1: 'SIN_DATOS' }, IDS)
    expect(r.mirar).toBe(1)
    expect(r.sinSenal).toBe(3)
  })

  /*
   * 🔴 EL CASO DEL MURO CON LOS ROBOTS APAGADOS, que es el estado NORMAL del
   *    laboratorio: quince sin conexión y uno vivo. La cifra grande tiene que
   *    decir lo mismo que las baldosas.
   */
  it('🔴 quince apagados y uno vivo: 0 · 0 · 1 · 15', () => {
    const ids = Array.from({ length: 16 }, (_, i) => i + 1)
    const at: Record<number, 'MIRAR'> = {}
    const es: Record<number, 'SIN_CONEXION' | 'EN_LINEA'> = { 1: 'EN_LINEA' }
    for (let i = 2; i <= 16; i++) { at[i] = 'MIRAR'; es[i] = 'SIN_CONEXION' }
    expect(resumenDeFlota(at, es, ids)).toEqual({
      ir: 0, mirar: 0, enLinea: 1, sinSenal: 15, total: 16,
    })
  })

  it('un robot vivo y sin nada que pedir cuenta en línea', () => {
    const r = resumenDeFlota({ 1: 'NINGUNA' }, { 1: 'EN_LINEA' }, IDS)
    expect(r.enLinea).toBe(1)
  })

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 EL INVARIANTE: LOS CUATRO CUBOS PARTEN EL TOTAL
   * ═════════════════════════════════════════════════════════════════════════
   * Un resumen cuyas partes no suman invita a restar mentalmente y a sacar una
   * quinta categoría que no existe. Se barre **toda** la matriz —3 atenciones ×
   * 4 estados, sobre cuatro robots: 12⁴ combinaciones— en vez de tres casos
   * representativos, que es la regla que este proyecto ya incumplió dos veces.
   */
  it('🔴 los cuatro cubos suman SIEMPRE el total', () => {
    let n = 0
    for (const a1 of ATENCIONES) for (const e1 of ESTADOS) {
      for (const a2 of ATENCIONES) for (const e2 of ESTADOS) {
        const r = resumenDeFlota(
          { 1: a1, 2: a2 },
          { 1: e1, 2: e2 },
          IDS,
        )
        n++
        expect(r.ir + r.mirar + r.enLinea + r.sinSenal, JSON.stringify({ a1, e1, a2, e2 }))
          .toBe(r.total)
        expect(r.total).toBe(IDS.length)
        for (const v of [r.ir, r.mirar, r.enLinea, r.sinSenal]) {
          expect(v).toBeGreaterThanOrEqual(0)
        }
      }
    }
    expect(n, 'el barrido no ha cubierto la matriz').toBe(144)
  })

  it('un id que no está en la lista no se cuenta', () => {
    // Defensa contra un mapa rancio tras cambiar `ROBOTS`: si sobrara una
    // entrada, el total dejaría de cuadrar con lo que se pinta.
    const r = resumenDeFlota({ 99: 'IR' }, { 99: 'EN_LINEA' }, IDS)
    expect(r.ir).toBe(0)
    expect(r.total).toBe(4)
  })
})

describe('pideAlgo', () => {
  it('con «ir» o con «mirar», sí', () => {
    expect(pideAlgo({ ir: 1, mirar: 0, enLinea: 0, sinSenal: 3, total: 4 })).toBe(true)
    expect(pideAlgo({ ir: 0, mirar: 1, enLinea: 0, sinSenal: 3, total: 4 })).toBe(true)
  })

  /*
   * 🔴 «SIN SEÑAL» NO PIDE NADA, y es la decisión que evita un muro en alarma
   *    permanente: un robot cargando —RVR apagado con la Raspberry Pi viva— es
   *    el estado MÁS COMÚN del laboratorio. Un aviso que sale siempre deja de
   *    leerse.
   */
  it('🔴 dieciséis sin señal NO piden nada', () => {
    expect(pideAlgo({ ir: 0, mirar: 0, enLinea: 0, sinSenal: 16, total: 16 })).toBe(false)
  })
})
