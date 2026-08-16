import { describe, expect, it } from 'vitest'
import {
  QueDijoLaAccion, TECHO_QUE_HACER, nivelDe, queHacerAhora, recorridoEntre, rotuloDe,
} from './resultado_objetivo'

const AMBOS: QueDijoLaAccion[] = ['TERMINO', 'FALLO']

describe('recorridoEntre', () => {
  it('mide la distancia entre dos poses de /odom', () => {
    expect(recorridoEntre({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('un robot que no se movió da cero, no null', () => {
    // Cero es una medida: el robot recibió el objetivo y no se movió. Es
    // justamente el caso que hay que poder distinguir de «no se pudo medir».
    expect(recorridoEntre({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0)
  })

  it('sin partida o sin llegada, no se sabe', () => {
    expect(recorridoEntre(null, { x: 1, y: 1 })).toBeNull()
    expect(recorridoEntre({ x: 1, y: 1 }, null)).toBeNull()
    expect(recorridoEntre(null, null)).toBeNull()
  })

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 `Math.hypot` DE UN `NaN` DEVUELVE `NaN`, Y ESO SE PINTA COMO «NaN m»
   * ═══════════════════════════════════════════════════════════════════════════
   * Es la forma de `limitar(nan)`, que en este proyecto devolvía el TOPE de
   * velocidad porque `abs(nan) <= tope` es falso y caía en la rama de recorte.
   * La regla que quedó escrita: **comprueba `isFinite` ANTES de comparar** — o
   * aquí, antes de restar. Un instrumento que imprime `NaN` ha dejado de serlo.
   */
  it('🔴 un valor no finito da «no se sabe», nunca NaN', () => {
    for (const malo of [NaN, Infinity, -Infinity]) {
      expect(recorridoEntre({ x: malo, y: 0 }, { x: 1, y: 1 }), `x=${malo}`).toBeNull()
      expect(recorridoEntre({ x: 0, y: 0 }, { x: 1, y: malo }), `y=${malo}`).toBeNull()
    }
  })
})

describe('queHacerAhora', () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 EL TECHO ES LA PRUEBA: SI CRECE, HA VUELTO EL PÁRRAFO
   * ═══════════════════════════════════════════════════════════════════════════
   * Esto se leía como **~400 caracteres en el éxito y ~600 en el fallo**, con la
   * historia del mapa rancio, el plazo de 20 ms y la curva de anchos de hueco
   * todo seguido — y se lee justo cuando el robot acaba de pararse en el aula.
   *
   * El contexto no se ha borrado: está en `Contexto`, a un clic. Lo que esta
   * prueba impide es que vuelva a la línea que hay que leer de un vistazo.
   */
  it('🔴 la línea de acción cabe de un vistazo', () => {
    for (const a of AMBOS) {
      expect(queHacerAhora(a).length, `${a}: ${queHacerAhora(a)}`)
        .toBeLessThanOrEqual(TECHO_QUE_HACER)
    }
  })

  it('las dos mandan a MIRAR, que es lo único que resuelve la duda', () => {
    // No es retórica: los dos desenlaces están medidos mintiendo, así que la
    // acción correcta es la misma en los dos casos.
    for (const a of AMBOS) expect(queHacerAhora(a).toLowerCase()).toContain('mira')
  })

  it('los dos textos son distintos', () => {
    expect(queHacerAhora('TERMINO')).not.toBe(queHacerAhora('FALLO'))
  })
})

describe('nivelDe', () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 UN `ABORTED` NO ES UN ERROR ROJO, Y ANTES SE PINTABA ASÍ
   * ═══════════════════════════════════════════════════════════════════════════
   * Se ha medido a Nav2 abortar un objetivo que el robot cumplió diez segundos
   * después. Pintarlo en rojo de error afirma un fracaso que la propia pantalla
   * dice, dos líneas más abajo, que no se sabe.
   *
   * 📌 Y hay una razón más dura: en este proyecto **el rojo `--destructive` es
   *    exclusivo de la parada de emergencia**. Cada rojo de más se lo come.
   */
  it('🔴 un fallo de la acción es ATENCION, nunca ERROR', () => {
    expect(nivelDe('FALLO')).toBe('ATENCION')
  })

  it('terminar es una nota', () => {
    expect(nivelDe('TERMINO')).toBe('NOTA')
  })
})

describe('rotuloDe', () => {
  /*
   * 🔴 «terminó» y «falló», NO «éxito» y «error». Nombrar al desenlace por su
   *    valor de verdad es la mitad del error que costó tres tandas dadas por
   *    fallidas cuando el robot había navegado bien las tres.
   */
  it('🔴 nombra lo que dijo la acción, no si salió bien', () => {
    const rotulos = AMBOS.map(rotuloDe).join(' ').toLowerCase()
    for (const prohibido of ['éxito', 'exito', 'correcto', 'llegó', 'llego']) {
      expect(rotulos, `no debe afirmar «${prohibido}»`).not.toContain(prohibido)
    }
  })

  it('son cortos: van al lado de una cifra', () => {
    for (const a of AMBOS) expect(rotuloDe(a).length).toBeLessThanOrEqual(12)
  })
})
