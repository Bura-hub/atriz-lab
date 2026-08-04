import { describe, expect, it } from 'vitest'
import {
  conDireccion,
  cuantasPuestas,
  destinoDe,
  escribirDirecciones,
  leerDirecciones,
  validarDireccion,
} from './direcciones'
import { urlDeRobot } from '../rosbridge/transporte'

describe('destinoDe — sin override no cambia NADA', () => {
  it('sin nada guardado devuelve el numero, o sea rvr-NN.local', () => {
    expect(destinoDe(1, {})).toBe(1)
    expect(urlDeRobot(destinoDe(1, {}))).toBe('ws://rvr-01.local:9090')
  })

  it('con override devuelve la cadena y la URL apunta ahi', () => {
    const d = { '1': '192.168.1.58' }
    expect(destinoDe(1, d)).toBe('192.168.1.58')
    expect(urlDeRobot(destinoDe(1, d))).toBe('ws://192.168.1.58:9090')
  })

  it('el override de un robot no afecta a los demas', () => {
    const d = { '1': '192.168.1.58' }
    expect(urlDeRobot(destinoDe(2, d))).toBe('ws://rvr-02.local:9090')
  })

  it('una cadena vacia guardada NO cuenta como override', () => {
    expect(destinoDe(1, { '1': '' })).toBe(1)
  })
})

describe('validarDireccion — lo que NO se acepta, y por que', () => {
  it('acepta una IPv4 y un nombre de maquina', () => {
    expect(validarDireccion('192.168.1.58')).toEqual({ ok: true, valor: '192.168.1.58' })
    expect(validarDireccion('  rvr-01.local  ')).toEqual({ ok: true, valor: 'rvr-01.local' })
  })

  it('🔴 rechaza el puerto: rosbridge esta en el 9090 en los 16', () => {
    /*
     * Sin esto, `192.168.1.58:9091` produciria
     * `ws://192.168.1.58:9091:9090` — una URL rota que falla sin decir por que,
     * y este proyecto ya tiene demasiados fallos silenciosos.
     */
    const r = validarDireccion('192.168.1.58:9091')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toMatch(/9090/)
    expect(urlDeRobot('192.168.1.58:9091')).toBe('ws://192.168.1.58:9091:9090')  // lo que se evita
  })

  it('rechaza esquema, ruta y espacios', () => {
    for (const malo of ['ws://192.168.1.58', 'http://rvr-01.local', '192.168.1.58/ros', 'a b']) {
      expect(validarDireccion(malo).ok, malo).toBe(false)
    }
  })

  it('rechaza vacio y caracteres raros', () => {
    for (const malo of ['', '   ', '<script>', '192.168.1.58;rm']) {
      expect(validarDireccion(malo).ok, JSON.stringify(malo)).toBe(false)
    }
  })
})

describe('leerDirecciones — nunca lanza, y revalida lo guardado', () => {
  it('lee lo que escribio escribirDirecciones', () => {
    const d = { '1': '192.168.1.58', '7': '10.14.7.7' }
    expect(leerDirecciones(escribirDirecciones(d))).toEqual(d)
  })

  it('ante basura devuelve vacio en vez de romper la pagina', () => {
    for (const basura of [null, '', 'no soy json', '[1,2]', '"cadena"', '42']) {
      expect(leerDirecciones(basura), JSON.stringify(basura)).toEqual({})
    }
  })

  it('🔴 revalida al LEER, no solo al escribir', () => {
    // Lo guardado puede venir de otra version, de otra pestaña o de alguien
    // editandolo a mano. Una direccion con esquema armaria una URL rota.
    expect(leerDirecciones('{"1":"ws://192.168.1.58","2":"192.168.1.60"}'))
      .toEqual({ '2': '192.168.1.60' })
  })

  it('descarta claves que no son numeros y valores que no son texto', () => {
    expect(leerDirecciones('{"abc":"192.168.1.58","2":42,"3":"192.168.1.60"}'))
      .toEqual({ '3': '192.168.1.60' })
  })
})

describe('conDireccion', () => {
  it('pone, y el texto vacio QUITA', () => {
    const puesta = conDireccion({}, 1, '192.168.1.58')
    expect(puesta).toEqual({ '1': '192.168.1.58' })
    expect(conDireccion(puesta, 1, '')).toEqual({})
    expect(conDireccion(puesta, 1, '   ')).toEqual({})
  })

  it('una direccion invalida no guarda nada y no rompe lo que ya habia', () => {
    const antes = { '1': '192.168.1.58' }
    expect(conDireccion(antes, 2, 'ws://x')).toEqual(antes)
  })

  it('no muta lo que recibe', () => {
    const antes = { '1': '192.168.1.58' }
    conDireccion(antes, 2, '192.168.1.60')
    expect(antes).toEqual({ '1': '192.168.1.58' })
  })

  it('cuantasPuestas cuenta las que hay', () => {
    expect(cuantasPuestas({})).toBe(0)
    expect(cuantasPuestas({ '1': 'a', '2': 'b' })).toBe(2)
  })
})
