import { describe, expect, it } from 'vitest'
import {
  APROXIMACION_RADIO_M, Efecto, MIN_PUNTOS_APROXIMACION, MIN_PUNTOS_PRECAUCION, PRECAUCION,
  TECHO_FRASE, contarInvasiones, efectoDe, fraseDe,
} from './poligonos_seguridad'
import { Punto } from '../interfaz/barrido'

const EFECTOS: Efecto[] = ['INMOVIL', 'FRENA', 'NADA']
/** Un punto a `d` metros justo delante del robot. */
const delante = (d: number): Punto => ({ x: d, y: 0 })
const repetir = (p: Punto, n: number): Punto[] => Array.from({ length: n }, () => p)

describe('contarInvasiones', () => {
  it('sin puntos no hay nada dentro', () => {
    expect(contarInvasiones([])).toEqual({ aproximacion: 0, precaucion: 0 })
  })

  it('un punto lejos no está en ninguna zona', () => {
    expect(contarInvasiones([delante(2.0)])).toEqual({ aproximacion: 0, precaucion: 0 })
  })

  /*
   * 🔴 EL CÍRCULO CABE ENTERO EN EL RECTÁNGULO, así que todo lo que invade la
   *    aproximación invade también la precaución. No es redundancia: es la razón
   *    de que `efectoDe` tenga que dar precedencia a «inmóvil».
   */
  it('🔴 lo que entra en el círculo entra también en el rectángulo', () => {
    const dentro = contarInvasiones([delante(APROXIMACION_RADIO_M - 0.01)])
    expect(dentro.aproximacion).toBe(1)
    expect(dentro.precaucion).toBe(1)
  })

  it('el borde exacto del círculo cuenta como dentro', () => {
    expect(contarInvasiones([delante(APROXIMACION_RADIO_M)]).aproximacion).toBe(1)
    expect(contarInvasiones([delante(APROXIMACION_RADIO_M + 0.001)]).aproximacion).toBe(0)
  })

  /*
   * 🔴 EL RECTÁNGULO ES MÁS ANCHO DE LO QUE PARECE: 60 cm de largo por **40 de
   *    ancho**, y el robot mide 21,7. Cualquier cosa a menos de ~9 cm de un
   *    costado lo frena al 40 % aunque se esté alejando de ella.
   */
  it('🔴 algo al costado, fuera del chasis, sí está en precaución', () => {
    const alLado: Punto = { x: 0, y: 0.18 }
    expect(contarInvasiones([alLado].concat()).precaucion).toBe(1)
    // Y a 21 cm ya no: el rectángulo acaba en 20.
    expect(contarInvasiones([{ x: 0, y: 0.21 }]).precaucion).toBe(0)
  })

  it('el rectángulo llega más lejos delante que detrás', () => {
    // 0,36 delante contra 0,24 detrás: la caja no está centrada en el robot.
    expect(contarInvasiones([delante(0.35)]).precaucion).toBe(1)
    expect(contarInvasiones([delante(-0.35)]).precaucion).toBe(0)
    expect(contarInvasiones([delante(-0.23)]).precaucion).toBe(1)
    expect(PRECAUCION.xMax).toBeGreaterThan(Math.abs(PRECAUCION.xMin))
  })

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 UN `NaN` HACE FALSAS TODAS LAS COMPARACIONES
   * ═══════════════════════════════════════════════════════════════════════════
   * Sin la guarda, un barrido con huecos contaría CERO invasiones y la pantalla
   * diría «nada dentro» sobre un robot bloqueado. Es la forma de `limitar(nan)`,
   * que en este proyecto devolvía el TOPE de velocidad.
   */
  it('🔴 un punto no finito se descarta, no falsea la cuenta', () => {
    const puntos = [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, delante(0.05)]
    expect(contarInvasiones(puntos)).toEqual({ aproximacion: 1, precaucion: 1 })
  })
})

