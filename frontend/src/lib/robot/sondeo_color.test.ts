import { describe, expect, it } from 'vitest'
import {
  EstadoSondeo, FALLOS_SEGUIDOS_PARA_PARAR, PERIODO_SONDEO_MS, SONDEO_INICIAL, Sondeo,
  TECHO_FRASE, alternarPausa, debeSondear, estadoDe, fraseDe, paradoPorFallos, rotuloBoton,
  trasAcierto, trasFallo,
} from './sondeo_color'

const ESTADOS: EstadoSondeo[] = ['SIN_MODO', 'SIN_ENLACE', 'PAUSADO', 'RENDIDO', 'MIDIENDO']
const conFallos = (n: number): Sondeo => ({ pausado: false, fallos: n })

describe('el ritmo', () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 NI MÁS RÁPIDO QUE EL SENSOR NI MÁS RÁPIDO QUE UN OJO
   * ═══════════════════════════════════════════════════════════════════════════
   * Dos topes MEDIDOS, y el ritmo tiene que caber entre los dos:
   *   · el sensor refresca a ~21 Hz aunque el servicio conteste a ~54 — el 61 %
   *     de las muestras de una tanda a tope eran el MISMO dato repetido;
   *   · una persona no lee un número que cambia 16 veces por segundo, que es la
   *     razón por la que la telemetría se muestrea a 2 Hz y no a 16,5.
   */
  it('🔴 cae entre lo que refresca el sensor y lo que lee una persona', () => {
    const hz = 1000 / PERIODO_SONDEO_MS
    expect(hz, 'más rápido que el sensor es tráfico, no información').toBeLessThan(21)
    expect(hz, 'más rápido que esto no se puede leer').toBeLessThanOrEqual(8)
    expect(hz, 'más lento y deja de parecer vivo').toBeGreaterThanOrEqual(2)
  })
})

describe('debeSondear', () => {
  it('con todo en orden, sí', () => {
    expect(debeSondear(SONDEO_INICIAL, true, true)).toBe(true)
  })

  /*
   * 🔴 SIN MODO NO SE MIDE, y no es una comodidad: medir sin saber qué hay
   *    debajo del robot **no da un número peor, da el número al revés**. Una
   *    pantalla roja a tope leída con el LED encendido sale con `R/G = 0,66`, o
   *    sea menos roja que verde. Medido.
   */
  it('🔴 sin modo elegido, NO — el número saldría al revés', () => {
    expect(debeSondear(SONDEO_INICIAL, true, false)).toBe(false)
  })

  it('sin enlace, no', () => {
    expect(debeSondear(SONDEO_INICIAL, false, true)).toBe(false)
  })

  it('en pausa, no', () => {
    expect(debeSondear({ pausado: true, fallos: 0 }, true, true)).toBe(false)
  })

  it('rendido por fallos, no', () => {
    expect(debeSondear(conFallos(FALLOS_SEGUIDOS_PARA_PARAR), true, true)).toBe(false)
  })
})

describe('la racha de fallos', () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 SIN ESTO, UN ERROR SON CUATRO ERRORES POR SEGUNDO
   * ═══════════════════════════════════════════════════════════════════════════
   * Es la forma del driver imprimiendo «streaming reanudado» ocho veces en 30 s
   * con el RVR apagado: un bucle que reintenta sin memoria llena la pantalla de
   * avisos idénticos y esconde el que importa entre los cien iguales.
   */
  it('🔴 se rinde tras la racha, y no antes', () => {
    let s = SONDEO_INICIAL
    for (let i = 1; i < FALLOS_SEGUIDOS_PARA_PARAR; i++) {
      s = trasFallo(s)
      expect(paradoPorFallos(s), `no debe rendirse al fallo ${i}`).toBe(false)
    }
    s = trasFallo(s)
    expect(paradoPorFallos(s)).toBe(true)
  })

  /*
   * 🔴 UN ACIERTO BORRA LA RACHA ENTERA, no resta uno. Restando, dos fallos de
   *    cada tres irían acumulando hasta parar un sondeo que funciona — que es
   *    justo el falso positivo que este contador existe para evitar.
   */
  it('🔴 un acierto borra la racha entera', () => {
    const s = trasAcierto(trasFallo(trasFallo(SONDEO_INICIAL)))
    expect(s.fallos).toBe(0)
  })

  it('alternando fallo y acierto NUNCA se rinde', () => {
    let s = SONDEO_INICIAL
    for (let i = 0; i < 50; i++) s = trasAcierto(trasFallo(s))
    expect(paradoPorFallos(s)).toBe(false)
  })

  it('un acierto sobre cero no crea un objeto nuevo', () => {
    // No es microoptimización: `Sondeo` va en el estado de React, y devolver un
    // objeto nuevo en cada acierto repintaría cuatro veces por segundo sin que
    // hubiera cambiado nada.
    expect(trasAcierto(SONDEO_INICIAL)).toBe(SONDEO_INICIAL)
  })
})

