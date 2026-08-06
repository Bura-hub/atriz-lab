import { describe, expect, it } from 'vitest'
import {
  InfoMapa, cuaternionDeYaw, estadoDeCelda, fronteraAbierta, mundoAPixel, pixelAMundo, pixelesDeMapa,
  recuentoDeCeldas,
} from './mapa'

const info = (an: number, al: number, res = 0.05, ox = -1, oy = -2): InfoMapa => ({
  resolution: res, width: an, height: al, origin: { position: { x: ox, y: oy } },
})

const COLORES = {
  LIBRE: [255, 255, 255] as [number, number, number],
  OCUPADA: [0, 0, 0] as [number, number, number],
  DESCONOCIDA: [128, 128, 128] as [number, number, number],
}

describe('estadoDeCelda', () => {
  it('🔴 -1 es DESCONOCIDA, no libre', () => {
    // Es la mayoria de un mapa recien hecho: un robot quieto produce 92,9 %
    // desconocido y esta sano. Pintarlo como libre afirmaria que se ha explorado
    // una zona donde no ha entrado nadie, y sobre eso se planifican rutas.
    expect(estadoDeCelda(-1)).toBe('DESCONOCIDA')
  })

  it('el umbral de ocupada es 65, y se barre entero', () => {
    for (let v = 0; v <= 100; v += 1) {
      expect(estadoDeCelda(v)).toBe(v >= 65 ? 'OCUPADA' : 'LIBRE')
    }
  })

  it('un valor roto es DESCONOCIDA, nunca libre', () => {
    for (const malo of [NaN, Infinity, -Infinity]) expect(estadoDeCelda(malo)).toBe('DESCONOCIDA')
  })
})

describe('pixelesDeMapa', () => {
  it('🔴🔴 VOLTEA en vertical: la fila 0 del mensaje es la de mas al SUR', () => {
    /*
     * Sin el volteo el mapa sale espejado, y un mapa espejado NO se lee como un
     * error: se lee como otra habitacion. Rejilla 1x2: abajo ocupada, arriba
     * libre. En el canvas la ocupada tiene que salir en la fila de ABAJO.
     */
    const px = pixelesDeMapa(info(1, 2), [100, 0], COLORES)!
    // fila 0 del canvas = arriba = la fila 1 del mensaje = libre = blanco
    expect([px[0], px[1], px[2]]).toEqual([255, 255, 255])
    // fila 1 del canvas = abajo = la fila 0 del mensaje = ocupada = negro
    expect([px[4], px[5], px[6]]).toEqual([0, 0, 0])
  })

  it('🔴 devuelve null si el mensaje no cuadra consigo mismo', () => {
    // width*height != data.length produce un dibujo PLAUSIBLE y equivocado si se
    // pinta igual. Mejor no pintar nada.
    expect(pixelesDeMapa(info(2, 2), [0, 0, 0], COLORES)).toBeNull()
    expect(pixelesDeMapa(info(0, 5), [], COLORES)).toBeNull()
  })

  it('todo opaco: un alfa a medias haria que el fondo se leyera como dato', () => {
    const px = pixelesDeMapa(info(2, 2), [-1, 0, 100, 50], COLORES)!
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255)
  })
})

describe('mundoAPixel / pixelAMundo', () => {
  it('el origen del mensaje cae en la esquina INFERIOR izquierda', () => {
    const i = info(100, 80, 0.05, -1, -2)
    const { px, py } = mundoAPixel(i, -1, -2)
    expect(px).toBeCloseTo(0, 6)
    expect(py).toBeCloseTo(80, 6)   // abajo del todo en el canvas
  })

  it('🔴 una ida y vuelta tiene que devolver el mismo punto', () => {
    // Si las dos no son inversas exactas, un clic manda al robot a un sitio
    // distinto del que se toco — y eso no se ve hasta que el robot se mueve.
    const i = info(200, 120, 0.05, -3.25, 1.5)
    for (const [x, y] of [[0, 0], [-3.25, 1.5], [2.4, -0.8], [6.75, 7.5]]) {
      const p = mundoAPixel(i, x, y)
      const v = pixelAMundo(i, p.px, p.py)
      expect(v.x).toBeCloseTo(x, 9)
      expect(v.y).toBeCloseTo(y, 9)
    }
  })
})

describe('cuaternionDeYaw', () => {
  it('0 rad es la identidad', () => {
    expect(cuaternionDeYaw(0)).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('90° da z=w=sin(45°)', () => {
    const q = cuaternionDeYaw(Math.PI / 2)
    expect(q.z).toBeCloseTo(Math.SQRT1_2, 9)
    expect(q.w).toBeCloseTo(Math.SQRT1_2, 9)
  })

  it('siempre es unitario', () => {
    for (const a of [-3, -1.2, 0, 0.4, 2.9, 3.14]) {
      const q = cuaternionDeYaw(a)
      expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 9)
    }
  })
})

describe('recuentoDeCeldas', () => {
  it('cuenta las tres clases', () => {
    expect(recuentoDeCeldas([-1, -1, 0, 10, 90, 100])).toEqual({
      DESCONOCIDA: 2, LIBRE: 2, OCUPADA: 2,
    })
  })
})

describe('fronteraAbierta', () => {
  /**
   * Rejillas 5x5 escritas a mano. `#` pared, `.` libre, `?` desconocido.
   * La fila 0 del array es la de mas al SUR, pero para contar da igual.
   */
  const rejilla = (dibujo: string[]) => dibujo.join('').split('')
    .map((c) => (c === '#' ? 100 : c === '.' ? 0 : -1))

  it('🔴 una habitacion CERRADA no tiene frontera abierta, aunque sobre gris fuera', () => {
    /*
     * Es el caso medido en un cuarto real: 2857 celdas desconocidas y UNA
     * alcanzable. El mapa estaba terminado y el «% sin explorar» decia 44,8 %.
     */
    const d = rejilla([
      '?????',
      '?###?',
      '?#.#?',
      '?###?',
      '?????',
    ])
    expect(fronteraAbierta(info(5, 5), d)).toBe(0)
  })

  it('un hueco en la pared SI cuenta como frontera', () => {
    const d = rejilla([
      '?????',
      '?###?',
      '?#..?',   // la pared derecha se abre: el gris de fuera es alcanzable
      '?###?',
      '?????',
    ])
    expect(fronteraAbierta(info(5, 5), d)).toBeGreaterThan(0)
  })

  it('🔴 no se cruza en DIAGONAL por la esquina de dos paredes', () => {
    /*
     * Con 8-vecindad, el relleno se colaria entre las dos `#` que se tocan solo
     * por el vertice y contaria TODO el exterior — justo en las habitaciones
     * bien cerradas, que es donde este numero tiene que valer 0.
     */
    const d = rejilla([
      '?????',
      '?##??',
      '?#.#?',
      '??##?',
      '?????',
    ])
    /*
     * La unica celda libre es (2,2). En 4-vecindad esta CERRADA: arriba, abajo,
     * izquierda y derecha son pared -> 0.
     * En 8-vecindad tocaria (3,1), que es `?`, y el relleno se escaparia al
     * exterior entero. Asi que este `toBe(0)` distingue las dos implementaciones
     * en vez de limitarse a comprobar que devuelve algo.
     */
    expect(fronteraAbierta(info(5, 5), d)).toBe(0)
  })

  it('devuelve null si no cuadra o si no hay ninguna celda libre', () => {
    expect(fronteraAbierta(info(2, 2), [0, 0, 0])).toBeNull()
    expect(fronteraAbierta(info(2, 2), [-1, -1, 100, -1])).toBeNull()
  })
})