describe('efectoDe', () => {
  /*
   * 🔴 SON DOS `min_points` DISTINTOS, Y ESTE FICHERO NACIÓ CON UNO SOLO:
   *      collision_monitor.yaml:316   Aproximacion  min_points: 2
   *      collision_monitor.yaml:340   Precaucion    min_points: 4
   *    Con el 2 en los dos, la pantalla anunciaba «FRENA» con 2 o 3 puntos dentro
   *    del rectángulo cuando el robot necesita 4.
   */
  it('🔴 el rectángulo necesita CUATRO puntos, no dos', () => {
    expect(efectoDe({ aproximacion: 0, precaucion: MIN_PUNTOS_PRECAUCION - 1 })).toBe('NADA')
    expect(efectoDe({ aproximacion: 0, precaucion: MIN_PUNTOS_PRECAUCION })).toBe('FRENA')
  })

  it('el círculo necesita dos', () => {
    expect(efectoDe({ aproximacion: MIN_PUNTOS_APROXIMACION - 1, precaucion: 9 })).toBe('FRENA')
    expect(efectoDe({ aproximacion: MIN_PUNTOS_APROXIMACION, precaucion: 9 })).toBe('INMOVIL')
  })

  /*
   * 🔴 «INMÓVIL» GANA. Un robot con algo dentro del círculo tiene además cosas
   *    dentro del rectángulo —el círculo cabe entero en él—, y decir «frena al
   *    40 %» de un robot que no se mueve EN ABSOLUTO mandaría a buscar la avería
   *    al sitio equivocado.
   */
  it('🔴 inmóvil gana a frenar', () => {
    expect(efectoDe({ aproximacion: 5, precaucion: 20 })).toBe('INMOVIL')
  })

  it('nada dentro es NADA', () => {
    expect(efectoDe({ aproximacion: 0, precaucion: 0 })).toBe('NADA')
  })

  /* El recorrido completo desde el barrido, que es como se usa de verdad. */
  it('un barrido con cuatro puntos al costado frena, y no inmoviliza', () => {
    expect(efectoDe(contarInvasiones(repetir({ x: 0.1, y: 0.18 }, 4)))).toBe('FRENA')
  })

  it('un barrido con dos puntos pegados inmoviliza', () => {
    expect(efectoDe(contarInvasiones(repetir(delante(0.12), 2)))).toBe('INMOVIL')
  })
})

describe('las frases', () => {
  it('🔴 caben de un vistazo', () => {
    for (const e of EFECTOS) {
      expect(fraseDe(e).length, `${e}: ${fraseDe(e)}`).toBeLessThanOrEqual(TECHO_FRASE)
    }
  })

  /*
   * 🔴 LA PARTE QUE NADIE ESPERA TIENE QUE ESTAR ESCRITA: con algo dentro del
   *    círculo el robot **ni siquiera puede alejarse**. Medido: avanzar
   *    alejándose 0,0 cm, girar 0,0°, retroceder 0,0 cm. Sin esa frase, quien lo
   *    vea intentará conducirlo hacia atrás y concluirá que está averiado.
   */
  it('🔴 «inmóvil» dice que ni siquiera puede alejarse', () => {
    expect(fraseDe('INMOVIL').toLowerCase()).toContain('alejar')
  })

  it('«frena» da el número que el alumno va a notar', () => {
    expect(fraseDe('FRENA')).toContain('40')
  })

  /*
   * 📝 Y con nada dentro NO se dice «el robot se moverá»: la capa de seguridad es
   *    una de varias razones por las que puede no obedecer —sin `/scan` no se
   *    mueve en absoluto, y la parada de emergencia manda sobre todo—.
   */
  it('🔴 «nada dentro» no promete que el robot vaya a moverse', () => {
    const f = fraseDe('NADA').toLowerCase()
    expect(f).toContain('otra')
    expect(f).not.toMatch(/se mover[áa]|puede conducir/)
  })

  it('cada efecto dice algo distinto', () => {
    expect(new Set(EFECTOS.map(fraseDe)).size).toBe(EFECTOS.length)
  })
})
