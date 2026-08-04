import { describe, expect, it } from 'vitest'
import { evaluarSalud, UMBRAL_SILENCIO_MS } from './salud'

const base = { conectado: true, msDesdeUltimoOdom: 0, msDesdeUltimoScan: 0, frenando: false }

describe('estado del robot', () => {
  it('sin WebSocket es SIN_CONEXION', () => {
    expect(evaluarSalud({ ...base, conectado: false }).estado).toBe('SIN_CONEXION')
  })

  it('con /odom fresco es EN_LINEA', () => {
    expect(evaluarSalud(base).estado).toBe('EN_LINEA')
  })

  // Se barre la BANDA ENTERA, no solo los extremos: un test de tres puntos
  // «representativos» ya dejo pasar un bug en el seguidor de linea.
  it('la frontera esta exactamente en el umbral', () => {
    expect(evaluarSalud({ ...base, msDesdeUltimoOdom: UMBRAL_SILENCIO_MS - 1 }).estado).toBe('EN_LINEA')
    expect(evaluarSalud({ ...base, msDesdeUltimoOdom: UMBRAL_SILENCIO_MS }).estado).toBe('EN_LINEA')
    expect(evaluarSalud({ ...base, msDesdeUltimoOdom: UMBRAL_SILENCIO_MS + 1 }).estado).toBe('SIN_DATOS')
  })

  it('si /odom nunca llego, es SIN_DATOS', () => {
    expect(evaluarSalud({ ...base, msDesdeUltimoOdom: null }).estado).toBe('SIN_DATOS')
  })

  // 🔴 Lo mas importante del modulo: SIN_DATOS NO es averia, y el cliente
  // NO puede saber cual de las tres causas es.
  it('sin /odom ni /scan ofrece las tres causas y no elige', () => {
    const s = evaluarSalud({ ...base, msDesdeUltimoOdom: null, msDesdeUltimoScan: null })
    expect(s.estado).toBe('SIN_DATOS')
    expect(s.causasPosibles).toHaveLength(3)
    expect(s.esAveria).toBe(false)
  })

  // La UNICA de las tres que se distingue, y es gratis.
  it('si /scan llega y /odom no, senala la excepcion en un manejador', () => {
    const s = evaluarSalud({ ...base, msDesdeUltimoOdom: null, msDesdeUltimoScan: 0 })
    expect(s.causasPosibles).toHaveLength(1)
    expect(s.causasPosibles[0]).toContain('manejador')
  })

  it('frenando es informativo y no cambia el estado', () => {
    const s = evaluarSalud({ ...base, frenando: true })
    expect(s.estado).toBe('EN_LINEA')
    expect(s.frenando).toBe(true)
  })

  // 🔴 M1: Date.now() no es monotono. Un salto de NTP hacia atras hace que
  // msDesdeUltimo() de negativo, y sin el arreglo "-50 <= UMBRAL" es verdad:
  // EN_LINEA sobre un robot mudo, la direccion insegura.
  it('msDesdeUltimoOdom NEGATIVO (reloj no monotono) no es EN_LINEA', () => {
    const s = evaluarSalud({ ...base, msDesdeUltimoOdom: -1, msDesdeUltimoScan: null })
    expect(s.estado).toBe('SIN_DATOS')
  })
})
