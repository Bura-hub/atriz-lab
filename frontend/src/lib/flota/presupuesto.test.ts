import { describe, expect, it } from 'vitest'
import { CAUDAL_KBS, TOPICS_MURO, caudalDeFlota } from './presupuesto'

describe('caudalDeFlota — el presupuesto del muro', () => {
  it('el muro entero (16 robots, dos topics) cuesta ~7,7 kB/s', () => {
    // 0,03 + 0,45 = 0,48 kB/s por robot -> 7,68 con los 16.
    expect(caudalDeFlota(TOPICS_MURO, 16)).toBeCloseTo(7.68, 2)
  })

  it('🔴 añadir /odom al muro dispara el presupuesto por encima de 200 kB/s', () => {
    // Es el numero que decide que el muro NO lleve odometria: (0,48 + 13,05) x 16.
    expect(caudalDeFlota([...TOPICS_MURO, '/odom'], 16)).toBeGreaterThan(200)
  })

  it('/scan solo, en los 16, es un orden de magnitud peor que todo el resto junto', () => {
    const scan = caudalDeFlota(['/scan'], 16)
    const resto = caudalDeFlota(['/odom', '/imu', '/encoders', '/motor_status', '/battery_state'], 16)
    expect(scan).toBeGreaterThan(resto)
    expect(scan).toBeCloseTo(80.7 * 0.83 * 16, 2)
  })

  it('un robot suelto suscrito a los dos topics del muro cuesta 0,48 kB/s', () => {
    expect(caudalDeFlota(TOPICS_MURO, 1)).toBeCloseTo(0.48, 3)
  })

  it('cero robots cuesta cero, y una lista vacia tambien', () => {
    expect(caudalDeFlota(TOPICS_MURO, 0)).toBe(0)
    expect(caudalDeFlota([], 16)).toBe(0)
  })

  it('un topic repetido se suma dos veces: sobreestimar es el lado seguro', () => {
    expect(caudalDeFlota(['/odom', '/odom'], 1)).toBeCloseTo(2 * CAUDAL_KBS['/odom'], 5)
  })
})

describe('caudalDeFlota — lo que NO se puede presupuestar', () => {
  it('🔴 un topic sin caudal medido LANZA, nombrandolo, en vez de contar como 0', () => {
    // Devolver 0 seria un presupuesto que aprueba sin haber sumado: la misma
    // forma que «un codigo de salida 0 no prueba que hiciera algo».
    expect(() => caudalDeFlota(['/map'], 16)).toThrowError(/\/map/)
    expect(() => caudalDeFlota(['/map'], 16)).toThrowError(/medido/)
  })

  it('un topic invalido dentro de una lista por lo demas buena tambien lanza', () => {
    expect(() => caudalDeFlota([...TOPICS_MURO, '/tf'], 16)).toThrowError(/\/tf/)
  })

  it('un numero de robots negativo o no entero lanza', () => {
    expect(() => caudalDeFlota(TOPICS_MURO, -1)).toThrowError(/entero/)
    expect(() => caudalDeFlota(TOPICS_MURO, 2.5)).toThrowError(/entero/)
    expect(() => caudalDeFlota(TOPICS_MURO, Number.NaN)).toThrowError(/entero/)
  })
})

describe('CAUDAL_KBS — los numeros medidos', () => {
  it('/scan es el 83 % de los 80,7 kB/s de referencia, no un numero suelto', () => {
    expect(CAUDAL_KBS['/scan']).toBeCloseTo(66.981, 3)
  })

  it('los dos topics del muro son los dos mas baratos de los medidos', () => {
    const ordenados = Object.entries(CAUDAL_KBS).sort((a, b) => a[1] - b[1]).map(([t]) => t)
    expect(ordenados.slice(0, 2).sort()).toEqual([...TOPICS_MURO].sort())
  })
})
