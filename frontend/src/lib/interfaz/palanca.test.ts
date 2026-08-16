import { describe, expect, it } from 'vitest'
import {
  Ajustes, Curva, V_MAX_DURO, V_MAX_SEGURO, V_MIN, W_MAX, W_MIN, W_POR_DEFECTO, ZONA_MUERTA,
  dentroDeLoMedido, ordenDePalanca, ordenDeTeclado, techoLineal, vMaxPermitida,
} from './palanca'

const R = 100
const CURVAS: Curva[] = ['directa', 'suave']
/** Los ajustes de siempre: techo seguro, giro por defecto, curva directa. */
const A: Ajustes = { vMax: V_MAX_SEGURO, wMax: W_POR_DEFECTO, curva: 'directa' }
const con = (p: Partial<Ajustes>): Ajustes => ({ ...A, ...p })

describe('ordenDePalanca', () => {
  it('en el centro no pide nada', () => {
    expect(ordenDePalanca(0, 0, R, A)).toEqual({ v: 0, w: 0 })
  })

  /*
   * 🔴 LA ZONA MUERTA. Sin ella, soltar el dedo a un pixel del centro deja una
   *    orden minima puesta y el bucle de 10 Hz la republica hasta que alguien
   *    suelte. Con un raton se nota; con un dedo en una tableta, no.
   */
  it('🔴 dentro de la zona muerta, cero — con las dos curvas', () => {
    for (const curva of CURVAS) {
      for (const f of [0, 0.05, 0.1, ZONA_MUERTA - 0.001, ZONA_MUERTA]) {
        const o = ordenDePalanca(0, -f * R, R, con({ curva }))
        expect(o, `${curva}: a ${f} del radio deberia ser cero`).toEqual({ v: 0, w: 0 })
      }
    }
  })

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 LA REGLA QUE JUSTIFICA TODO ESTE FICHERO
   * ═════════════════════════════════════════════════════════════════════════
   * De este robot solo hay medida una franja: lineal 0,20 y 0,40 al 100 %, y
   * angular entre 0,5 y 2,0 rad/s al 99-102 %. **Por debajo no hay dato.** Una
   * palanca continua puede pedir 0,02 m/s, que con orugas probablemente ni
   * arranque — y el alumno concluye «no obedece» sobre un robot sano.
   *
   * Se barre el recorrido ENTERO, no tres puntos: es la regla que este proyecto
   * tiene escrita con sangre, y ya se incumplió dos veces.
   *
   * 🆕 Y ahora barre el ESPACIO, no una línea: los dos techos lineales, tres
   *    techos angulares y las dos curvas. Antes se barría con `V_MAX` fijo, así
   *    que abrir el techo o meter una curva podía sacar la orden de la franja
   *    medida sin que nada se pusiera rojo.
   */
  /*
   * ⚠️ SE ACUMULAN LOS FALLOS Y SE AFIRMA UNA VEZ, y no es estilo: con un
   *    `expect()` por punto —cinco por punto, más de 75 000— la prueba tardaba
   *    lo bastante como para **agotar el plazo de vitest en la tanda completa**
   *    mientras pasaba al ejecutarla sola. Una prueba que depende de lo cargada
   *    que esté la máquina no es una prueba: es un falso positivo esperando, que
   *    es justo lo que este proyecto persigue en su verificador.
   *    Un `expect` en un bucle además solo cuenta el PRIMER fallo; así se ve
   *    cuántos hay y dónde empiezan.
   */
  it('🔴 ninguna orden se sale de lo medido, en TODO el espacio de ajustes', () => {
    const fallos: string[] = []
    let n = 0
    for (const curva of CURVAS) {
      for (const vMax of [V_MIN, 0.15, V_MAX_SEGURO, 0.3, V_MAX_DURO]) {
        for (const wMax of [W_MIN, W_POR_DEFECTO, W_MAX]) {
          const aj = { vMax, wMax, curva }
          for (let f = 0; f <= 1.0001; f += 0.02) {
            for (const ang of [0, 30, 45, 60, 90, 135, 180, 225, 270, 315]) {
              const rad = (ang * Math.PI) / 180
              const o = ordenDePalanca(Math.cos(rad) * f * R, Math.sin(rad) * f * R, R, aj)
              n++
              const donde = `${curva} v≤${vMax} w≤${wMax} a ${f.toFixed(2)}·${ang}°`
              if (o.v !== 0 && Math.abs(o.v) < V_MIN - 1e-9) fallos.push(`v bajo mínimo: ${donde}`)
              if (o.w !== 0 && Math.abs(o.w) < W_MIN - 1e-9) fallos.push(`w bajo mínimo: ${donde}`)
              if (Math.abs(o.v) > vMax + 1e-9) fallos.push(`v sobre techo: ${donde}`)
              if (Math.abs(o.w) > wMax + 1e-9) fallos.push(`w sobre techo: ${donde}`)
              if (!dentroDeLoMedido(o, aj)) fallos.push(`fuera de lo medido: ${donde}`)
            }
          }
        }
      }
    }
    expect(fallos.slice(0, 5), `${fallos.length} puntos fuera de lo medido`).toEqual([])
    expect(n, 'el barrido no ha cubierto el espacio').toBeGreaterThan(15000)
  })

  it('al borde pide el tope, con las dos curvas', () => {
    for (const curva of CURVAS) {
      expect(ordenDePalanca(0, -R, R, con({ curva })).v).toBeCloseTo(V_MAX_SEGURO, 9)
      expect(ordenDePalanca(0, R, R, con({ curva })).v).toBeCloseTo(-V_MAX_SEGURO, 9)
    }
  })

  /*
   * 🔴 IZQUIERDA ES `w` POSITIVA. REP-103 —antihorario positivo— y el SDK del
   *    RVR lo cumple: verificado MIRANDO el robot, no deducido. La cruz de mando
   *    ya lo hacia asi, y girar al reves aqui habria puesto dos mandos de la
   *    misma pantalla en sentidos opuestos.
   */
  it('🔴 izquierda gira positivo, derecha negativo', () => {
    expect(ordenDePalanca(-R, 0, R, A).w).toBeGreaterThan(0)
    expect(ordenDePalanca(R, 0, R, A).w).toBeLessThan(0)
  })

  it('adelante es v positiva, aunque el DOM crezca hacia abajo', () => {
    expect(ordenDePalanca(0, -R, R, A).v).toBeGreaterThan(0)
    expect(ordenDePalanca(0, R, R, A).v).toBeLessThan(0)
  })

  /*
   * 🔴 SE RECORTA EL VECTOR, NO CADA EJE. Recortando por eje, la diagonal daria
   *    magnitud √2 — un 41 % mas que cualquier otra direccion— y el robot
   *    trazaria arcos mas rapidos cuanto mas diagonal fuera el gesto.
   */
  it('🔴 una diagonal fuera del circulo no pide mas que el borde', () => {
    const esquina = ordenDePalanca(R, -R, R, A)
    expect(Math.abs(esquina.v)).toBeLessThanOrEqual(V_MAX_SEGURO + 1e-9)
    expect(Math.abs(esquina.w)).toBeLessThanOrEqual(W_POR_DEFECTO + 1e-9)
    const recto = ordenDePalanca(0, -R, R, A)
    expect(Math.abs(esquina.v)).toBeLessThan(Math.abs(recto.v))
  })

  it('cada deslizador manda sobre SU eje y no sobre el otro', () => {
    expect(ordenDePalanca(0, -R, R, con({ vMax: 0.12 })).v).toBeCloseTo(0.12, 9)
    // Con el techo lineal bajo, el giro sigue llegando a su propio tope.
    expect(ordenDePalanca(-R, 0, R, con({ vMax: 0.12 })).w).toBeCloseTo(W_POR_DEFECTO, 9)
    // Y al revés.
    expect(ordenDePalanca(-R, 0, R, con({ wMax: W_MAX })).w).toBeCloseTo(W_MAX, 9)
    expect(ordenDePalanca(0, -R, R, con({ wMax: W_MAX })).v).toBeCloseTo(V_MAX_SEGURO, 9)
  })

  it('un radio imposible o un puntero raro no producen orden', () => {
    expect(ordenDePalanca(10, 10, 0, A)).toEqual({ v: 0, w: 0 })
    expect(ordenDePalanca(NaN, 0, R, A)).toEqual({ v: 0, w: 0 })
    expect(ordenDePalanca(0, Infinity, R, A)).toEqual({ v: 0, w: 0 })
  })
})

