import { describe, expect, it } from 'vitest'
import {
  SIN_DATO, aGrados, antiguedad, celsius, grados, horaCorta, metros, metrosPorSegundo,
  milisegundos, numero, partirUnidad, radianesPorSegundo, segundos, voltios, yawDeCuaternion,
} from './formato'
import { interpretarAntiguedad } from '../rosbridge/contrato'

// ═══════════════════════════════════════════════════════════════════════════
// La regla que manda: un hueco NO es un cero
// ═══════════════════════════════════════════════════════════════════════════
describe('formato — la ausencia de dato tiene su propio texto', () => {
  it('null, undefined, NaN e Infinity son todos «no se sabe», nunca «0»', () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(numero(v, 2)).toBe(SIN_DATO)
      expect(voltios(v)).toBe(SIN_DATO)
      expect(celsius(v)).toBe(SIN_DATO)
      expect(metros(v)).toBe(SIN_DATO)
      expect(metrosPorSegundo(v)).toBe(SIN_DATO)
      expect(radianesPorSegundo(v)).toBe(SIN_DATO)
      expect(grados(v)).toBe(SIN_DATO)
      expect(segundos(v)).toBe(SIN_DATO)
      expect(milisegundos(v)).toBe(SIN_DATO)
    }
  })

  it('«no se sabe» no contiene ningun digito: nadie puede leerlo como una medida', () => {
    expect(SIN_DATO).toBe('no se sabe')
    expect(/\d/.test(SIN_DATO)).toBe(false)
  })

  it('un CERO de verdad si se escribe como cero: es una medida, no un hueco', () => {
    expect(voltios(0)).toBe('0,00 V')
    expect(metrosPorSegundo(0)).toBe('0,000 m/s')
  })
})

