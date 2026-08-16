import { describe, expect, it } from 'vitest'
import { Monitor, Pedido, resumirBarrido } from './barrido'

const NADA: Pedido = { clase: 'NADA' }
const ARRANCADO: Pedido = { clase: 'ARRANCADO', hora: '12:04' }
const TODOS: Monitor[] = ['FALTA_BARRIDO', 'HAY_BARRIDO', 'NO_SE_SABE']

describe('resumirBarrido', () => {
  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 LA REGLA QUE JUSTIFICA TODO ESTE FICHERO
   * ═════════════════════════════════════════════════════════════════════════
   * Una OBSERVACIÓN del robot gana siempre a una MEMORIA de esta pestaña. Si
   * pulsaste «arrancar» hace cinco minutos y el monitor dice ahora que no le
   * llega el barrido, lo cierto es lo segundo: alguien pudo pararlo desde otra
   * pestaña o desde `atriz-escaneo`, o el LIDAR pudo desenchufarse — que en
   * este proyecto es un gesto cotidiano y deja el nodo agarrado a un descriptor
   * `(deleted)`.
   */
  it('🔴 el monitor GANA a lo que yo recuerdo haber pulsado', () => {
    const v = resumirBarrido(ARRANCADO, 'FALTA_BARRIDO')
    expect(v.clase).toBe('SIN_BARRIDO')
    expect(v.enVivo).toBe(true)
  })

  it('🔴 y nunca afirma «encendido» sin haberlo observado', () => {
    // Sin pedir nada y sin monitor: lo único cierto es que no se sabe.
    const v = resumirBarrido(NADA, 'NO_SE_SABE')
    expect(v.clase).toBe('NO_SE_SABE')
    expect(v.enVivo).toBe(false)
    expect(v.titulo).toBe('no se sabe')
  })

  /*
   * 🔴 EL CASO QUE MOTIVÓ EL CAMBIO. El estado por defecto —el de cada carga de
   *    página— decía literalmente «El barrido arranca APAGADO con el robot».
   *    Con el barrido encendido y una recarga, eso es falso. Se comprueba que
   *    la palabra ya no está: es una afirmación, no una explicación.
   */
  it('🔴 el caso por defecto NO dice «apagado»', () => {
    const v = resumirBarrido(NADA, 'NO_SE_SABE')
    expect(`${v.titulo} ${v.detalle}`.toLowerCase()).not.toMatch(/apagad/)
  })

  it('mientras arranca no adelanta el final', () => {
    // `/start_scan` puede devolver éxito con el puerto del LIDAR muerto, así que
    // «encendido» antes del primer /scan real sería adelantar un desenlace.
    const v = resumirBarrido({ clase: 'ARRANCANDO' }, 'NO_SE_SABE')
    expect(v.clase).toBe('ARRANCANDO')
    expect(v.enVivo).toBe(false)
  })

  it('🔴 y ARRANCANDO gana también a un monitor que dice que hay barrido', () => {
    // Si el monitor habla mientras arrancamos, es del barrido ANTERIOR: la
    // petición en vuelo todavía no ha confirmado nada.
    expect(resumirBarrido({ clase: 'ARRANCANDO' }, 'HAY_BARRIDO').clase).toBe('ARRANCANDO')
  })

  it('el monitor sin quejas SÍ vale como encendido, y se marca en vivo', () => {
    const v = resumirBarrido(NADA, 'HAY_BARRIDO')
    expect(v.clase).toBe('ENCENDIDO')
    expect(v.enVivo).toBe(true)
  })

  it('lo que pulsé vale, pero NO se marca en vivo', () => {
    const v = resumirBarrido(ARRANCADO, 'NO_SE_SABE')
    expect(v.clase).toBe('ENCENDIDO')
    expect(v.enVivo).toBe(false)
    expect(v.detalle).toMatch(/12:04/)
    // Y dice su propio límite en vez de callarlo.
    expect(v.detalle).toMatch(/no se está leyendo en vivo/i)
  })

  it('un fallo al arrancar no se pierde', () => {
    const v = resumirBarrido({ clase: 'FALLO', detalle: 'no llegó ni un /scan', hora: '12:07' }, 'NO_SE_SABE')
    expect(v.clase).toBe('FALLO')
    expect(v.detalle).toMatch(/no llegó ni un \/scan/)
  })

  it('parar deja «no se sabe», no «apagado»', () => {
    // Se pidió parar; que el servicio dijera que sí no prueba que el tambor
    // bajara. Y el tambor NO se detiene del todo: 11,8 Hz -> 2,7.
    const v = resumirBarrido({ clase: 'PARADO', hora: '12:09' }, 'NO_SE_SABE')
    expect(v.clase).toBe('NO_SE_SABE')
    expect(v.detalle).toMatch(/2,7/)
  })

  /*
   * CONTROL DE COBERTURA. Barre las quince combinaciones y comprueba invariantes
   * que tienen que valer SIEMPRE — no tres casos representativos, que es la
   * regla que este proyecto tiene escrita con sangre.
   */
  it('las quince combinaciones dan un veredicto coherente', () => {
    const pedidos: Pedido[] = [
      NADA,
      { clase: 'ARRANCANDO' },
      ARRANCADO,
      { clase: 'PARADO', hora: '12:09' },
      { clase: 'FALLO', detalle: 'x', hora: '12:07' },
    ]
    let n = 0
    for (const p of pedidos) {
      for (const m of TODOS) {
        const v = resumirBarrido(p, m)
        n++
        expect(v.titulo.length, 'sin título').toBeGreaterThan(0)
        expect(v.detalle.length, 'sin detalle').toBeGreaterThan(20)
        // 🔴 `enVivo` SOLO puede ser cierto si el monitor ha hablado. Es la
        //    promesa que hace creíble el resto: nunca se marca como observación
        //    algo que salga de la memoria de esta pestaña.
        if (v.enVivo) expect(m, `«${v.titulo}» dice en vivo sin monitor`).not.toBe('NO_SE_SABE')
        // Y con el monitor quejándose, el veredicto es SIEMPRE ese.
        if (m === 'FALTA_BARRIDO') expect(v.clase).toBe('SIN_BARRIDO')
      }
    }
    expect(n, 'no se han barrido las quince').toBe(15)
  })
})
