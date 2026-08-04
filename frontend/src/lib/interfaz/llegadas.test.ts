import { describe, expect, it } from 'vitest'
import {
  LLEGADAS_VACIAS, RITMO_MEDIDO_HZ, acumularLlegada, ritmoMedidoDe, ritmoObservado,
} from './llegadas'

describe('acumularLlegada', () => {
  it('la primera llegada fija los dos extremos', () => {
    const l = acumularLlegada(LLEGADAS_VACIAS, 1000)
    expect(l).toEqual({ n: 1, tPrimero: 1000, tUltimo: 1000 })
  })

  it('las siguientes solo mueven el ultimo', () => {
    const l = acumularLlegada(acumularLlegada(LLEGADAS_VACIAS, 1000), 1060)
    expect(l).toEqual({ n: 2, tPrimero: 1000, tUltimo: 1060 })
  })

  it('no muta lo que recibe: el objeto anterior sigue igual', () => {
    const antes = acumularLlegada(LLEGADAS_VACIAS, 1000)
    acumularLlegada(antes, 2000)
    expect(antes).toEqual({ n: 1, tPrimero: 1000, tUltimo: 1000 })
    expect(LLEGADAS_VACIAS).toEqual({ n: 0, tPrimero: null, tUltimo: null })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El ritmo: null NO es cero
// ═══════════════════════════════════════════════════════════════════════════
describe('ritmoObservado', () => {
  it('16 mensajes en 909 ms dan ~16,5 Hz, que es el ritmo medido de /odom', () => {
    // 15 intervalos de 60,6 ms = 909 ms. Es el periodo real: el firmware del RVR
    // no baja de interval=60 ms y cuantiza a multiplos de 20.
    const r = ritmoObservado({ n: 16, tPrimero: 0, tUltimo: 909 })
    expect(r).not.toBeNull()
    expect(r ?? 0).toBeCloseTo(16.5, 1)
  })

  it('🔴 sin ninguna llegada devuelve null, NUNCA 0', () => {
    // Devolver 0 seria afirmar «este topic va a cero Hz» sin haber medido nada.
    expect(ritmoObservado(LLEGADAS_VACIAS)).toBeNull()
  })

  it('🔴 con UNA sola llegada tambien null: no hay ningun intervalo que medir', () => {
    const r = ritmoObservado({ n: 1, tPrimero: 5000, tUltimo: 5000 })
    expect(r).toBeNull()
    expect(r).not.toBe(0)
  })

  it('🔴 un intervalo NEGATIVO (salto de NTP hacia atras) da null, no un ritmo negativo', () => {
    // `Date.now()` no es monotono. Sin esta guarda saldria un numero negativo con
    // aspecto de medida. Es la misma proteccion que `fresco()` en salud.ts.
    expect(ritmoObservado({ n: 10, tPrimero: 5000, tUltimo: 4000 })).toBeNull()
  })

  it('un intervalo de cero tambien da null: dividir por cero da Infinity', () => {
    expect(ritmoObservado({ n: 5, tPrimero: 1000, tUltimo: 1000 })).toBeNull()
  })
})

describe('ritmoMedidoDe — solo lo que alguien ha medido', () => {
  it('/odom, /encoders, /motor_status y /battery_state tienen valor medido', () => {
    expect(ritmoMedidoDe('/odom')).toBeCloseTo(16.53, 2)
    expect(ritmoMedidoDe('/encoders')).toBeCloseTo(16.57, 2)
    expect(ritmoMedidoDe('/motor_status')).toBe(1)
    expect(ritmoMedidoDe('/battery_state')).toBeCloseTo(1 / 30, 6)
  })

  it('🔴 /imu NO tiene ritmo de referencia, y es deliberado', () => {
    // Tres tomas dieron 13,338 · 16,297 · 16,505 Hz: un ±11 % que este proyecto
    // NO tiene explicado. Poner un numero suelto seria inventar una precision.
    expect(ritmoMedidoDe('/imu')).toBeUndefined()
    expect(Object.keys(RITMO_MEDIDO_HZ)).not.toContain('/imu')
  })

  it('🔴 /scan tampoco: su ritmo depende del giro libre del motor del X2', () => {
    expect(ritmoMedidoDe('/scan')).toBeUndefined()
  })
})
