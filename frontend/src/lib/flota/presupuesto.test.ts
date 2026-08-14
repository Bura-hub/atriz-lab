import { describe, expect, it } from 'vitest'
import {
  CAUDAL_KBS, MURO_SIN_CAUDAL_MEDIDO, TOPICS_MURO, caudalDeFlota, presupuestoMuro,
} from './presupuesto'

/** Los del muro que SÍ tienen caudal medido. Es lo que `presupuestoMuro` suma. */
const MEDIDOS = TOPICS_MURO.filter(
  (t) => !(MURO_SIN_CAUDAL_MEDIDO as readonly string[]).includes(t),
)

describe('caudalDeFlota — el presupuesto del muro', () => {
  it('los topics MEDIDOS del muro, en los 16, cuestan ~7,7 kB/s', () => {
    // 0,03 + 0,45 = 0,48 kB/s por robot -> 7,68 con los 16.
    expect(caudalDeFlota(MEDIDOS, 16)).toBeCloseTo(7.68, 2)
  })

  it('🔴 añadir /odom al muro dispara el presupuesto por encima de 200 kB/s', () => {
    // Es el numero que decide que el muro NO lleve odometria: (0,48 + 13,05) x 16.
    expect(caudalDeFlota([...MEDIDOS, '/odom'], 16)).toBeGreaterThan(200)
  })

  it('/scan solo, en los 16, es un orden de magnitud peor que todo el resto junto', () => {
    const scan = caudalDeFlota(['/scan'], 16)
    const resto = caudalDeFlota(['/odom', '/imu', '/encoders', '/motor_status', '/battery_state'], 16)
    expect(scan).toBeGreaterThan(resto)
    expect(scan).toBeCloseTo(80.7 * 0.83 * 16, 2)
  })

  it('un robot suelto suscrito a los medidos del muro cuesta 0,48 kB/s', () => {
    expect(caudalDeFlota(MEDIDOS, 1)).toBeCloseTo(0.48, 3)
  })

  it('cero robots cuesta cero, y una lista vacia tambien', () => {
    expect(caudalDeFlota(MEDIDOS, 0)).toBe(0)
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
    expect(() => caudalDeFlota([...MEDIDOS, '/tf'], 16)).toThrowError(/\/tf/)
  })

  it('🔴 y TOPICS_MURO entero lanza, porque uno de los tres no esta medido', () => {
    /*
     * No es un detalle: es la prueba de que `/estado_robot` sigue sin medir. El
     * dia que el robot de su caudal y entre en CAUDAL_KBS, esta prueba caera —y
     * caer es lo correcto: obliga a vaciar MURO_SIN_CAUDAL_MEDIDO y a quitar el
     * «≥» de la pantalla en el mismo cambio.
     */
    expect(() => caudalDeFlota(TOPICS_MURO, 16)).toThrowError(/estado_robot/)
  })

  it('un numero de robots negativo o no entero lanza', () => {
    expect(() => caudalDeFlota(MEDIDOS, -1)).toThrowError(/entero/)
    expect(() => caudalDeFlota(MEDIDOS, 2.5)).toThrowError(/entero/)
    expect(() => caudalDeFlota(MEDIDOS, Number.NaN)).toThrowError(/entero/)
  })
})

describe('🔴 presupuestoMuro — la cifra que el muro enseña es un MÍNIMO', () => {
  /*
   * ESTE BLOQUE NACE DE UN FALLO, y conviene decir cuál: `TOPICS_MURO`
   * declaraba DOS topics mientras `BaldosaConectada` se suscribía a TRES.
   * `/estado_robot` entró en la baldosa el 2026-08-04 y nunca entró en el
   * presupuesto, así que el muro llevaba desde entonces enseñando una cifra por
   * debajo de lo que gasta —y es la cifra que gobierna si el WiFi del aula
   * aguanta con dieciséis alumnos.
   */
  it('suma solo lo medido, y DICE lo que no ha podido sumar', () => {
    const p = presupuestoMuro(16)
    expect(p.kbs).toBeCloseTo(7.68, 2)
    expect(p.sinMedir).toEqual(['/estado_robot'])
    expect(p.completo).toBe(false)
  })

  it('🔴 no lanza aunque TOPICS_MURO tenga un topic sin medir', () => {
    // Si lanzara, la pantalla de flota entera se caeria. El diseño es
    // justamente NO sumar lo que no se sabe, sin dejar de pintar el muro.
    expect(() => presupuestoMuro(16)).not.toThrow()
  })

  it('escala con los robots, como el otro', () => {
    expect(presupuestoMuro(1).kbs).toBeCloseTo(0.48, 3)
    expect(presupuestoMuro(0).kbs).toBe(0)
  })

  it('🔴 `completo` solo puede ser true si NO falta ninguno', () => {
    // El dia que se mida /estado_robot, esto pasa a true y el «≥» desaparece
    // de la pantalla solo. Hoy tiene que ser false: fingir lo contrario seria
    // volver al error que este bloque documenta.
    const p = presupuestoMuro(16)
    expect(p.completo).toBe(p.sinMedir.length === 0)
    expect(MURO_SIN_CAUDAL_MEDIDO.length).toBeGreaterThan(0)
  })
})

describe('CAUDAL_KBS — los numeros medidos', () => {
  it('/scan es el 83 % de los 80,7 kB/s de referencia, no un numero suelto', () => {
    expect(CAUDAL_KBS['/scan']).toBeCloseTo(66.981, 3)
  })

  it('los medidos del muro son los dos mas baratos de todos los medidos', () => {
    const ordenados = Object.entries(CAUDAL_KBS).sort((a, b) => a[1] - b[1]).map(([t]) => t)
    expect(ordenados.slice(0, 2).sort()).toEqual([...MEDIDOS].sort())
  })

  it('🔴 /estado_robot NO esta aqui, y no es un olvido', () => {
    /*
     * La evidencia 68 midió SEIS topics y éste no es ninguno: no existía aún
     * (lo añadió el robot el 2026-08-04). El «~0,03 kB/s» que circula por el
     * código salió de `/battery_state`, que publica **cada 30 s** (0,07 Hz
     * medidos) mientras `/estado_robot` va a **1 Hz**. Es la trampa que este
     * proyecto ya tiene escrita: una cifra correcta en su contexto se vuelve
     * falsa al mudarla de sitio.
     */
    expect(CAUDAL_KBS['/estado_robot']).toBeUndefined()
  })
})
