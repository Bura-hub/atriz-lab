import { describe, expect, it } from 'vitest'
import { PERDIDAS_TRAS_REINICIO, SIN_REINICIOS, trasLatido } from './reinicio'

/** Encadena latidos sobre el estado inicial, con un reloj de mentira. */
const correr = (latidos: readonly number[]) =>
  latidos.reduce((e, l, i) => trasLatido(e, l, 1000 + i), SIN_REINICIOS)

describe('trasLatido', () => {
  it('🔴 el PRIMER latido nunca es un reinicio, aunque valga 3', () => {
    /*
     * Sin referencia anterior no hay con que compararlo. Tratarlo como reinicio
     * haria que ABRIR LA PANTALLA avisara de uno que no ha ocurrido, y un aviso
     * que salta solo se aprende a ignorar — y entonces no sirve el dia que
     * importa.
     */
    expect(correr([3]).reinicios).toBe(0)
    expect(correr([3]).latidoPrevio).toBe(3)
  })

  it('un latido que sube no es nada', () => {
    expect(correr([10, 11, 12, 300]).reinicios).toBe(0)
  })

  it('un latido REPETIDO no es un reinicio', () => {
    // El driver republica su estado a 1 Hz: el mismo valor puede llegar dos
    // veces. Solo cuenta `ahora < previo`, estrictamente.
    expect(correr([10, 10, 10]).reinicios).toBe(0)
  })

  it('🔴 un latido que RETROCEDE sí lo es, y anota cuándo', () => {
    const e = correr([291, 292, 3])
    expect(e.reinicios).toBe(1)
    expect(e.latidoPrevio).toBe(3)
    expect(e.ultimo).toBe(1002)
  })

  it('cuenta varios reinicios seguidos', () => {
    expect(correr([100, 5, 40, 2]).reinicios).toBe(2)
  })

  it('🔴🔴 un `latido` que llega como CADENA deja el detector apagado — y no puede pasar', () => {
    /*
     * `latido` es `uint64` en EstadoRobot.msg. Si alguna capa lo entregara como
     * cadena, `Number.isFinite` daria false. Lo que NO puede pasar es que ese
     * valor se guarde como referencia: entonces toda comparacion posterior
     * fallaria y el detector quedaria APAGADO EN SILENCIO — el mismo modo de
     * fallo que existe para detectar.
     */
    const malo = trasLatido(SIN_REINICIOS, '42' as unknown as number, 1000)
    expect(malo.latidoPrevio).toBeNull()          // NO se guarda
    expect(malo).toEqual(SIN_REINICIOS)           // el estado no se toca

    // Y un valor roto en mitad de la serie tampoco rompe la referencia buena.
    let e = correr([100, 101])
    e = trasLatido(e, NaN, 1500)
    expect(e.latidoPrevio).toBe(101)
    e = trasLatido(e, 2, 1600)
    expect(e.reinicios).toBe(1)
  })

  it('los no finitos se ignoran todos', () => {
    for (const malo of [NaN, Infinity, -Infinity]) {
      expect(trasLatido(SIN_REINICIOS, malo, 1000)).toEqual(SIN_REINICIOS)
    }
  })

  it('es puro: no muta el estado que recibe', () => {
    const antes = correr([10])
    const copia = { ...antes }
    trasLatido(antes, 2, 2000)
    expect(antes).toEqual(copia)
  })
})

describe('PERDIDAS_TRAS_REINICIO', () => {
  it('🔴 son CUATRO, y la parada de emergencia va la PRIMERA', () => {
    /*
     * La parada baja sola al reiniciarse el driver y la web NO la vuelve a
     * publicar al reconectar —esta escrito a proposito en transporte.ts—, asi
     * que nadie la repone. Es la unica de las cuatro que es de SEGURIDAD, y por
     * eso encabeza: quien lea solo la primera linea tiene que leer esa.
     */
    expect(PERDIDAS_TRAS_REINICIO).toHaveLength(4)
    expect(PERDIDAS_TRAS_REINICIO[0]).toMatch(/parada de emergencia/i)
  })

  it('ninguna promete que algo se recupere solo', () => {
    // El barrido NO se restaura a proposito, y SLAM no vuelve. Prometerlo seria
    // peor que no decir nada.
    for (const p of PERDIDAS_TRAS_REINICIO) {
      expect(p).not.toMatch(/se recupera sol|vuelve sol[oa] al|se restaura autom/i)
    }
  })
})
