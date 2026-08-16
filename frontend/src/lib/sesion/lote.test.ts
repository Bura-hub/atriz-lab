import { describe, expect, it } from 'vitest'
import { PALABRAS_POR_FRASE, TOPE_LOTE, frase, planDeLote } from './lote'
import { MINIMO_CONTRASENA, revisarAlta } from './reglas'

/** Un generador determinista, para poder afirmar la forma sin afirmar el azar. */
const secuencia = (...n: number[]) => {
  let i = 0
  return () => n[i++ % n.length]
}

describe('el alta de una clase entera', () => {
  describe('el plan, que se calcula ANTES de tocar nada', () => {
    it('crea el rango con el numero rellenado a dos cifras', () => {
      const p = planDeLote({ prefijo: 'alumno', desde: 1, hasta: 3, existentes: [] })
      expect(p.error).toBeNull()
      expect(p.nuevas).toEqual(['alumno-01', 'alumno-02', 'alumno-03'])
      expect(p.choques).toEqual([])
    })

    it('🔴 los que ya existen se SALTAN y se dicen, no son un error', () => {
      // Es lo que hace quien amplia el grupo a mitad de semestre: pedir 1..16
      // teniendo del 1 al 8. Fallar entero ahi seria obligar a calcular el rango
      // a mano.
      const p = planDeLote({
        prefijo: 'alumno', desde: 1, hasta: 4, existentes: ['alumno-02', 'ALUMNO-04'],
      })
      expect(p.error).toBeNull()
      expect(p.nuevas).toEqual(['alumno-01', 'alumno-03'])
      expect(p.choques).toEqual(['alumno-02', 'alumno-04'])
    })

    it('compara normalizando: mayusculas y espacios no crean duplicados', () => {
      const p = planDeLote({ prefijo: '  ALUMNO ', desde: 1, hasta: 1, existentes: [' Alumno-01 '] })
      expect(p.nuevas).toEqual([])
      expect(p.choques).toEqual(['alumno-01'])
    })

    it('🔴 valida el nombre COMPLETO, no el prefijo suelto', () => {
      // Un prefijo de dos letras pasa `revisarAlta` por su cuenta (el minimo son
      // 3), pero `ab-01` tambien; lo que falla son los caracteres. Se comprueba
      // lo que de verdad se va a guardar.
      expect(planDeLote({ prefijo: 'Ana Pérez', desde: 1, hasta: 2, existentes: [] }).error)
        .toMatch(/minúsculas|caracteres/i)
    })

    it('rechaza rangos imposibles, cada uno con su motivo', () => {
      const err = (p: Parameters<typeof planDeLote>[0]) => planDeLote(p).error
      expect(err({ prefijo: 'a1', desde: 0, hasta: 3, existentes: [] })).toMatch(/empezando en 1/)
      expect(err({ prefijo: 'a1', desde: 5, hasta: 2, existentes: [] })).toMatch(/mayor o igual/)
      expect(err({ prefijo: 'a1', desde: 1.5, hasta: 3, existentes: [] })).toMatch(/enteros/)
      expect(err({ prefijo: 'a1', desde: 1, hasta: TOPE_LOTE + 1, existentes: [] }))
        .toMatch(new RegExp(String(TOPE_LOTE)))
    })

    it('✅ EL CONTROL: el tope deja pasar una clase de verdad', () => {
      // Sin esto, un tope mal puesto haria fallar el caso que el lote existe
      // para resolver: los 16 del laboratorio.
      const p = planDeLote({ prefijo: 'alumno', desde: 1, hasta: 16, existentes: [] })
      expect(p.error).toBeNull()
      expect(p.nuevas).toHaveLength(16)
      expect(p.nuevas[15]).toBe('alumno-16')
    })

    it('🔴 y NO crea nada cuando hay error: las listas salen vacias', () => {
      // Si devolviera las nuevas junto al error, quien no mire el error creara
      // cuentas con nombres invalidos.
      const p = planDeLote({ prefijo: 'X X', desde: 1, hasta: 3, existentes: [] })
      expect(p.error).not.toBeNull()
      expect(p.nuevas).toEqual([])
      expect(p.choques).toEqual([])
    })
  })

  describe('la contraseña generada', () => {
    it('son cuatro palabras con guiones', () => {
      const f = frase(secuencia(0, 1, 2, 3))
      expect(f.split('-')).toHaveLength(PALABRAS_POR_FRASE)
    })

    it('🔴 pasa `revisarAlta` con margen, que es lo que tiene que probar', () => {
      // Generar una contraseña que el propio validador rechaza seria un alta
      // masiva que falla en la ultima linea. Se prueba contra el validador REAL,
      // no contra una copia de sus reglas.
      const f = frase(secuencia(0, 1, 2, 3))
      expect(revisarAlta('alumno-01', f)).toBeNull()
      expect(f.length).toBeGreaterThan(MINIMO_CONTRASENA)
    })

    it('🔴 y lo pasa con la combinacion MAS CORTA posible', () => {
      // El caso peor: cuatro veces la palabra mas corta de la lista. Si ese pasa,
      // pasan todos — y si no, el fallo saldria una vez de cada tantas, que es la
      // peor forma de fallar.
      const f = frase(() => 0)
      expect(revisarAlta('alumno-01', f), `la mas corta: «${f}»`).toBeNull()
    })

    it('⚠️ NO usa `Math.random`: el generador se inyecta', () => {
      // Este fichero no puede saber si el azar que le pasan es bueno, asi que lo
      // EXIGE en vez de elegirlo. Con un generador predecible la contraseña no
      // protege, y eso tiene que ser una decision visible de quien llama.
      const a = frase(secuencia(0, 1, 2, 3))
      const b = frase(secuencia(0, 1, 2, 3))
      expect(a).toBe(b)
    })
  })

  describe('🔴 las palabras: lo que hace que se puedan teclear', () => {
    it('ninguna lleva acento ni eñe', () => {
      // Se teclean en el portatil del aula, a veces con otra distribucion. Una
      // tilde convierte «no me entra» en un problema de teclado que nadie
      // diagnostica.
      const todas = frase(() => 0)
      for (let i = 0; i < 64; i++) {
        const f = frase(secuencia(i))
        expect(f, `palabra ${i}`).toMatch(/^[a-z-]+$/)
      }
      expect(todas).toMatch(/^[a-z-]+$/)
    })

    it('✅ EL CONTROL: hay bastantes palabras para que la frase valga algo', () => {
      // 4 palabras de N dan N^4 combinaciones. Con 60 son ~13 millones (~23,7
      // bits); con 6 serian 1296, o sea nada. Este control impide que alguien
      // recorte la lista sin darse cuenta de lo que cuesta.
      const distintas = new Set<string>()
      for (let i = 0; i < 200; i++) distintas.add(frase(secuencia(i)).split('-')[0])
      expect(distintas.size).toBeGreaterThanOrEqual(60)
    })
  })
})
