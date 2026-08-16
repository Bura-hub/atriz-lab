import { describe, expect, it } from 'vitest'
import {
  Caja, PALETA_IDENTIFICACION, conMemoria, svDesdePlano,
} from './selector_color'
import { aHSV, aRGB } from '../robot/color_led'

const CAJA: Caja = { left: 100, top: 50, width: 124, height: 124 }

describe('svDesdePlano', () => {
  it('la esquina de abajo a la izquierda es negro', () => {
    expect(svDesdePlano(100, 174, CAJA)).toEqual({ saturacion: 0, valor: 0 })
  })

  it('la esquina de arriba a la derecha es el color puro', () => {
    expect(svDesdePlano(224, 50, CAJA)).toEqual({ saturacion: 1, valor: 1 })
  })

  it('el centro es medio y medio', () => {
    const r = svDesdePlano(162, 112, CAJA)
    expect(r.saturacion).toBeCloseTo(0.5, 6)
    expect(r.valor).toBeCloseTo(0.5, 6)
  })

  /*
   * 🔴 EL PUNTERO SALE DE LA CAJA CONSTANTEMENTE, y es a propósito: con
   *    `setPointerCapture` el arrastre sigue fuera del cuadro para no cortar el
   *    gesto justo cuando se busca el borde, que es lo normal.
   */
  it('🔴 fuera de la caja se recorta, no se desborda', () => {
    for (const [x, y] of [[-500, -500], [9999, 9999], [0, 0], [1000, 60]] as const) {
      const r = svDesdePlano(x, y, CAJA)
      expect(r.saturacion, `x=${x}`).toBeGreaterThanOrEqual(0)
      expect(r.saturacion, `x=${x}`).toBeLessThanOrEqual(1)
      expect(r.valor, `y=${y}`).toBeGreaterThanOrEqual(0)
      expect(r.valor, `y=${y}`).toBeLessThanOrEqual(1)
    }
  })

  /*
   * ⚠️ Una caja de tamaño cero puede ocurrir de verdad: `getBoundingClientRect`
   *    sobre un elemento aún sin maquetar devuelve ceros, y dividir por eso da
   *    `Infinity` o `NaN` — que llegarían a `aRGB` y saldrían como un color
   *    inventado, no como un error.
   */
  it('🔴 una caja de tamaño cero no produce NaN', () => {
    const r = svDesdePlano(10, 10, { left: 0, top: 0, width: 0, height: 0 })
    expect(Number.isFinite(r.saturacion)).toBe(true)
    expect(Number.isFinite(r.valor)).toBe(true)
  })
})

describe('conMemoria', () => {
  const cian = { tono: 190, saturacion: 1, valor: 1 }

  it('un color con todo se acepta entero', () => {
    const r = conMemoria(cian, { tono: 40, saturacion: 0.8, valor: 0.6 })
    expect(r).toEqual({ tono: 40, saturacion: 0.8, valor: 0.6 })
  })

  /*
   * 🔴 UN GRIS NO TIENE TONO. `aHSV` devuelve 0, que es rojo, y aceptarlo movería
   *    el marcador al rojo sin que nadie tocara la rueda.
   */
  it('🔴 un gris conserva el tono que había', () => {
    const r = conMemoria(cian, { tono: 0, saturacion: 0, valor: 0.5 })
    expect(r.tono).toBe(190)
    expect(r.saturacion).toBe(0)
  })

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 EL DEFECTO REPRODUCIDO: «APAGAR» DESTRUÍA LA SATURACIÓN
   * ═══════════════════════════════════════════════════════════════════════════
   * El componente protegía el tono y **no la saturación**, así que pulsar
   * «Apagar» hacía saltar el marcador del plano de derecha a izquierda solo, y
   * después el teclado únicamente producía grises. Es el mismo fallo que la
   * cabecera del componente dice existir para evitar, cometido en el otro eje.
   */
  it('🔴 el negro conserva LAS DOS: tono y saturación', () => {
    const r = conMemoria(cian, { tono: 0, saturacion: 0, valor: 0 })
    expect(r.tono).toBe(190)
    expect(r.saturacion).toBe(1)
    expect(r.valor).toBe(0)
  })

  /*
   * El recorrido entero del defecto, tal cual se reprodujo: elegir un cian,
   * apagar, y volver a subir el brillo tiene que devolver **el cian**.
   */
  it('🔴 apagar y volver a encender recupera el color, no un gris', () => {
    const elegido = aHSV({ rojo: 0, verde: 170, azul: 255 })
    const trasApagar = conMemoria(elegido, aHSV({ rojo: 0, verde: 0, azul: 0 }))
    const trasSubirBrillo = { ...trasApagar, valor: 1 }
    const rgb = aRGB(trasSubirBrillo)
    expect(rgb.azul, 'el azul tiene que volver').toBeGreaterThan(200)
    expect(rgb.rojo, 'y no puede salir gris').toBeLessThan(60)
  })

  it('el valor entrante manda siempre: es lo único que un negro sí expresa', () => {
    expect(conMemoria(cian, { tono: 0, saturacion: 0, valor: 0 }).valor).toBe(0)
    expect(conMemoria(cian, { tono: 10, saturacion: 0.2, valor: 0.9 }).valor).toBe(0.9)
  })
})