describe('la curva de respuesta', () => {
  /*
   * La razón de existir de `suave`: a media palanca pide bastante menos, o sea
   * que el recorrido cercano al centro tiene más resolución. Al borde coinciden.
   */
  it('🔴 «suave» pide menos que «directa» a media palanca, y lo mismo al borde', () => {
    const media = 0.5
    const d = ordenDePalanca(0, -media * R, R, con({ curva: 'directa' }))
    const s = ordenDePalanca(0, -media * R, R, con({ curva: 'suave' }))
    expect(s.v).toBeLessThan(d.v)
    expect(s.v).toBeGreaterThanOrEqual(V_MIN)

    const dBorde = ordenDePalanca(0, -R, R, con({ curva: 'directa' }))
    const sBorde = ordenDePalanca(0, -R, R, con({ curva: 'suave' }))
    expect(sBorde.v).toBeCloseTo(dBorde.v, 9)
  })

  /*
   * 🔴 MONOTONÍA: más palanca nunca puede pedir menos. Una curva que se hundiera
   *    en algún tramo haría que empujar más frenara el robot — indistinguible de
   *    una avería para quien conduce.
   */
  it('🔴 más palanca nunca pide menos, con las dos curvas', () => {
    for (const curva of CURVAS) {
      let previo = -1
      for (let f = ZONA_MUERTA + 0.001; f <= 1.0001; f += 0.005) {
        const v = ordenDePalanca(0, -f * R, R, con({ curva })).v
        expect(v, `${curva} a ${f.toFixed(3)}`).toBeGreaterThanOrEqual(previo - 1e-12)
        previo = v
      }
    }
  })
})

