import { describe, expect, it } from 'vitest'
import { marcasVisibles, posicion, type Escala } from './escala'

const BATERIA: Escala = {
  min: 6.0,
  max: 8.4,
  marcas: [{ en: 6.5, nombre: 'crítica' }, { en: 7.0, nombre: 'baja' }],
}

describe('posicion', () => {
  it('sitúa un valor dentro del rango', () => {
    expect(posicion(6.0, BATERIA)).toBe(0)
    expect(posicion(8.4, BATERIA)).toBe(1)
    expect(posicion(7.2, BATERIA)).toBeCloseTo(0.5, 10)
  })

  it('recorta a los extremos en vez de salirse', () => {
    expect(posicion(5.0, BATERIA)).toBe(0)
    expect(posicion(9.9, BATERIA)).toBe(1)
  })

  /*
   * 🔴 EL CASO QUE ESTE PROYECTO YA PAGÓ. `limitar(nan)` devolvía **el tope**
   *    —0,40 m/s, el máximo— porque `abs(nan) <= tope` es `false` y caía en la
   *    rama de recorte; con el tope de tiempo, `avanzar(nan, nan)` habría
   *    conducido cuatro metros. Aquí el equivalente sería pintar el marcador en
   *    un extremo sobre un valor que no existe.
   *
   * ⚠️ Y se comprueba que da `null`, NO `0`: un marcador en el 0 % es
   *    indistinguible de un valor en el mínimo, o sea de una batería agotada.
   *    Fallar hacia «todo bien» y fallar hacia «alarma» son distintos, y este
   *    tiene que fallar hacia **no lo sé**.
   */
  it('🔴 NaN e Infinity dan null, no un extremo', () => {
    expect(posicion(NaN, BATERIA)).toBeNull()
    expect(posicion(Infinity, BATERIA)).toBeNull()
    expect(posicion(-Infinity, BATERIA)).toBeNull()
  })

  it('una escala imposible da null en vez de dividir por cero', () => {
    expect(posicion(5, { min: 5, max: 5 })).toBeNull()
    expect(posicion(5, { min: 8, max: 2 })).toBeNull()
    expect(posicion(5, { min: NaN, max: 10 })).toBeNull()
  })

  /*
   * Barre el rango ENTERO, no tres puntos. Es la regla de este proyecto escrita
   * con sangre: «un test que barre tres puntos representativos puede dejar sin
   * cubrir justo el tramo donde vive el bug» — y se cometió DOS veces, una de
   * ellas en el fichero que citaba la regla.
   */
  it('es monótona en todo el rango, no solo en tres puntos', () => {
    let previa = -1
    for (let v = 5.5; v <= 9.0; v += 0.01) {
      const p = posicion(v, BATERIA)
      expect(p).not.toBeNull()
      expect(p!).toBeGreaterThanOrEqual(previa)
      expect(p!).toBeGreaterThanOrEqual(0)
      expect(p!).toBeLessThanOrEqual(1)
      previa = p!
    }
  })
})

describe('marcasVisibles', () => {
  it('las ordena aunque lleguen desordenadas', () => {
    expect(marcasVisibles(BATERIA).map((m) => m.nombre)).toEqual(['crítica', 'baja'])
  })

  /*
   * 🔴 DESCARTA, no recorta. Un umbral recortado se pintaría pegado al extremo
   *    y afirmaría que está ahí — que es mentir sobre el dato más importante de
   *    la escala. Si un umbral no cabe, lo que está mal es la escala.
   */
  it('🔴 descarta la marca que no cabe, en vez de pegarla al borde', () => {
    const e: Escala = { min: 6, max: 8.4, marcas: [{ en: 2, nombre: 'fuera' }] }
    expect(marcasVisibles(e)).toEqual([])
  })

  it('descarta también las que caen justo en los extremos', () => {
    // En el extremo, la marca y el borde de la escala se solapan: dibujarla no
    // añade información y ensucia el canto.
    const e: Escala = { min: 6, max: 8, marcas: [{ en: 6, nombre: 'a' }, { en: 8, nombre: 'b' }] }
    expect(marcasVisibles(e)).toEqual([])
  })

  it('sin marcas devuelve lista vacía, no revienta', () => {
    expect(marcasVisibles({ min: 0, max: 1 })).toEqual([])
  })
})
