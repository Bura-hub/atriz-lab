import { describe, expect, it } from 'vitest'
import { MensajeScan } from '../../hooks/useTopic'
import { LASER_X, contarValidos, distanciaMinima, escala, puntosDelBarrido } from './barrido'

/** Un barrido con los parametros reales del X2 medidos en este robot. */
const barrido = (ranges: number[]): MensajeScan => ({
  header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'laser' },
  angle_min: -Math.PI,
  angle_max: Math.PI,
  // 1,42° de resolucion angular, medido el 2026-07-30.
  angle_increment: (1.42 * Math.PI) / 180,
  time_increment: 0,
  scan_time: 0.1,
  range_min: 0.1,
  range_max: 8.0,
  ranges,
  intensities: [],
})

describe('puntosDelBarrido — los huecos NO son ceros', () => {
  it('🔴 descarta Infinity y NaN en vez de dibujarlos pegados al robot', () => {
    // Medido: de 255 puntos, 226 validos. Un hueco pintado como 0 seria un
    // obstaculo inexistente A CERO METROS, sobre una pantalla de seguridad.
    const p = puntosDelBarrido(barrido([1.0, Infinity, NaN, 2.0]))
    expect(p).toHaveLength(2)
  })

  it('descarta lo que el propio sensor declara fuera de rango', () => {
    // 0.05 < range_min (0.1) y 9.0 > range_max (8.0)
    expect(puntosDelBarrido(barrido([0.05, 1.0, 9.0]))).toHaveLength(1)
  })

  it('un barrido entero de huecos da cero puntos, no un punto en el origen', () => {
    expect(puntosDelBarrido(barrido([Infinity, NaN, Infinity]))).toEqual([])
  })
})

describe('puntosDelBarrido — la geometria', () => {
  it('🔴 aplica el desplazamiento del LIDAR: no esta en el centro del robot', () => {
    // laser_x = -0.005 m, MEDIDO con cinta. El modelo decia 0 «centrado» sin
    // cinta detras, y eso costo una discrepancia de ~2 cm.
    const [p] = puntosDelBarrido(barrido([1.0]))   // primer rayo: angle_min = -pi
    expect(p.x).toBeCloseTo(LASER_X - 1.0, 6)
    expect(LASER_X).not.toBe(0)
  })

  it('un rayo hacia delante cae en +x, y uno a la izquierda en +y (REP-103)', () => {
    const s = barrido([1.0])
    s.angle_min = 0                       // adelante
    expect(puntosDelBarrido(s)[0].x).toBeCloseTo(LASER_X + 1.0, 6)

    s.angle_min = Math.PI / 2             // 90° a la izquierda
    const izq = puntosDelBarrido(s)[0]
    expect(izq.y).toBeCloseTo(1.0, 6)
    expect(izq.x).toBeCloseTo(LASER_X, 6)
  })

  it('🔴 funciona con CUALQUIER tamaño: el del X2 cambia entre sesiones', () => {
    // Medido desde el robot el 2026-08-04, encendiendo y apagando el barrido
    // cuatro veces con la misma configuracion: 250 · 250 · 270 · 250. Y el
    // journal del mismo dia registro ademas 253, 254 y 255.
    //
    // Dentro de UNA sesion el tamaño es constante —por eso una medida de 35
    // barridos seguidos vio «260, y solo 260»— pero la conclusion de que 260
    // fuera EL valor era falsa. `fixed_resolution: true` lo fija con el primer
    // barrido de cada sesion, y ese depende de a que velocidad gire el motor,
    // que va libre.
    //
    // Un cliente que asuma un tamaño se rompe UNA DE CADA TRES sesiones, que es
    // la peor frecuencia posible para depurar. Esta prueba existe para que
    // nadie vuelva a fijarlo.
    for (const n of [250, 253, 254, 255, 260, 270]) {
      expect(contarValidos(barrido(new Array(n).fill(1.0))).total, `${n} puntos`).toBe(n)
      expect(puntosDelBarrido(barrido(new Array(n).fill(1.0)))).toHaveLength(n)
    }
  })

  it('🔴 y el ANGULO sale de angle_increment del mensaje, no de una constante', () => {
    // La resolucion angular cambia con el tamaño: 360/250 = 1,44° y
    // 360/270 = 1,33°. Si alguien la fijara, los puntos saldrian girados en
    // cuanto la sesion arrancara con otro tamaño.
    const s = barrido([1.0, 1.0])
    s.angle_min = 0
    s.angle_increment = Math.PI / 2          // 90° a mano
    const [p0, p1] = puntosDelBarrido(s)
    expect(p1.y - p0.y).toBeCloseTo(1.0, 6)  // el segundo cayo 90° a la izquierda
  })
})

describe('distanciaMinima', () => {
  it('ignora los huecos al buscar el minimo', () => {
    expect(distanciaMinima(barrido([Infinity, 2.0, NaN, 0.5, 3.0]))).toBeCloseTo(0.5, 6)
  })

  it('🔴 sin ningun punto valido devuelve null, NUNCA 0', () => {
    // Un 0 aqui se leeria como «hay algo pegado al robot», que es la direccion
    // insegura del error.
    expect(distanciaMinima(barrido([Infinity, NaN]))).toBeNull()
  })
})

describe('escala', () => {
  it('mete el radio pedido en la mitad del lienzo', () => {
    expect(escala(400, 2)).toBe(100)          // 2 m -> 200 px -> centro en 200
  })
})