describe('ordenDeTeclado', () => {
  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 LA PRUEBA QUE PAGA EL BILLETE: LAS DOS VÍAS TIENEN QUE COINCIDIR
   * ═════════════════════════════════════════════════════════════════════════
   * El teclado calculaba su orden A MANO en el componente, sin pasar por
   * `palanca.ts`. Daba los mismos números **por casualidad** —las teclas solo
   * valen −1, 0 o 1— y el invariante estaba escrito dos veces con pruebas en una
   * sola. Al abrir el techo del giro a 2,0, la copia se habría quedado con el
   * techo viejo y las dos vías habrían girado a velocidades distintas, sin que
   * lo viera `tsc` ni el resto de la batería.
   */
  it('🔴 a deflexión completa, teclado y palanca piden LO MISMO', () => {
    for (const wMax of [W_MIN, W_POR_DEFECTO, W_MAX]) {
      for (const vMax of [V_MIN, V_MAX_SEGURO, V_MAX_DURO]) {
        const aj = { vMax, wMax, curva: 'directa' as Curva }
        expect(ordenDeTeclado({ v: 1, w: 0 }, aj).v).toBeCloseTo(ordenDePalanca(0, -R, R, aj).v, 9)
        expect(ordenDeTeclado({ v: -1, w: 0 }, aj).v).toBeCloseTo(ordenDePalanca(0, R, R, aj).v, 9)
        expect(ordenDeTeclado({ v: 0, w: 1 }, aj).w).toBeCloseTo(ordenDePalanca(-R, 0, R, aj).w, 9)
        expect(ordenDeTeclado({ v: 0, w: -1 }, aj).w).toBeCloseTo(ordenDePalanca(R, 0, R, aj).w, 9)
      }
    }
  })

  /*
   * ⚠️ El teclado NO lleva curva, y es correcto: una tecla no tiene recorrido.
   *    Está o no está. La curva reparte un recorrido que aquí no existe, y
   *    aplicarla haría que la misma tecla pidiera cosas distintas según un ajuste
   *    que no tiene nada que ver con ella.
   */
  it('🔴 la curva no afecta al teclado', () => {
    for (const curva of CURVAS) {
      expect(ordenDeTeclado({ v: 1, w: 1 }, con({ curva }))).toEqual(
        { v: V_MAX_SEGURO, w: W_POR_DEFECTO },
      )
    }
  })

  it('sin tecla, cero', () => {
    expect(ordenDeTeclado({ v: 0, w: 0 }, A)).toEqual({ v: 0, w: 0 })
  })

  it('lo que sale del teclado también está dentro de lo medido', () => {
    for (const v of [-1, 0, 1]) {
      for (const w of [-1, 0, 1]) {
        expect(dentroDeLoMedido(ordenDeTeclado({ v, w }, A), A), `${v},${w}`).toBe(true)
      }
    }
  })
})