describe('alternarPausa', () => {
  it('midiendo → pausado', () => {
    expect(alternarPausa(SONDEO_INICIAL)).toEqual({ pausado: true, fallos: 0 })
  })

  it('pausado → midiendo', () => {
    expect(alternarPausa({ pausado: true, fallos: 0 })).toEqual({ pausado: false, fallos: 0 })
  })

  /*
   * 🔴 REANUDAR LIMPIA LOS FALLOS. Sin esto, pulsar «seguir midiendo» tras una
   *    parada por fallos no haría nada —`debeSondear` seguiría en falso— y el
   *    botón parecería roto. Es la clase de defecto que solo se ve pulsando.
   */
  it('🔴 reanudar tras rendirse vuelve a medir de verdad', () => {
    const s = alternarPausa(conFallos(FALLOS_SEGUIDOS_PARA_PARAR))
    expect(s.fallos).toBe(0)
    expect(debeSondear(s, true, true)).toBe(true)
  })
})

describe('estadoDe', () => {
  /*
   * 🔴 LA PRECEDENCIA: primero lo que la persona no ha hecho, después lo que
   *    falla. Sin modo elegido no importa si hay enlace — todavía no se ha
   *    pedido nada—, y decir «sin enlace» ahí mandaría a mirar la red cuando lo
   *    que falta es una decisión.
   */
  it('🔴 «no has elegido» gana a «no hay enlace»', () => {
    expect(estadoDe(SONDEO_INICIAL, false, false)).toBe('SIN_MODO')
  })

  it('rendido gana a pausado', () => {
    // Se rindió sola: decir «en pausa» sugeriría que basta con reanudar sin
    // mirar el robot, y la racha de fallos dice lo contrario.
    expect(estadoDe({ pausado: true, fallos: FALLOS_SEGUIDOS_PARA_PARAR }, true, true)).toBe('RENDIDO')
  })

  it('los cinco estados son alcanzables', () => {
    const vistos = new Set<EstadoSondeo>([
      estadoDe(SONDEO_INICIAL, true, false),
      estadoDe(SONDEO_INICIAL, false, true),
      estadoDe({ pausado: true, fallos: 0 }, true, true),
      estadoDe(conFallos(FALLOS_SEGUIDOS_PARA_PARAR), true, true),
      estadoDe(SONDEO_INICIAL, true, true),
    ])
    expect(vistos.size).toBe(ESTADOS.length)
  })
})

describe('las frases', () => {
  it('🔴 caben de un vistazo', () => {
    for (const e of ESTADOS) {
      expect(fraseDe(e).length, `${e}: ${fraseDe(e)}`).toBeLessThanOrEqual(TECHO_FRASE)
    }
  })

  it('cada estado dice algo distinto', () => {
    expect(new Set(ESTADOS.map(fraseDe)).size).toBe(ESTADOS.length)
  })

  it('el botón dice lo contrario de lo que está pasando', () => {
    expect(rotuloBoton(SONDEO_INICIAL)).toBe('Pausar')
    expect(rotuloBoton({ pausado: true, fallos: 0 })).toBe('Seguir midiendo')
    expect(rotuloBoton(conFallos(FALLOS_SEGUIDOS_PARA_PARAR))).toBe('Seguir midiendo')
  })
})
