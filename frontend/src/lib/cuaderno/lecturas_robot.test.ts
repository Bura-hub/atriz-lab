import { describe, expect, it } from 'vitest'
import { MAGNITUDES, desplazamientoCm, paraElCampo } from './lecturas_robot'

describe('desplazamientoCm', () => {
  /*
   * 🔴 EL CASO QUE JUSTIFICA `hypot` Y NO `x`. El marco del locator del RVR está
   *    **90° girado** respecto al «adelante» del robot: está medido, y por eso
   *    avanzar recto da siempre −90° en ese marco. Leer una sola componente
   *    daría casi cero mientras el robot cruza la habitación — que es
   *    exactamente el bug que el driver tuvo copiando `Velocity.X` a `linear.x`.
   */
  it('🔴 usa las dos componentes, no solo x', () => {
    expect(desplazamientoCm({ x: 0, y: 0.3, yaw: 0 })).toBeCloseTo(30, 6)
    expect(desplazamientoCm({ x: 0.3, y: 0, yaw: 0 })).toBeCloseTo(30, 6)
    expect(desplazamientoCm({ x: 0.3, y: 0.4, yaw: 0 })).toBeCloseTo(50, 6)
  })

  /*
   * 🔴 ES UNA DISTANCIA, NO UNA COORDENADA. Un retroceso de 30 cm da 30, no −30
   *    — y eso hay que saberlo al comparar con una cinta, que tampoco da signos.
   */
  it('🔴 nunca es negativo', () => {
    expect(desplazamientoCm({ x: -0.3, y: 0, yaw: 0 })).toBeCloseTo(30, 6)
    expect(desplazamientoCm({ x: -0.3, y: -0.4, yaw: 0 })).toBeCloseTo(50, 6)
  })

  it('un NaN no se convierte en cero', () => {
    // Cero en el campo que se compara con una cinta es una medida inventada.
    expect(desplazamientoCm({ x: NaN, y: 0, yaw: 0 })).toBeNull()
    expect(desplazamientoCm({ x: 0, y: Infinity, yaw: 0 })).toBeNull()
  })

  it('en el origen da cero, que sí es una lectura', () => {
    // Distinto del caso anterior: aquí el robot SÍ está en el origen.
    expect(desplazamientoCm({ x: 0, y: 0, yaw: 0 })).toBe(0)
  })
})

describe('paraElCampo', () => {
  it('🔴 coma decimal, como el resto de la pantalla', () => {
    // El cuaderno ya tuvo el defecto de escribir `30,2` en el campo y `30.2` en
    // la tabla. Que el número venga del robot no lo exime de la regla.
    expect(paraElCampo(30.2)).toBe('30,20')
    expect(paraElCampo(7.79)).toBe('7,79')
  })

  it('null y NaN dan null, no «0,00»', () => {
    expect(paraElCampo(null)).toBeNull()
    expect(paraElCampo(NaN)).toBeNull()
    expect(paraElCampo(Infinity)).toBeNull()
  })

  it('el cero real sí se escribe', () => {
    expect(paraElCampo(0)).toBe('0,00')
  })
})

describe('MAGNITUDES', () => {
  /*
   * 🔴 CADA UNA DICE CONTRA QUÉ SE COMPARA, y esa frase es lo que la hace útil:
   *    sin ella, «rumbo 1,0°» es un número que el alumno anota sin saber que su
   *    origen es «donde miraba el robot al arrancar el driver» y no el norte.
   */
  it('las tres traen qué, unidad y contra qué', () => {
    const claves = Object.keys(MAGNITUDES)
    expect(claves).toEqual(['DESPLAZAMIENTO', 'RUMBO', 'VOLTAJE'])
    for (const [nombre, d] of Object.entries(MAGNITUDES)) {
      expect(d.que.length, `${nombre} sin qué`).toBeGreaterThan(3)
      expect(d.unidad.length, `${nombre} sin unidad`).toBeGreaterThan(0)
      expect(d.contra.length, `${nombre} sin contra qué`).toBeGreaterThan(30)
    }
  })

  /*
   * ⚠️ NO hay una cuarta con `/scan`. Sería la natural —distancia frontal— y
   *    cuesta 66,98 kB/s, el 83 % del tráfico del robot: leer un número una vez
   *    costaría más que toda la pestaña de telemetría. Se comprueba para que
   *    nadie la añada sin volver a mirar ese número.
   */
  it('🔴 ninguna sale de /scan', () => {
    const texto = JSON.stringify(MAGNITUDES).toLowerCase()
    expect(texto).not.toMatch(/scan|lidar|distancia frontal/)
  })
})
