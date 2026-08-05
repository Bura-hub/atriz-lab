import { describe, expect, it } from 'vitest'
import { Baldosa } from './resumen'
import { ordenarBaldosas } from './orden'

const ficha = (id: number, atencion: Baldosa['atencion']) => ({
  id,
  baldosa: { atencion } as Baldosa,
})

describe('ordenarBaldosas — por número es lo de siempre', () => {
  it('devuelve los robots en su orden natural', () => {
    const r = ordenarBaldosas([ficha(3, 'IR'), ficha(1, 'NINGUNA'), ficha(2, 'MIRAR')], 'NUMERO')
    expect(r.map((f) => f.id)).toEqual([1, 2, 3])
  })

  it('🔴 la atención NO altera el orden por número', () => {
    // Es la garantía entera de este modo: la posición de cada robot en el muro
    // no puede depender de su estado, o deja de ser memoria muscular.
    const r = ordenarBaldosas([ficha(1, 'NINGUNA'), ficha(2, 'IR')], 'NUMERO')
    expect(r.map((f) => f.id)).toEqual([1, 2])
  })
})

describe('ordenarBaldosas — por atención', () => {
  it('IR primero, luego MIRAR, luego el resto', () => {
    const r = ordenarBaldosas(
      [ficha(1, 'NINGUNA'), ficha(2, 'MIRAR'), ficha(3, 'IR')],
      'ATENCION',
    )
    expect(r.map((f) => f.id)).toEqual([3, 2, 1])
  })

  it('🔴 empata SIEMPRE por número, en los dos modos', () => {
    /*
     * Sin desempate estable, dos robots con la misma atención podrían
     * intercambiarse de sitio en cada render —el orden de `sort` no está
     * garantizado entre elementos iguales en todos los motores— y el muro
     * bailaría solo. Es el mismo fallo que el módulo existe para evitar,
     * colado por la puerta de atrás.
     */
    const r = ordenarBaldosas(
      [ficha(9, 'IR'), ficha(4, 'IR'), ficha(7, 'MIRAR'), ficha(2, 'MIRAR')],
      'ATENCION',
    )
    expect(r.map((f) => f.id)).toEqual([4, 9, 2, 7])
  })
})

describe('ordenarBaldosas — no muta', () => {
  it('la lista original se queda como estaba', () => {
    const original = [ficha(3, 'IR'), ficha(1, 'NINGUNA')]
    ordenarBaldosas(original, 'NUMERO')
    expect(original.map((f) => f.id)).toEqual([3, 1])
  })
})
