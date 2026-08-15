import { describe, expect, it } from 'vitest'
import {
  ARRASTRE_MINIMO_PX, COVARIANZA_POSE_INICIAL, mensajePoseInicial, poseDelGesto,
} from './pose_inicial'

describe('🔴🔴 el sello va a CERO, y es lo que hace que AMCL no lo tire', () => {
  it('stamp 0 y frame map', () => {
    /*
     * Con `now()` el sello iba 69 ms por delante de lo último que tenía TF y
     * AMCL lo descartaba con «extrapolation into the future». Pasó en LAS 10
     * tandas de navegación de la historia del proyecto sin que nadie lo mirara:
     * el banco creía fijar la pose y no la fijaba nunca. En tf2, el sello 0
     * significa «usa la transformada más reciente». Evidencia 88.
     */
    const m = mensajePoseInicial({ x: 1, y: 2, yaw: 0 })
    expect(m.header.stamp).toEqual({ sec: 0, nanosec: 0 })
    expect(m.header.frame_id).toBe('map')
  })

  it('🔴 y NO hay ningún camino que meta la hora de ahora', () => {
    // El control del control: si alguien "arreglara" el sello poniéndole
    // Date.now(), este número sería enorme. Se comprueba el orden de magnitud
    // en vez de la igualdad, para que no se pueda colar un sello "casi cero".
    const m = mensajePoseInicial({ x: 0, y: 0, yaw: 1 })
    expect(m.header.stamp.sec).toBeLessThan(1)
    expect(m.header.stamp.nanosec).toBeLessThan(1)
  })
})

describe('el gesto: sin rumbo NO se manda nada', () => {
  it('🔴 un clic sin arrastrar se NIEGA, y dice por qué', () => {
    /*
     * Es la rama por descarte de este módulo. Suponer yaw 0 sería lo cómodo y
     * lo peor: AMCL con 180° de error no converge NUNCA, y desde fuera eso se
     * ve como «la navegación no funciona» — se busca en Nav2, donde no está.
     */
    const r = poseDelGesto({ x: 1, y: 1 }, { x: 1, y: 1 }, 0)
    expect(r.hay).toBe(false)
    if (r.hay) return
    expect(r.motivo).toMatch(/rumbo/i)
    expect(r.motivo).toMatch(/arrastra/i)
  })

  it('justo por debajo del mínimo tampoco, justo por encima sí', () => {
    // La frontera se comprueba a los dos lados: un umbral que solo se prueba
    // lejos no distingue «hay umbral» de «siempre pasa».
    expect(poseDelGesto({ x: 0, y: 0 }, { x: 1, y: 0 }, ARRASTRE_MINIMO_PX - 1).hay).toBe(false)
    expect(poseDelGesto({ x: 0, y: 0 }, { x: 1, y: 0 }, ARRASTRE_MINIMO_PX).hay).toBe(true)
  })

  it('un NaN en el gesto no produce una pose', () => {
    // `Math.atan2(NaN, NaN)` da NaN sin quejarse, y una pose con NaN viajaría
    // hasta AMCL. Es la lección de `limitar(nan)`, que devolvía el TOPE.
    expect(poseDelGesto({ x: NaN, y: 0 }, { x: 1, y: 0 }, 50).hay).toBe(false)
    expect(poseDelGesto({ x: 0, y: 0 }, { x: NaN, y: 0 }, 50).hay).toBe(false)
  })

  it('el rumbo sale del ARRASTRE, y la posición del punto donde se pulsó', () => {
    const r = poseDelGesto({ x: 2, y: 3 }, { x: 2, y: 4 }, 40)
    expect(r.hay).toBe(true)
    if (!r.hay) return
    expect(r.pose.x).toBe(2)          // la posición NO se mueve con el arrastre
    expect(r.pose.y).toBe(3)
    expect(r.pose.yaw).toBeCloseTo(Math.PI / 2, 6)   // arrastrar hacia +Y = 90°
  })

  it('las cuatro direcciones cardinales, con el signo de REP-103', () => {
    const yaw = (dx: number, dy: number) => {
      const r = poseDelGesto({ x: 0, y: 0 }, { x: dx, y: dy }, 50)
      return r.hay ? r.pose.yaw : NaN
    }
    expect(yaw(1, 0)).toBeCloseTo(0, 6)               // +X
    expect(yaw(0, 1)).toBeCloseTo(Math.PI / 2, 6)     // +Y, antihorario
    expect(yaw(-1, 0)).toBeCloseTo(Math.PI, 6)
    expect(yaw(0, -1)).toBeCloseTo(-Math.PI / 2, 6)
  })
})

describe('la covarianza', () => {
  it('son 36 números y solo tres no son cero', () => {
    expect(COVARIANZA_POSE_INICIAL).toHaveLength(36)
    const noCero = COVARIANZA_POSE_INICIAL
      .map((v, i) => [i, v] as const).filter(([, v]) => v !== 0)
    expect(noCero.map(([i]) => i)).toEqual([0, 7, 35])
  })

  it('🔴 y NO son ceros: con covarianza cero AMCL se lo cree a ciegas', () => {
    // Le dice a AMCL cuánto fiarse. A cero no repartiría partículas y no podría
    // corregirse de un error del operador, que es justo para lo que sirve.
    for (const i of [0, 7, 35]) expect(COVARIANZA_POSE_INICIAL[i]).toBeGreaterThan(0)
  })

  it('el mensaje lleva una COPIA, no la constante compartida', () => {
    // Si viajara la constante, un cliente que la mutara envenenaría los envíos
    // siguientes. Es barato de evitar y caro de encontrar.
    const a = mensajePoseInicial({ x: 0, y: 0, yaw: 0 })
    a.pose.covariance[0] = 999
    expect(COVARIANZA_POSE_INICIAL[0]).toBe(0.25)
  })
})
