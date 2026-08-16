import { describe, expect, it } from 'vitest'
import {
  V_MIN, W_MAX, W_MIN, ZONA_MUERTA, dentroDeLoMedido, ordenDePalanca,
} from './palanca'

const R = 100
const V_MAX = 0.20

describe('ordenDePalanca', () => {
  it('en el centro no pide nada', () => {
    expect(ordenDePalanca(0, 0, R, V_MAX)).toEqual({ v: 0, w: 0 })
  })

  /*
   * 🔴 LA ZONA MUERTA. Sin ella, soltar el dedo a un pixel del centro deja una
   *    orden minima puesta y el bucle de 10 Hz la republica hasta que alguien
   *    suelte. Con un raton se nota; con un dedo en una tableta, no.
   */
  it('🔴 dentro de la zona muerta, cero', () => {
    for (const f of [0, 0.05, 0.1, ZONA_MUERTA - 0.001, ZONA_MUERTA]) {
      const o = ordenDePalanca(0, -f * R, R, V_MAX)
      expect(o, `a ${f} del radio deberia ser cero`).toEqual({ v: 0, w: 0 })
    }
  })

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 LA REGLA QUE JUSTIFICA TODO ESTE FICHERO
   * ═════════════════════════════════════════════════════════════════════════
   * De este robot solo hay medida una franja: lineal 0,20 y 0,40 al 100 %, y
   * angular entre 0,5 y 2,0 rad/s al 99-102 %. **Por debajo no hay dato.** Una
   * palanca continua puede pedir 0,02 m/s, que con orugas probablemente ni
   * arranque — y el alumno concluye «no obedece» sobre un robot sano.
   *
   * Se barre el recorrido ENTERO, no tres puntos: es la regla que este proyecto
   * tiene escrita con sangre, y ya se incumplió dos veces.
   */
  it('🔴 ninguna orden cae por debajo de lo medido, en TODO el recorrido', () => {
    let n = 0
    for (let f = 0; f <= 1.0001; f += 0.005) {
      for (const ang of [0, 30, 45, 60, 90, 135, 180, 225, 270, 315]) {
        const rad = (ang * Math.PI) / 180
        const o = ordenDePalanca(Math.cos(rad) * f * R, Math.sin(rad) * f * R, R, V_MAX)
        n++
        if (o.v !== 0) expect(Math.abs(o.v), `v=${o.v} a ${f}·${ang}°`).toBeGreaterThanOrEqual(V_MIN - 1e-9)
        if (o.w !== 0) expect(Math.abs(o.w), `w=${o.w} a ${f}·${ang}°`).toBeGreaterThanOrEqual(W_MIN - 1e-9)
        expect(Math.abs(o.v)).toBeLessThanOrEqual(V_MAX + 1e-9)
        expect(Math.abs(o.w)).toBeLessThanOrEqual(W_MAX + 1e-9)
        expect(dentroDeLoMedido(o, V_MAX), `fuera de lo medido a ${f}·${ang}°`).toBe(true)
      }
    }
    expect(n, 'el barrido no ha cubierto casi nada').toBeGreaterThan(1900)
  })

  it('al borde pide el tope', () => {
    expect(ordenDePalanca(0, -R, R, V_MAX).v).toBeCloseTo(V_MAX, 9)
    expect(ordenDePalanca(0, R, R, V_MAX).v).toBeCloseTo(-V_MAX, 9)
  })

  /*
   * 🔴 IZQUIERDA ES `w` POSITIVA. REP-103 —antihorario positivo— y el SDK del
   *    RVR lo cumple: verificado MIRANDO el robot, no deducido. La cruz de mando
   *    ya lo hacia asi, y girar al reves aqui habria puesto dos mandos de la
   *    misma pantalla en sentidos opuestos.
   */
  it('🔴 izquierda gira positivo, derecha negativo', () => {
    expect(ordenDePalanca(-R, 0, R, V_MAX).w).toBeGreaterThan(0)
    expect(ordenDePalanca(R, 0, R, V_MAX).w).toBeLessThan(0)
  })

  it('adelante es v positiva, aunque el DOM crezca hacia abajo', () => {
    expect(ordenDePalanca(0, -R, R, V_MAX).v).toBeGreaterThan(0)
    expect(ordenDePalanca(0, R, R, V_MAX).v).toBeLessThan(0)
  })

  /*
   * 🔴 SE RECORTA EL VECTOR, NO CADA EJE. Recortando por eje, la diagonal daria
   *    magnitud √2 — un 41 % mas que cualquier otra direccion— y el robot
   *    trazaria arcos mas rapidos cuanto mas diagonal fuera el gesto.
   */
  it('🔴 una diagonal fuera del circulo no pide mas que el borde', () => {
    const esquina = ordenDePalanca(R, -R, R, V_MAX)
    expect(Math.abs(esquina.v)).toBeLessThanOrEqual(V_MAX + 1e-9)
    expect(Math.abs(esquina.w)).toBeLessThanOrEqual(W_MAX + 1e-9)
    // Y la magnitud del vector normalizado es 1, asi que cada eje pide ~0,707.
    const recto = ordenDePalanca(0, -R, R, V_MAX)
    expect(Math.abs(esquina.v)).toBeLessThan(Math.abs(recto.v))
  })

  it('el deslizador manda sobre el techo lineal, no sobre el angular', () => {
    const lento = ordenDePalanca(0, -R, R, 0.12)
    expect(lento.v).toBeCloseTo(0.12, 9)
    // Con un techo lineal bajo, el giro sigue llegando a su propio tope.
    expect(ordenDePalanca(-R, 0, R, 0.12).w).toBeCloseTo(W_MAX, 9)
  })

  it('un radio imposible o un puntero raro no producen orden', () => {
    expect(ordenDePalanca(10, 10, 0, V_MAX)).toEqual({ v: 0, w: 0 })
    expect(ordenDePalanca(NaN, 0, R, V_MAX)).toEqual({ v: 0, w: 0 })
    expect(ordenDePalanca(0, Infinity, R, V_MAX)).toEqual({ v: 0, w: 0 })
  })
})

describe('dentroDeLoMedido', () => {
  /*
   * 🔴 HOY SIEMPRE ES `true`, Y POR ESO HACE FALTA. `ordenDePalanca` ya remapea
   *    a la franja medida; este es el control que se pondria rojo el dia que
   *    alguien cambie el remapeo y empiece a pedir valores sin medir.
   */
  it('caza una orden por debajo del suelo medido', () => {
    expect(dentroDeLoMedido({ v: 0.02, w: 0 }, 0.2)).toBe(false)
    expect(dentroDeLoMedido({ v: 0, w: 0.1 }, 0.2)).toBe(false)
  })

  it('el cero exacto sí vale: es «no pido nada»', () => {
    expect(dentroDeLoMedido({ v: 0, w: 0 }, 0.2)).toBe(true)
  })

  it('y caza pasarse por arriba', () => {
    expect(dentroDeLoMedido({ v: 0.5, w: 0 }, 0.2)).toBe(false)
    expect(dentroDeLoMedido({ v: 0, w: 3 }, 0.2)).toBe(false)
  })
})