describe('el pestillo del tramo rápido', () => {
  it('echado tope a 0,20; suelto, a 0,40', () => {
    expect(techoLineal(false)).toBe(V_MAX_SEGURO)
    expect(techoLineal(true)).toBe(V_MAX_DURO)
  })

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴 SE PUEDE ECHAR EL PESTILLO CON EL DESLIZADOR ARRIBA, Y ESO HAY QUE CAZARLO
   * ═════════════════════════════════════════════════════════════════════════
   * Sin este recorte, quien subiera a 0,40 y volviera a echar el pestillo se
   * quedaría conduciendo a 0,40 con la pantalla diciendo que el tope son 0,20:
   * el control puesto y sin efecto que este proyecto persigue en todas partes —
   * el `chmod` sobre vfat, el `usercfg.txt` de 24.04, el drop-in que pierde.
   */
  it('🔴 al echar el pestillo, un techo alto se recorta', () => {
    expect(vMaxPermitida(V_MAX_DURO, false)).toBe(V_MAX_SEGURO)
    expect(vMaxPermitida(0.35, false)).toBe(V_MAX_SEGURO)
  })

  it('con el pestillo suelto, 0,40 pasa entero', () => {
    expect(vMaxPermitida(V_MAX_DURO, true)).toBe(V_MAX_DURO)
  })

  it('nunca baja del suelo medido, ni con basura', () => {
    expect(vMaxPermitida(0.01, true)).toBe(V_MIN)
    expect(vMaxPermitida(-5, false)).toBe(V_MIN)
    expect(vMaxPermitida(NaN, true)).toBe(V_MIN)
  })
})

describe('dentroDeLoMedido', () => {
  /*
   * 🔴 HOY SIEMPRE ES `true` POR EL CAMINO NORMAL, Y POR ESO HACE FALTA.
   *    `ordenDePalanca` ya remapea a la franja medida; este es el control que se
   *    pondria rojo el dia que alguien cambie el remapeo y empiece a pedir
   *    valores sin medir.
   */
  it('caza una orden por debajo del suelo medido', () => {
    expect(dentroDeLoMedido({ v: 0.02, w: 0 }, A)).toBe(false)
    expect(dentroDeLoMedido({ v: 0, w: 0.1 }, A)).toBe(false)
  })

  it('el cero exacto sí vale: es «no pido nada»', () => {
    expect(dentroDeLoMedido({ v: 0, w: 0 }, A)).toBe(true)
  })

  it('y caza pasarse por arriba, de los dos techos', () => {
    expect(dentroDeLoMedido({ v: 0.5, w: 0 }, A)).toBe(false)
    expect(dentroDeLoMedido({ v: 0, w: 3 }, A)).toBe(false)
    // 0,30 es legítimo con el pestillo suelto y NO lo es con él echado.
    expect(dentroDeLoMedido({ v: 0.3, w: 0 }, con({ vMax: V_MAX_DURO }))).toBe(true)
    expect(dentroDeLoMedido({ v: 0.3, w: 0 }, A)).toBe(false)
  })
})