describe('PALETA_IDENTIFICACION', () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 ES UNA PALETA DE EMISOR, NO DE PANTALLA — Y LA ANTERIOR NO LO ERA
   * ═══════════════════════════════════════════════════════════════════════════
   * La de antes eran los tonos de sección de la aplicación, validados como tinta
   * sobre papel: cinco de ocho por debajo de `valor` 0,67, Coral y Ámbar a 16° de
   * tono —el mismo naranja como luz— y un agujero de 118° sin verde.
   */
  it('🔴 todos los colores van a brillo máximo', () => {
    for (const p of PALETA_IDENTIFICACION) {
      expect(aHSV(p.rgb).valor, `${p.nombre}`).toBeCloseTo(1, 6)
    }
  })

  it('🔴 todos saturados menos el blanco, que lo es a propósito', () => {
    for (const p of PALETA_IDENTIFICACION) {
      const s = aHSV(p.rgb).saturacion
      if (p.nombre === 'Blanco') expect(s).toBe(0)
      else expect(s, `${p.nombre}`).toBeCloseTo(1, 6)
    }
  })

  /*
   * 🔴 NINGÚN PAR DE TONOS A MENOS DE 40°. Es el defecto de Coral y Ámbar, que
   *    estaban a 16 y como luz eran indistinguibles. Con ocho repartidos a 45°
   *    queda margen para el redondeo de `aHSV`.
   */
  it('🔴 ningún par de colores se parece', () => {
    const tonos = PALETA_IDENTIFICACION
      .filter((p) => p.nombre !== 'Blanco')
      .map((p) => aHSV(p.rgb).tono)
    for (let i = 0; i < tonos.length; i++) {
      for (let j = i + 1; j < tonos.length; j++) {
        const d = Math.abs(tonos[i] - tonos[j])
        const separacion = Math.min(d, 360 - d)
        expect(separacion, `${PALETA_IDENTIFICACION[i].nombre} vs ${PALETA_IDENTIFICACION[j].nombre}`)
          .toBeGreaterThanOrEqual(40)
      }
    }
  })

  it('🔴 la rueda no tiene agujeros: hay tono en los cuatro cuadrantes', () => {
    const cuadrantes = new Set(
      PALETA_IDENTIFICACION
        .filter((p) => p.nombre !== 'Blanco')
        .map((p) => Math.floor(aHSV(p.rgb).tono / 90)),
    )
    expect(cuadrantes.size).toBe(4)
  })

  it('los nombres no se repiten', () => {
    expect(new Set(PALETA_IDENTIFICACION.map((p) => p.nombre)).size)
      .toBe(PALETA_IDENTIFICACION.length)
  })
})
