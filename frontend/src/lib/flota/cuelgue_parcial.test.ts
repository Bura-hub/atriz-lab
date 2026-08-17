import { describe, expect, it } from 'vitest'
import { RITMO_MEDIDO_HZ } from '../interfaz/llegadas'
import {
  FRASE_CUELGUE_PARCIAL, MENSAJES_PERDIDOS_PARA_SOSPECHAR, TOPIC_TESTIGO,
  UMBRAL_TELEMETRIA_VIEJA_MS, hayCuelgueParcial,
} from './cuelgue_parcial'

describe('el umbral', () => {
  /*
   * 🔴 La regla de este proyecto: el umbral se expresa en MENSAJES PERDIDOS y se
   *    traduce con el periodo de SU topic. Los 3000 ms de `salud.ts` son 50
   *    mensajes de `/odom` y serian TRES de `/motor_status` — copiarlos habria
   *    pintado las dieciseis baldosas «sin señal» al primer hipo de WiFi.
   */
  it('sale del ritmo medido de /battery_state, no de un numero copiado', () => {
    expect(RITMO_MEDIDO_HZ[TOPIC_TESTIGO]).toBe(1 / 30)
    expect(UMBRAL_TELEMETRIA_VIEJA_MS).toBe(MENSAJES_PERDIDOS_PARA_SOSPECHAR * 30_000)
  })

  it('son 90 s: tres publicaciones de 30 s', () => {
    expect(UMBRAL_TELEMETRIA_VIEJA_MS).toBe(90_000)
  })
})

describe('hayCuelgueParcial', () => {
  it('lo señala: latido vivo y la bateria vieja', () => {
    expect(hayCuelgueParcial({ latidoVivo: true, msDesdeTestigo: 90_001 })).toBe(true)
    expect(hayCuelgueParcial({ latidoVivo: true, msDesdeTestigo: 15 * 60_000 })).toBe(true)
  })

  it('calla mientras la bateria llega a su ritmo normal', () => {
    // 30 s es lo NORMAL de este topic, y 89 s siguen dentro de los tres perdidos.
    expect(hayCuelgueParcial({ latidoVivo: true, msDesdeTestigo: 30_000 })).toBe(false)
    expect(hayCuelgueParcial({ latidoVivo: true, msDesdeTestigo: 89_999 })).toBe(false)
    expect(hayCuelgueParcial({ latidoVivo: true, msDesdeTestigo: UMBRAL_TELEMETRIA_VIEJA_MS }))
      .toBe(false)
  })

  /*
   * 🔴 CON EL LATIDO CAIDO NO DICE NADA, y es deliberado: ahi ya hay un aviso
   *    —«sin señal de vida»— mejor fundado. Dos avisos sobre lo mismo tapan el
   *    bueno con el peor.
   */
  it('calla si el latido esta caido: eso ya tiene su propio aviso', () => {
    expect(hayCuelgueParcial({ latidoVivo: false, msDesdeTestigo: 15 * 60_000 })).toBe(false)
    expect(hayCuelgueParcial({ latidoVivo: false, msDesdeTestigo: null })).toBe(false)
  })

  /*
   * 🔴 `null` NO dispara. Que no haya llegado ninguna bateria todavia es el
   *    estado NORMAL de los primeros 30 s de cualquier conexion. Confundir «aun
   *    no ha llegado» con «dejo de llegar» es el error de `antiguedad_atasco_s`
   *    valiendo -1, que este proyecto arrastra documentado.
   */
  it('«todavia no ha llegado ninguna» no es «dejo de llegar»', () => {
    expect(hayCuelgueParcial({ latidoVivo: true, msDesdeTestigo: null })).toBe(false)
  })
})

describe('lo que se le dice a la persona', () => {
  /*
   * ⚠️ El fenomeno se ha visto UNA vez. La frase tiene que ofrecer la
   *    alternativa mundana —la red— o estaria afirmando una causa con n=1.
   */
  it('presenta el cuelgue como SOSPECHA, no como diagnostico', () => {
    expect(FRASE_CUELGUE_PARCIAL).toMatch(/Puede ser/)
    expect(FRASE_CUELGUE_PARCIAL).toMatch(/red/)
  })

  it('da el discriminador Y el remedio, que es lo unico medido de los tres', () => {
    expect(FRASE_CUELGUE_PARCIAL).toMatch(/infrarrojos/)
    expect(FRASE_CUELGUE_PARCIAL).toMatch(/bot[óo]n/)
  })
})
