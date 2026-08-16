import { describe, expect, it } from 'vitest'
import { conTecla, direccionDeTecla, escribiendo, mandoVigente, sinTecla } from './teclado'

describe('direccionDeTecla', () => {
  it('flechas y WASD dan la misma dirección', () => {
    expect(direccionDeTecla('ArrowUp')).toEqual(direccionDeTecla('w'))
    expect(direccionDeTecla('ArrowDown')).toEqual(direccionDeTecla('s'))
    expect(direccionDeTecla('ArrowLeft')).toEqual(direccionDeTecla('a'))
    expect(direccionDeTecla('ArrowRight')).toEqual(direccionDeTecla('d'))
  })

  /*
   * 🔴 CON BLOQ MAYÚS O CON SHIFT, `event.key` llega en MAYÚSCULA. Comparar
   *    contra `'w'` a secas dejaría el teclado muerto para quien tenga las
   *    mayúsculas puestas — y muerto **sin decir por qué**, que es el modo de
   *    fallo que este proyecto persigue.
   */
  it('🔴 acepta mayúsculas: Bloq Mayús no puede apagar el teclado', () => {
    expect(direccionDeTecla('W')).toEqual(direccionDeTecla('w'))
    expect(direccionDeTecla('ARROWUP')).toEqual(direccionDeTecla('ArrowUp'))
  })

  it('los signos coinciden con la cruz de mando', () => {
    // Adelante es +v; izquierda es +w (antihorario, REP-103, y el SDK del RVR
    // cumple: verificado mirando el robot).
    expect(direccionDeTecla('ArrowUp')).toMatchObject({ v: 1, w: 0 })
    expect(direccionDeTecla('ArrowDown')).toMatchObject({ v: -1, w: 0 })
    expect(direccionDeTecla('ArrowLeft')).toMatchObject({ v: 0, w: 1 })
    expect(direccionDeTecla('ArrowRight')).toMatchObject({ v: 0, w: -1 })
  })

  it('una tecla cualquiera no conduce', () => {
    for (const t of ['q', 'Enter', ' ', 'Escape', 'F5', '1', 'ñ']) {
      expect(direccionDeTecla(t), `«${t}» no debería conducir`).toBeNull()
    }
  })
})

describe('escribiendo', () => {
  /*
   * 🔴🔴 EL CASO QUE JUSTIFICA TODA ESTA FUNCIÓN: escribir una «a» en un campo
   *      no puede poner el robot a girar. Esta aplicación tiene campos en el
   *      editor del Taller, en el cuaderno, en el hexadecimal del color y en el
   *      buscador de robots.
   */
  it('🔴 un campo de texto se queda con la tecla', () => {
    expect(escribiendo('INPUT', false)).toBe(true)
    expect(escribiendo('TEXTAREA', false)).toBe(true)
    expect(escribiendo('SELECT', false)).toBe(true)
  })

  it('🔴 y un div editable también, aunque no sea ningún INPUT', () => {
    // Es el caso que se cuela si se mira solo la etiqueta.
    expect(escribiendo('DIV', true)).toBe(true)
  })

  it('un botón o el body NO se la quedan', () => {
    expect(escribiendo('BUTTON', false)).toBe(false)
    expect(escribiendo('BODY', false)).toBe(false)
    expect(escribiendo('div', false)).toBe(false)
  })
})

describe('mandoVigente', () => {
  it('sin teclas, null: eso significa PARAR', () => {
    expect(mandoVigente([])).toBeNull()
  })

  it('🔴 gana la ÚLTIMA pulsada, no la primera', () => {
    // Quien va hacia delante y pulsa «izquierda» sin soltar espera girar.
    expect(mandoVigente(['arrowup', 'arrowleft'])?.etiqueta).toBe('Izquierda')
    expect(mandoVigente(['arrowleft', 'arrowup'])?.etiqueta).toBe('Adelante')
  })

  it('🔴 y al soltar la última, vuelve a la que seguía pulsada', () => {
    const dos = conTecla(conTecla([], 'ArrowUp'), 'ArrowLeft')
    expect(mandoVigente(dos)?.etiqueta).toBe('Izquierda')
    expect(mandoVigente(sinTecla(dos, 'ArrowLeft'))?.etiqueta).toBe('Adelante')
  })

  it('ignora las que no conducen y sigue mirando hacia atrás', () => {
    expect(mandoVigente(['arrowup', 'q', 'shift'])?.etiqueta).toBe('Adelante')
  })
})

describe('conTecla / sinTecla', () => {
  /*
   * 🔴 EL AUTO-REPEAT DEL SISTEMA dispara `keydown` una y otra vez con la tecla
   *    abajo. Sin la guarda, la misma tecla entraría varias veces y soltarla UNA
   *    vez no la quitaría del todo: **el robot seguiría andando con la tecla ya
   *    suelta**. Es la clase de fallo que sale de un mecanismo del sistema
   *    operativo, no del código, y por eso se prueba explícitamente.
   */
  it('🔴 el auto-repeat no duplica la tecla', () => {
    let p: string[] = []
    for (let i = 0; i < 30; i++) p = conTecla(p, 'ArrowUp')
    expect(p).toEqual(['arrowup'])
    expect(sinTecla(p, 'ArrowUp')).toEqual([])
  })

  it('normaliza a minúscula al guardar y al quitar', () => {
    expect(conTecla([], 'ArrowUp')).toEqual(['arrowup'])
    expect(sinTecla(['arrowup'], 'ARROWUP')).toEqual([])
  })

  it('no muta la lista que recibe', () => {
    const original = ['arrowup']
    conTecla(original, 'a')
    sinTecla(original, 'arrowup')
    expect(original).toEqual(['arrowup'])
  })

  /*
   * Barre una secuencia larga de pulsar/soltar en desorden y comprueba que la
   * lista siempre acaba coherente. Es la regla del proyecto: barrer el recorrido
   * entero y no tres puntos representativos.
   */
  it('una secuencia larga en desorden nunca deja teclas fantasma', () => {
    const teclas = ['ArrowUp', 'ArrowLeft', 'w', 'd', 'ArrowDown']
    let p: string[] = []
    for (let i = 0; i < 200; i++) {
      const t = teclas[i % teclas.length]
      p = i % 3 === 0 ? sinTecla(p, t) : conTecla(p, t)
      expect(new Set(p).size, 'hay una tecla repetida').toBe(p.length)
    }
    for (const t of teclas) p = sinTecla(p, t)
    expect(p, 'al soltarlas todas tiene que quedar vacía').toEqual([])
    expect(mandoVigente(p)).toBeNull()
  })
})
