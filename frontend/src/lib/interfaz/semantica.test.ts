import { describe, expect, it } from 'vitest'
import { SIN_DATO } from './formato'
import { marcasDe, marcasDefectuosas, sinEtiquetas } from './semantica'

describe('marcasDe', () => {
  it('saca el valor de maquina y el texto de persona', () => {
    expect(marcasDe('<data value="7.42" class="x">7,42 V</data>'))
      .toEqual([{ value: '7.42', texto: '7,42 V' }])
  })

  it('atraviesa las etiquetas que React mete dentro', () => {
    expect(marcasDe('<data value="27.5"><span>27,5</span> °C</data>')[0].texto).toBe('27,5 °C')
  })

  it('un HTML sin marcas devuelve una lista vacia', () => {
    expect(marcasDe('<p>nada que ver</p>')).toEqual([])
  })
})

describe('sinEtiquetas', () => {
  it('deja el texto legible', () => {
    expect(sinEtiquetas('<b>8,29</b>&nbsp;V')).toBe('8,29 V')
  })
})

describe('marcasDefectuosas — lo que un <data> no puede hacer', () => {
  it('un valor de verdad pasa', () => {
    expect(marcasDefectuosas([{ value: '7.42', texto: '7,42 V' }], SIN_DATO)).toEqual([])
  })

  it('🔴 value vacio: afirma un dato legible por maquina que no existe', () => {
    // Es la «simplificacion» que rompe la regla: igualar las dos ramas de `Dato`
    // poniendo value="" para que siempre haya <data>. Es lo PEOR de las dos
    // opciones -promete y no cumple- y por eso el elemento desaparece entero.
    const f = marcasDefectuosas([{ value: '', texto: 'no se sabe' }], SIN_DATO)
    expect(f.length).toBeGreaterThan(0)
    expect(f[0]).toContain('afirma un dato que no existe')
  })

  it('🔴 value no numerico: un NaN o un undefined colado como texto', () => {
    // `String(NaN)` es «NaN» y `String(undefined)` es «undefined»: los dos se
    // serializan sin quejarse y quedan en el HTML pareciendo un dato.
    expect(marcasDefectuosas([{ value: 'NaN', texto: '—' }], SIN_DATO)[0]).toContain('no es un numero')
    expect(marcasDefectuosas([{ value: 'undefined', texto: '—' }], SIN_DATO)).toHaveLength(1)
  })

  it('🔴 «no se sabe» DENTRO de un <data> es la contradiccion directa', () => {
    const f = marcasDefectuosas([{ value: '0', texto: SIN_DATO }], SIN_DATO)
    expect(f.some((x) => x.includes('NO puede ir dentro'))).toBe(true)
  })

  it('un cero SI es un dato, y no se confunde con un hueco', () => {
    // 0,00 V es una medida. La regla distingue «no hay valor» de «el valor es
    // cero», que es justamente lo que un `value=""` borraria.
    expect(marcasDefectuosas([{ value: '0', texto: '0,00 V' }], SIN_DATO)).toEqual([])
  })
})
