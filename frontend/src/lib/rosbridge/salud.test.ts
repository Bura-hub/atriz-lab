import { describe, expect, it } from 'vitest'
import { PEOR_HUECO_ODOM_MEDIDO_MS, UMBRAL_SILENCIO_MS, evaluarSalud } from './salud'

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

  // La UNICA de las tres que se distingue, y es gratis -PERO SOLO si /scan
  // esta fresco. Ver el siguiente test: en produccion casi nunca lo esta.
  it('si /scan llega y /odom no, senala la excepcion en un manejador', () => {
    const s = evaluarSalud({ ...base, msDesdeUltimoOdom: null, msDesdeUltimoScan: 0 })
    expect(s.causasPosibles).toHaveLength(1)
    expect(s.causasPosibles[0]).toContain('manejador')
  })

  // Punto 5 del encargo: fija el comportamiento ACTUAL para que nadie lo
  // "arregle" sin entender por que es asi. `Teleoperacion.arrancarBarrido()`
  // se da de baja de /scan tras la primera muestra, asi que en produccion
  // `msDesdeUltimoScan` queda CONGELADO ahi y envejece para siempre -nunca
  // vuelve a estar "fresco" salvo que la interfaz mantenga su propia
  // suscripcion aparte (ver el comentario junto a esta rama en salud.ts). Con
  // un /scan viejo (no fresco), la funcion tiene que caer en las TRES causas
  // genericas, NO en la especifica de una sola -aunque /odom siga sin llegar.
  it('con /scan VIEJO (no fresco) -el estado real tras arrancarBarrido()- da las tres causas, no la especifica', () => {
    const s = evaluarSalud({
      ...base, msDesdeUltimoOdom: null, msDesdeUltimoScan: UMBRAL_SILENCIO_MS + 1,
    })
    expect(s.causasPosibles).toHaveLength(3)
    expect(s.esAveria).toBe(false)
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

describe('🔴 el umbral de silencio contra el PEOR regimen, no contra el comodo', () => {
  it('deja al menos 5x sobre el peor hueco MEDIDO, que es el del transitorio', () => {
    /*
     * 325,7 ms tras reiniciar el driver, contra 78-81 en regimen permanente.
     * Quien baje `UMBRAL_SILENCIO_MS` tiene que compararlo contra 326: con el
     * numero comodo parece haber 37x de margen y de verdad hay 9x.
     *
     * Es la misma forma que costo un fallo en el robot: `girar()` abortaba por
     * construccion en los primeros segundos porque su umbral (250 ms) estaba
     * POR DEBAJO de un hueco que ocurre de verdad.
     */
    expect(UMBRAL_SILENCIO_MS).toBeGreaterThan(PEOR_HUECO_ODOM_MEDIDO_MS * 5)
  })

  it('y el peor hueco medido es MAYOR que el de regimen permanente', () => {
    // Si alguien sustituye la constante por los 81 ms comodos, esto falla y
    // obliga a decir de que regimen habla.
    expect(PEOR_HUECO_ODOM_MEDIDO_MS).toBeGreaterThan(81)
  })
})
