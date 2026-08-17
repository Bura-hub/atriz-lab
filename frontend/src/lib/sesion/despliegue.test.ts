import { describe, expect, it } from 'vitest'
import { TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { ROBOTS_QUE_EXIGEN_CREDENCIAL, alcanceDeCredencial, concordancia } from './despliegue'

describe('alcance de la credencial en la flota', () => {
  it('ninguno, algunos y todos son tres cosas distintas', () => {
    expect(alcanceDeCredencial(0, 16)).toBe('NINGUNO')
    expect(alcanceDeCredencial(1, 16)).toBe('ALGUNOS')
    expect(alcanceDeCredencial(15, 16)).toBe('ALGUNOS')
    expect(alcanceDeCredencial(16, 16)).toBe('TODOS')
  })

  /*
   * 🔴 El borde que importa: con UNA flota de un solo robot, «uno» y «todos»
   *    son el mismo número. Sin este caso, un `exigen === 1 -> ALGUNOS` escrito
   *    a la ligera diria «algunos» de una flota completa.
   */
  it('en una flota de uno, ese uno son TODOS', () => {
    expect(alcanceDeCredencial(1, 1)).toBe('TODOS')
    expect(alcanceDeCredencial(0, 1)).toBe('NINGUNO')
  })

  it('revienta con numeros que no pueden describir una flota', () => {
    expect(() => alcanceDeCredencial(17, 16)).toThrow()   // mas de los que hay
    expect(() => alcanceDeCredencial(-1, 16)).toThrow()
    expect(() => alcanceDeCredencial(1.5, 16)).toThrow()
    expect(() => alcanceDeCredencial(1, 0)).toThrow()
    expect(() => alcanceDeCredencial(1, -3)).toThrow()
  })
})

describe('concordancia de numero', () => {
  it('en singular con uno', () => {
    const c = concordancia(1)
    expect(c.exige).toBe('la exige')
    expect(c.ese).toBe('ese robot')
    expect(c.cierra).toBe('cierra')
    expect(c.hace).toBe('hace')
  })

  it('en plural con cualquier otro numero, incluido el cero', () => {
    for (const n of [0, 2, 15, 16]) {
      const c = concordancia(n)
      expect(c.exige, `con ${n}`).toBe('la exigen')
      expect(c.ese, `con ${n}`).toBe('esos robots')
      expect(c.cierra, `con ${n}`).toBe('cierran')
      expect(c.hace, `con ${n}`).toBe('hacen')
    }
  })

  /*
   * 🔴 El caso que de verdad importa y es el FUTURO de esta pantalla: cuando la
   *    imagen dorada llegue a la flota, el numero pasa a 16 y la frase tiene que
   *    seguir bien escrita SIN que nadie se acuerde de revisarla.
   */
  it('con la flota entera la frase sigue leyendose bien', () => {
    expect(concordancia(TOTAL_ROBOTS).exige).toBe('la exigen')
  })
})

describe('lo que la portada puede afirmar HOY', () => {
  /*
   * 🔴 ESTA PRUEBA NO COMPRUEBA QUE EL NUMERO SEA VERDAD — no puede: la verdad
   *    vive en los robots y esta maquina no les pregunta, a proposito. Lo que
   *    fija es que el numero sea COHERENTE, y sobre todo que **cambiarlo obligue
   *    a pasar por aqui**: si alguien lo sube a 16 porque desplego la Fase B a
   *    la flota, esta prueba se pone en rojo y le hace mirar la frase de la
   *    portada, que es lo unico que de verdad hay que revisar.
   */
  it('hoy la exige 1 de los 16, y por eso la portada NO puede decir «los robots»', () => {
    expect(ROBOTS_QUE_EXIGEN_CREDENCIAL).toBe(1)
    expect(alcanceDeCredencial(ROBOTS_QUE_EXIGEN_CREDENCIAL, TOTAL_ROBOTS)).toBe('ALGUNOS')
  })

  it('el numero cabe en la flota', () => {
    expect(ROBOTS_QUE_EXIGEN_CREDENCIAL).toBeGreaterThanOrEqual(0)
    expect(ROBOTS_QUE_EXIGEN_CREDENCIAL).toBeLessThanOrEqual(TOTAL_ROBOTS)
  })
})