describe('formato — unidades', () => {
  it('la coma es el separador decimal, porque la interfaz esta en español', () => {
    expect(numero(8.29, 2)).toBe('8,29')
    expect(voltios(8.29)).toBe('8,29 V')
    expect(celsius(27.5)).toBe('27,5 °C')
  })

  it('los voltios van a dos decimales: 6,90 y 7,00 tienen que distinguirse', () => {
    // Son los dos lados del umbral de «baja» del firmware (7,0 V). Con un solo
    // decimal siguen distinguiendose; con cero, 6,9 se redondearia a 7.
    expect(voltios(6.9)).toBe('6,90 V')
    expect(voltios(7.0)).toBe('7,00 V')
  })

  it('los milisegundos pasan a segundos por encima de 1000, para leerse de lejos', () => {
    expect(milisegundos(432)).toBe('432 ms')
    expect(milisegundos(999)).toBe('999 ms')
    expect(milisegundos(1000)).toBe('1,0 s')
    expect(milisegundos(43128)).toBe('43,1 s')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La antiguedad: -1.0 es «no se sabe», no «hace cero segundos»
// ═══════════════════════════════════════════════════════════════════════════
describe('formato — antiguedad', () => {
  it('una antiguedad conocida se escribe con su numero', () => {
    expect(antiguedad(interpretarAntiguedad(12.4))).toBe('hace 12,4 s')
  })

  it('🔴 el -1.0 de /motor_status NO se pinta como «hace 0,0 s»', () => {
    const texto = antiguedad(interpretarAntiguedad(-1))
    expect(texto).toBe(SIN_DATO)
    expect(texto).not.toContain('0,0')
  })

  it('cero segundos SI es cero segundos: se acaba de sondear', () => {
    expect(antiguedad(interpretarAntiguedad(0))).toBe('hace 0,0 s')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El rumbo
// ═══════════════════════════════════════════════════════════════════════════
describe('formato — yawDeCuaternion', () => {
  it('el cuaternion identidad es 0°', () => {
    expect(yawDeCuaternion({ x: 0, y: 0, z: 0, w: 1 })).toBeCloseTo(0, 9)
  })

  it('90° antihorario (REP-103: positivo = antihorario) sale +90°', () => {
    const q = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }
    const yaw = yawDeCuaternion(q)
    expect(yaw).not.toBeNull()
    expect(aGrados(yaw ?? 0)).toBeCloseTo(90, 6)
  })

  it('180° sale ±180°', () => {
    const yaw = yawDeCuaternion({ x: 0, y: 0, z: 1, w: 0 })
    expect(Math.abs(aGrados(yaw ?? 0))).toBeCloseTo(180, 6)
  })

  it('🔴 un cuaternion incompleto da null, no un rumbo inventado', () => {
    // El `as` de useTopic es una asercion: un mensaje con otra forma llega igual.
    expect(yawDeCuaternion({ x: 0, y: 0, z: 0 })).toBeNull()
    expect(yawDeCuaternion({})).toBeNull()
    expect(yawDeCuaternion(null)).toBeNull()
    expect(yawDeCuaternion(undefined)).toBeNull()
  })

  it('🔴 un NaN dentro tampoco pasa por bueno', () => {
    expect(yawDeCuaternion({ x: 0, y: 0, z: Number.NaN, w: 1 })).toBeNull()
  })
})

describe('formato — horaCorta', () => {
  it('da hh:mm:ss con dos digitos siempre', () => {
    const t = new Date(2026, 7, 4, 9, 5, 3).getTime()
    expect(horaCorta(t)).toBe('09:05:03')
  })
})


describe('partirUnidad — el numero manda, la unidad acompaña', () => {
  it('separa los formatos que esta interfaz produce', () => {
    expect(partirUnidad('8,23 V')).toEqual({ numero: '8,23', unidad: 'V' })
    expect(partirUnidad('25,8 °C')).toEqual({ numero: '25,8', unidad: '°C' })
    expect(partirUnidad('0,000 m/s')).toEqual({ numero: '0,000', unidad: 'm/s' })
    expect(partirUnidad('3 ticks')).toEqual({ numero: '3', unidad: 'ticks' })
  })

  it('🔴 lo que no lleva junta se devuelve ENTERO, sin inventar una unidad', () => {
    // Partir por donde no hay separacion produciria basura: «−0,5°» no tiene
    // espacio, y «—» tampoco. Devolver `unidad: null` es la respuesta honesta.
    expect(partirUnidad('−0,5°')).toEqual({ numero: '−0,5°', unidad: null })
    expect(partirUnidad('—')).toEqual({ numero: '—', unidad: null })
    expect(partirUnidad('')).toEqual({ numero: '', unidad: null })
  })

  it('y un espacio final no crea una unidad vacia', () => {
    expect(partirUnidad('8,23 ')).toEqual({ numero: '8,23 ', unidad: null })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 EL CERO NEGATIVO — lo destapo una CAPTURA DE PANTALLA, no una prueba
//
// El 2026-08-10, mirando Conducir contra rvr-01 con el robot parado, la celda
// «MEDIDO · LINEAL» ponia **−0,000 m/s**. `numero()` tenia ya 30 casos y
// ninguno pasaba un valor entre −0,0005 y 0: la banda intermedia otra vez.
//
// No es cosmetico. En este proyecto el signo de una velocidad es LA DIRECCION
// DE LA MARCHA, y /odom trae negativos de verdad — asi que «menos cero» obliga
// a decidir si el robot retrocede muy despacio o esta quieto.
// ═══════════════════════════════════════════════════════════════════════════
describe('numero — el cero negativo no se pinta', () => {
  it('🔴 el caso VISTO en pantalla: -0,0004 m/s a tres decimales', () => {
    expect(numero(-0.0004, 3)).toBe('0,000')
    expect(numero(-0.0004, 3)).not.toBe('-0,000')
  })

  it('el cero negativo de JavaScript tampoco', () => {
    expect(numero(-0, 3)).toBe('0,000')
    expect(numero(-0, 0)).toBe('0')
  })

  it('barre la banda entera, no tres puntos', () => {
    // De casi -0,0005 a 0: ninguno puede salir con signo a 3 decimales.
    for (let i = 1; i <= 49; i++) {
      const v = -i / 100000          // -0,00001 .. -0,00049
      expect(numero(v, 3), `v=${v}`).toBe('0,000')
    }
  })

  it('🔴 pero un negativo DE VERDAD conserva su signo', () => {
    // La guarda protege el cero, no la direccion. Si se comiera esto, la
    // pantalla diria que el robot avanza cuando retrocede.
    expect(numero(-0.001, 3)).toBe('-0,001')
    expect(numero(-0.1, 3)).toBe('-0,100')
    expect(numero(-12.5, 1)).toBe('-12,5')
  })

  it('y el positivo no cambia', () => {
    expect(numero(0, 3)).toBe('0,000')
    expect(numero(0.0004, 3)).toBe('0,000')
    expect(numero(0.199, 3)).toBe('0,199')
  })
})
