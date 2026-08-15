import { describe, expect, it } from 'vitest'
import {
  SALIDA_VACIA, TOPE_LINEAS_PANTALLA, anadir, cerrar, conRecorteDelAgente,
  estaVacia, faltaAlgo, texto,
} from './salida'

const conTexto = (...trozos: string[]) => trozos.reduce(anadir, SALIDA_VACIA)

describe('acumular lo que llega del PTY', () => {
  it('empieza vacía de verdad: ni una línea, ni un cursor', () => {
    expect(estaVacia(SALIDA_VACIA)).toBe(true)
    expect(texto(SALIDA_VACIA)).toBe('')
  })

  it('junta trozos partidos por la mitad', () => {
    // El PTY se lee por bloques: un `print()` puede llegar en dos pedazos.
    expect(texto(conTexto('ho', 'la\n'))).toBe('hola')
  })

  it('🔴 lo que NO acaba en salto de línea también se pinta', () => {
    /*
     * ES EL CASO DE `input()`. El aviso que el programa imprime antes de esperar
     * —«mide con el transportador y pulsa Enter»— NO lleva `\n`: si solo se
     * pintara lo terminado, el alumno vería una pantalla que se para sin decir
     * nada, esperando algo que no sabe que le han pedido.
     */
    const s = conTexto('¿cuántos grados ha girado? ')
    expect(texto(s)).toBe('¿cuántos grados ha girado? ')
    expect(estaVacia(s)).toBe(false)
  })

  it('la cola se completa cuando llega su salto', () => {
    const s = conTexto('45.', '0\n', 'siguiente')
    expect(texto(s)).toBe('45.0\nsiguiente')
  })

  it('cerrar recoge la última línea sin salto', () => {
    // Un `print(..., end='')` al final, o un `input()` sin contestar.
    expect(texto(cerrar(conTexto('a\nb sin salto')))).toBe('a\nb sin salto')
  })

  it('cerrar dos veces no duplica nada', () => {
    const una = cerrar(conTexto('x'))
    expect(texto(cerrar(una))).toBe(texto(una))
  })
})

describe('🔴 el tope de la pantalla', () => {
  it('recorta por ARRIBA y cuenta lo perdido', () => {
    /*
     * Un `<pre>` con dos millones de caracteres bloquea la pestaña CON EL ROBOT
     * EN MARCHA, y entonces el alumno no puede ni pulsar Parar.
     */
    const muchas = Array.from({ length: TOPE_LINEAS_PANTALLA + 500 }, (_, i) => `l${i}`)
    const s = conTexto(`${muchas.join('\n')}\n`)
    expect(s.lineas).toHaveLength(TOPE_LINEAS_PANTALLA)
    expect(s.perdidasArriba).toBe(500)
    // Se conserva el FINAL, que es lo que el alumno está mirando.
    expect(s.lineas.at(-1)).toBe(`l${TOPE_LINEAS_PANTALLA + 499}`)
  })

  it('por debajo del tope no se pierde nada', () => {
    const s = conTexto('a\nb\nc\n')
    expect(s.perdidasArriba).toBe(0)
    expect(faltaAlgo(s)).toBe('')
  })
})

describe('🔴 lo que falta se DICE, y con sus dos causas separadas', () => {
  it('lo que tiró esta pantalla', () => {
    const s = conTexto(`${Array.from({ length: 4200 }, (_, i) => i).join('\n')}\n`)
    expect(faltaAlgo(s)).toMatch(/faltan 200 del principio/)
  })

  it('lo que descartó el agente es OTRO número y OTRA causa', () => {
    /*
     * No se suman a propósito: lo que tiró esta pantalla se puede recuperar si
     * alguien guardó la salida en el robot; lo que tiró el agente NO EXISTE en
     * ninguna parte. Sumarlos daría un número más grande y menos útil.
     */
    const s = conRecorteDelAgente(conTexto('a\n'), 4210)
    const f = faltaAlgo(s)
    expect(f).toMatch(/el robot descartó 4210/)
    expect(f).not.toMatch(/del principio/)
  })

  it('con las dos causas, se dicen las dos', () => {
    const larga = conTexto(`${Array.from({ length: 4100 }, (_, i) => i).join('\n')}\n`)
    const f = faltaAlgo(conRecorteDelAgente(larga, 99))
    expect(f).toMatch(/del principio/)
    expect(f).toMatch(/el robot descartó 99/)
  })

  it('sin nada que decir, no dice nada', () => {
    // Un aviso que sale siempre se aprende a ignorar.
    expect(faltaAlgo(SALIDA_VACIA)).toBe('')
  })
})
