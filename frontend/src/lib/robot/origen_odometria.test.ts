import { describe, expect, it } from 'vitest'
import {
  TOLERANCIA_POSICION_M, TOLERANCIA_YAW_GRADOS, distanciaAlOrigen, enElOrigen,
} from './origen_odometria'

const pose = (x: number, y: number, yawGrados: number) => ({ x, y, yawGrados })

describe('enElOrigen', () => {
  it('el cero exacto lo es', () => {
    expect(enElOrigen(pose(0, 0, 0))).toBe(true)
  })

  it('acepta justo en la tolerancia y rechaza justo fuera', () => {
    // Barrer los BORDES, no tres puntos «representativos»: en este repositorio
    // un test que probaba extremos y centro dejo sin cubrir la banda intermedia
    // donde vivia el bug del seguidor de linea.
    expect(enElOrigen(pose(TOLERANCIA_POSICION_M, 0, 0))).toBe(true)
    expect(enElOrigen(pose(TOLERANCIA_POSICION_M * 1.01, 0, 0))).toBe(false)
    expect(enElOrigen(pose(0, -TOLERANCIA_POSICION_M, 0))).toBe(true)
    expect(enElOrigen(pose(0, -TOLERANCIA_POSICION_M * 1.01, 0))).toBe(false)
    expect(enElOrigen(pose(0, 0, TOLERANCIA_YAW_GRADOS))).toBe(true)
    expect(enElOrigen(pose(0, 0, TOLERANCIA_YAW_GRADOS * 1.01))).toBe(false)
  })

  it('una pose real de antes del reinicio NO esta en el origen', () => {
    // Medida de hoy tras conducir 30 cm desde el navegador.
    expect(enElOrigen(pose(0.309, -0.046, -8.5))).toBe(false)
  })

  it('🔴 el rumbo cuenta aunque la posicion sea cero', () => {
    /*
     * Es el caso que importa de verdad: el robot no se ha movido de sitio pero
     * arrastra el rumbo del encendido. Si solo se mirara la posicion, la
     * pantalla diria «reiniciado» sobre una odometria que conserva su origen de
     * yaw — y el origen del yaw es justo lo que este servicio existe para poner
     * a cero, porque `reset_yaw()` del SDK no hace nada.
     */
    expect(enElOrigen(pose(0, 0, 30))).toBe(false)
  })

  it('🔴 un valor no finito es `false`, nunca «reiniciado»', () => {
    // Un NaN comparado con un umbral da false en las dos direcciones. Sin la
    // comprobacion explicita, un dato roto se leeria como un diagnostico.
    for (const malo of [NaN, Infinity, -Infinity]) {
      expect(enElOrigen(pose(malo, 0, 0))).toBe(false)
      expect(enElOrigen(pose(0, malo, 0))).toBe(false)
      expect(enElOrigen(pose(0, 0, malo))).toBe(false)
    }
  })
})

describe('distanciaAlOrigen', () => {
  it('es la hipotenusa', () => {
    expect(distanciaAlOrigen(pose(0.3, 0.4, 0))).toBeCloseTo(0.5, 6)
  })

  it('con un dato roto devuelve NaN, no un cero que parezca una medida', () => {
    expect(Number.isNaN(distanciaAlOrigen(pose(NaN, 0, 0)))).toBe(true)
  })
})
