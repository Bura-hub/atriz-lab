import { describe, expect, it } from 'vitest'
import {
  CAUDAL_KBS, MURO_SIN_CAUDAL_MEDIDO, TOPICS_MURO, caudalDeFlota, presupuestoMuro,
} from './presupuesto'

describe('caudalDeFlota — el presupuesto del muro', () => {
  it('el muro entero, en los 16, cuesta ~13,3 kB/s', () => {
    /*
     * 0,03 + 0,45 + 0,35 = 0,83 kB/s por robot -> 13,28 con los 16.
     *
     * ⚠️ Esta prueba decia «~7,7 kB/s» y NO estaba mal: sumaba los dos topics
     * que tenian caudal medido, y el tercero llevaba desde el 2026-08-04
     * recibiendose sin presupuestar. El robot midio `/estado_robot` el
     * 2026-08-14 (0,35 kB/s, evidencia 110) y el numero real aparecio.
     */
    expect(caudalDeFlota(TOPICS_MURO, 16)).toBeCloseTo(13.28, 2)
  })

  it('🔴 añadir /odom al muro dispara el presupuesto por encima de 200 kB/s', () => {
    // Es el numero que decide que el muro NO lleve odometria.
    expect(caudalDeFlota([...TOPICS_MURO, '/odom'], 16)).toBeGreaterThan(200)
  })

  it('/scan solo, en los 16, es un orden de magnitud peor que todo el resto junto', () => {
    const scan = caudalDeFlota(['/scan'], 16)
    const resto = caudalDeFlota(['/odom', '/imu', '/encoders', '/motor_status', '/battery_state'], 16)
    expect(scan).toBeGreaterThan(resto)
    expect(scan).toBeCloseTo(80.7 * 0.83 * 16, 2)
  })

  it('un robot suelto suscrito al muro cuesta 0,83 kB/s', () => {
    expect(caudalDeFlota(TOPICS_MURO, 1)).toBeCloseTo(0.83, 3)
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

  it('✅ y TOPICS_MURO entero YA NO lanza: los tres estan medidos', () => {
    /*
     * 🔴 ESTA PRUEBA ESTABA AL REVES HASTA HOY, y lo dijo ella misma: «el dia
     *    que el robot de su caudal, esta prueba caera —y caer es lo correcto:
     *    obliga a vaciar MURO_SIN_CAUDAL_MEDIDO y a quitar el «≥» de la pantalla
     *    en el mismo cambio». Ese dia fue el 2026-08-14, unas horas despues.
     *
     * Se conserva invertida en vez de borrarse: sigue siendo la prueba de que
     * el muro no se suscribe a nada sin presupuestar.
     */
    expect(() => caudalDeFlota(TOPICS_MURO, 16)).not.toThrow()
  })

  it('un numero de robots negativo o no entero lanza', () => {
    expect(() => caudalDeFlota(TOPICS_MURO, -1)).toThrowError(/entero/)
    expect(() => caudalDeFlota(TOPICS_MURO, 2.5)).toThrowError(/entero/)
    expect(() => caudalDeFlota(TOPICS_MURO, Number.NaN)).toThrowError(/entero/)
  })
})

describe('presupuestoMuro — la cifra que el muro enseña', () => {
  /*
   * ESTE BLOQUE NACIO DE UN FALLO, y conviene que se recuerde cuál: `TOPICS_MURO`
   * declaraba DOS topics mientras `BaldosaConectada` se suscribía a TRES.
   * `/estado_robot` entró en la baldosa el 2026-08-04 y nunca entró en el
   * presupuesto, así que el muro llevaba diez días enseñando una cifra por
   * debajo de lo que gasta —y es la cifra que gobierna si el WiFi del aula
   * aguanta con dieciséis alumnos—. Hoy ya suma los tres.
   */
  it('✅ ya está completo, y por eso la pantalla no pinta ningún «≥»', () => {
    const p = presupuestoMuro(16)
    expect(p.kbs).toBeCloseTo(13.28, 2)
    expect(p.sinMedir).toEqual([])
    expect(p.completo).toBe(true)
  })

  it('🔴 y coincide EXACTAMENTE con sumar TOPICS_MURO entero', () => {
    /*
     * La prueba que impide que vuelva el hueco: si alguien añade un topic al
     * muro y se olvida de su caudal, `caudalDeFlota` lanza aquí; y si lo mete en
     * `MURO_SIN_CAUDAL_MEDIDO` para callarlo, las dos cifras dejan de coincidir.
     * No hay forma de suscribirse sin presupuestar que pase por aquí en verde.
     */
    expect(presupuestoMuro(16).kbs).toBeCloseTo(caudalDeFlota(TOPICS_MURO, 16), 5)
  })

  it('no lanza, pinte lo que pinte: la pantalla de flota no se puede caer', () => {
    expect(() => presupuestoMuro(16)).not.toThrow()
  })

  it('escala con los robots, como el otro', () => {
    expect(presupuestoMuro(1).kbs).toBeCloseTo(0.83, 3)
    expect(presupuestoMuro(0).kbs).toBe(0)
  })

  it('`completo` es exactamente «no falta ninguno», no una constante', () => {
    const p = presupuestoMuro(16)
    expect(p.completo).toBe(p.sinMedir.length === 0)
    expect(MURO_SIN_CAUDAL_MEDIDO).toEqual([])
  })
})

describe('CAUDAL_KBS — los numeros medidos', () => {
  it('/scan es el 83 % de los 80,7 kB/s de referencia, no un numero suelto', () => {
    expect(CAUDAL_KBS['/scan']).toBeCloseTo(66.981, 3)
  })

  it('los tres del muro son los tres mas baratos de todos los medidos', () => {
    const ordenados = Object.entries(CAUDAL_KBS).sort((a, b) => a[1] - b[1]).map(([t]) => t)
    expect(ordenados.slice(0, 3).sort()).toEqual([...TOPICS_MURO].sort())
  })

  it('✅ /estado_robot vale 0,35 — MEDIDO, y doce veces el 0,03 que se copiaba', () => {
    /*
     * 348 bytes/mensaje exactos en las dos corridas, a ~1 Hz (evidencia 110).
     * El «~0,03» que circulaba por este código y por el README del robot era el
     * de `/battery_state`, que publica **cada 30 s** (0,07 Hz medidos): la
     * trampa de «una cifra correcta en su contexto se vuelve falsa al mudarla».
     *
     * 🔴 La comparación se deja escrita porque es lo que da la magnitud del
     *    error: 0,35 / 0,03 ≈ 12. Un presupuesto corto por doce veces no es un
     *    matiz.
     */
    expect(CAUDAL_KBS['/estado_robot']).toBe(0.35)
    expect(CAUDAL_KBS['/estado_robot'] / CAUDAL_KBS['/battery_state']).toBeGreaterThan(10)
  })
})
