import { describe, expect, it } from 'vitest'
import { Medida, aCSV, diferencia, leerMedidas } from './medidas'

const m = (p: Partial<Medida> = {}): Medida => ({
  id: 'a', cuando: 0, robot: 'rvr-01', que: 'avance',
  robotValor: 30.2, personaValor: 30, unidad: 'cm', nota: '', ...p,
})

describe('diferencia', () => {
  it('resta persona menos robot', () => {
    // Los numeros son los reales de la tarea 9: 30 de cinta contra 30,2.
    expect(diferencia(m())).toBeCloseTo(-0.2, 6)
  })

  it('🔴 con un hueco devuelve null, NUNCA un numero', () => {
    /*
     * Restar contra un hueco daria un numero que parece una medida. Es la regla
     * central del proyecto aplicada a la aritmetica: si falta un lado, no hay
     * diferencia, y decir «0» seria afirmar que coinciden.
     */
    expect(diferencia(m({ personaValor: null }))).toBeNull()
    expect(diferencia(m({ robotValor: null }))).toBeNull()
  })
})

describe('leerMedidas — nunca lanza', () => {
  it('ante basura devuelve vacio en vez de romper la pagina', () => {
    for (const b of [null, '', 'no soy json', '{"a":1}', '42', '"texto"']) {
      expect(leerMedidas(b), JSON.stringify(b)).toEqual([])
    }
  })

  it('🔴 descarta las entradas mal formadas y CONSERVA las buenas', () => {
    // Una version anterior del formato, o alguien editando a mano, no puede
    // tirar el cuaderno entero de un alumno.
    const crudo = JSON.stringify([m(), { id: 'x' }, m({ id: 'b' })])
    expect(leerMedidas(crudo).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('acepta los huecos, que son parte del formato', () => {
    const crudo = JSON.stringify([m({ personaValor: null })])
    expect(leerMedidas(crudo)).toHaveLength(1)
  })
})

describe('aCSV', () => {
  it('cabecera y una fila, con coma decimal', () => {
    const csv = aCSV([m({ cuando: 0 })]).split('\n')
    expect(csv[0]).toBe('fecha;robot;que;robot_valor;persona_valor;diferencia;unidad;nota')
    expect(csv[1]).toContain('30,2')
    expect(csv[1]).toContain('rvr-01')
  })

  it('🔴 un hueco sale VACIO en el CSV, no como cero', () => {
    const csv = aCSV([m({ personaValor: null })]).split('\n')[1]
    // ...;30,2;;;cm;...  -> el valor de persona y la diferencia, vacios
    expect(csv).toContain(';30,2;;;')
    expect(csv).not.toMatch(/;0;/)
  })

  it('escapa las comillas de una nota, para no romper la columna', () => {
    expect(aCSV([m({ nota: 'dijo "casi"' })])).toContain('"dijo ""casi"""')
  })
})
