import { describe, expect, it } from 'vitest'
import {
  ROBOTS, TOTAL_ROBOTS, destinoParaTransporte, esIPv4, etiquetaRobot, interpretarIdRobot,
  segmentoRobot,
} from './identidad'
import { urlDeRobot } from '../rosbridge/transporte'

describe('interpretarIdRobot — los numeros del laboratorio', () => {
  it('1 a 16 son robots', () => {
    for (const n of ROBOTS) {
      expect(interpretarIdRobot(String(n))).toEqual({ clase: 'NUMERO', numero: n })
    }
  })

  it('🔴 el 0 y el 17 NO son robots: la ruta tiene que dar 404', () => {
    // Adivinar un robot por defecto mandaria a alguien a mover un robot que no
    // pidio. Este laboratorio tiene 16, ni uno mas.
    expect(interpretarIdRobot('0')).toBeNull()
    expect(interpretarIdRobot(String(TOTAL_ROBOTS + 1))).toBeNull()
    expect(interpretarIdRobot('99')).toBeNull()
  })

  it('🔴 lo que no es un numero ni una IP se rechaza', () => {
    // Sin esto, `Number("abc")` da NaN y `urlDeRobot(NaN)` da
    // `ws://rvr-NaN.local:9090`: el sintoma seria «este robot no conecta», que se
    // busca en el robot y no en la URL.
    expect(interpretarIdRobot('abc')).toBeNull()
    expect(interpretarIdRobot('')).toBeNull()
    expect(interpretarIdRobot('rvr-01.local')).toBeNull()
    expect(interpretarIdRobot('evil.example.com')).toBeNull()
    expect(interpretarIdRobot('1.5')).toBeNull()
  })
})

describe('esIPv4 — el override documentado, y solo ese', () => {
  it('acepta una IPv4 de verdad', () => {
    expect(esIPv4('192.168.1.58')).toBe(true)
    expect(esIPv4('10.14.7.7')).toBe(true)
    expect(esIPv4('0.0.0.0')).toBe(true)
    expect(esIPv4('255.255.255.255')).toBe(true)
  })

  it('rechaza lo que no lo es', () => {
    expect(esIPv4('256.1.1.1')).toBe(false)
    expect(esIPv4('1.2.3')).toBe(false)
    expect(esIPv4('1.2.3.4.5')).toBe(false)
    expect(esIPv4('a.b.c.d')).toBe(false)
    expect(esIPv4('192.168.1.')).toBe(false)
  })

  it('🔴 un nombre de maquina cualquiera NO pasa: esta ruta abre un WebSocket', () => {
    // La aplicacion no tiene autenticacion -ni puede tenerla mientras hable con
    // rosbridge 2.7.0, que no la implementa-, asi que no se le regala un «abre un
    // socket a donde diga la URL».
    expect(interpretarIdRobot('atacante.example.com')).toBeNull()
  })
})

describe('interpretarIdRobot — la IP como override', () => {
  it('una IPv4 nombra un robot por direccion', () => {
    expect(interpretarIdRobot('192.168.1.58')).toEqual({ clase: 'DIRECCION', direccion: '192.168.1.58' })
  })
})

describe('el destino se traduce a lo que espera el transporte', () => {
  it('un numero da rvr-NN.local, con el cero delante', () => {
    const d = interpretarIdRobot('7')
    expect(d).not.toBeNull()
    if (d === null) return
    expect(destinoParaTransporte(d)).toBe(7)
    expect(urlDeRobot(destinoParaTransporte(d))).toBe('ws://rvr-07.local:9090')
    expect(etiquetaRobot(d)).toBe('rvr-07')
    expect(segmentoRobot(d)).toBe('7')
  })

  it('una direccion se usa tal cual como anfitrion', () => {
    const d = interpretarIdRobot('192.168.1.58')
    expect(d).not.toBeNull()
    if (d === null) return
    expect(destinoParaTransporte(d)).toBe('192.168.1.58')
    expect(urlDeRobot(destinoParaTransporte(d))).toBe('ws://192.168.1.58:9090')
    expect(etiquetaRobot(d)).toBe('192.168.1.58')
  })

  it('el robot 16 sigue siendo rvr-16 (dos digitos, sin relleno de mas)', () => {
    const d = interpretarIdRobot('16')
    expect(d).not.toBeNull()
    if (d === null) return
    expect(etiquetaRobot(d)).toBe('rvr-16')
  })
})

describe('la flota', () => {
  it('son 16 robots, del 1 al 16', () => {
    expect(TOTAL_ROBOTS).toBe(16)
    expect(ROBOTS).toHaveLength(16)
    expect(ROBOTS[0]).toBe(1)
    expect(ROBOTS[15]).toBe(16)
  })
})
