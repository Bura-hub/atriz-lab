import { describe, expect, it } from 'vitest'
import {
  GRUPOS, LED_BAJOS, PRESETS, TODAS_LAS_LUCES, describirSeleccion, peticionApagarTodo, peticionPara,
} from './grupos_led'

const ROJO = { rojo: 255, verde: 0, azul: 0 }
const TODOS = GRUPOS.map((g) => g.id)

describe('la tabla de grupos', () => {
  it('son los diez seleccionables, con ids 0..9', () => {
    expect(GRUPOS).toHaveLength(10)
    expect(GRUPOS.map((g) => g.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  /*
   * 🔴 NI `all_lights` NI `undercarriage_white` SON SELECCIONABLES, y por razones
   *    distintas: el primero no es una undécima luz —es el OR de las diez— y el
   *    segundo está MEDIDO respondiendo `success = true` con el LED apagado.
   */
  it('🔴 los dos grupos raros se quedan fuera de la lista', () => {
    expect(GRUPOS.some((g) => g.id === TODAS_LAS_LUCES)).toBe(false)
    expect(GRUPOS.some((g) => g.id === LED_BAJOS)).toBe(false)
  })

  it('cada grupo tiene nombre en español y ningún par se repite', () => {
    const claves = GRUPOS.map((g) => `${g.nombre} ${g.lado ?? ''}`)
    expect(new Set(claves).size).toBe(GRUPOS.length)
    for (const g of GRUPOS) expect(g.nombre.length).toBeGreaterThan(2)
  })

  it('los presets solo nombran grupos que existen', () => {
    for (const p of PRESETS) {
      for (const id of p.ids) {
        expect(GRUPOS.some((g) => g.id === id), `${p.nombre} usa el ${id}`).toBe(true)
      }
    }
  })

  it('«Todas» son las diez y «Ninguna» es vacío', () => {
    expect(PRESETS.find((p) => p.nombre === 'Todas')?.ids).toEqual(TODOS)
    expect(PRESETS.find((p) => p.nombre === 'Ninguna')?.ids).toEqual([])
  })
})

describe('peticionPara', () => {
  it('sin selección no se manda nada', () => {
    expect(peticionPara([], ROJO)).toBeNull()
  })

  it('un solo grupo va por /set_led_rgb con su id', () => {
    const p = peticionPara([3], ROJO)
    expect(p).toEqual({
      servicio: '/set_led_rgb',
      cuerpo: { led_id: 3, red: 255, green: 0, blue: 0 },
    })
  })

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 LOS DIEZ COLAPSAN A `all_lights`: DIEZ IDAS AL PUERTO SERIE CONTRA UNA
   * ═══════════════════════════════════════════════════════════════════════════
   * El driver de `/set_multiple_leds` emite **un `set_all_leds` por CADA id**.
   * Elegir los diez a mano serían diez idas y vueltas al puerto serie del RVR;
   * `all_lights` es una. La persona ve diez casillas marcadas —que es la verdad—
   * y el cable lleva una llamada.
   */
  it('🔴 los diez colapsan a una sola llamada', () => {
    const p = peticionPara(TODOS, ROJO)
    expect(p?.servicio).toBe('/set_led_rgb')
    expect(p).toMatchObject({ cuerpo: { led_id: TODAS_LAS_LUCES } })
  })

  it('entre dos y nueve va la lista', () => {
    const p = peticionPara([0, 1, 5], ROJO)
    expect(p).toEqual({
      servicio: '/set_multiple_leds',
      cuerpo: {
        led_ids: [0, 1, 5],
        red_values: [255, 255, 255],
        green_values: [0, 0, 0],
        blue_values: [0, 0, 0],
      },
    })
  })

  it('las cuatro listas siempre miden lo mismo', () => {
    for (const sel of [[0, 1], [2, 4, 6, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]]) {
      const p = peticionPara(sel, ROJO)
      if (p?.servicio !== '/set_multiple_leds') throw new Error('debería ser la lista')
      const { led_ids, red_values, green_values, blue_values } = p.cuerpo
      expect(red_values).toHaveLength(led_ids.length)
      expect(green_values).toHaveLength(led_ids.length)
      expect(blue_values).toHaveLength(led_ids.length)
    }
  })

  /*
   * 🔴 EL FILTRO VIVE AQUÍ Y NO SOLO EN LA INTERFAZ. Un control desactivado se
   *    puede saltar; una función pura, no — y esta es la que decide lo que sale
   *    por el cable. `undercarriage_white` es el único camino de esta aplicación
   *    que produce un `success = true` MEDIDO sin efecto.
   */
  it('🔴 el LED de los bajos no puede colarse ni pidiéndolo', () => {
    expect(peticionPara([LED_BAJOS], ROJO)).toBeNull()
    const p = peticionPara([0, LED_BAJOS, 1], ROJO)
    expect(p).toMatchObject({ cuerpo: { led_ids: [0, 1] } })
  })

  it('🔴 `all_lights` tampoco se cuela como si fuera un grupo más', () => {
    expect(peticionPara([TODAS_LAS_LUCES], ROJO)).toBeNull()
  })

  it('los repetidos no duplican la orden', () => {
    const p = peticionPara([2, 2, 2], ROJO)
    expect(p).toMatchObject({ servicio: '/set_led_rgb', cuerpo: { led_id: 2 } })
  })

  it('el orden de la selección no cambia lo que se manda', () => {
    expect(peticionPara([5, 1, 3], ROJO)).toEqual(peticionPara([3, 5, 1], ROJO))
  })
})

describe('describirSeleccion', () => {
  it('dice cuántos y si va en una llamada', () => {
    expect(describirSeleccion([])).toContain('ningún')
    expect(describirSeleccion([1])).toContain('1 grupo')
    expect(describirSeleccion([1, 2])).toContain('2 grupos')
    expect(describirSeleccion(TODOS)).toContain('10 grupos')
  })

  /*
   * 📝 «los diez grupos» y NO «todas las luces»: el LED de los bajos no entra, y
   *    decir «todas» sería prometer de más otra vez en esta misma pantalla.
   */
  it('🔴 nunca dice «todas»', () => {
    expect(describirSeleccion(TODOS).toLowerCase()).not.toContain('todas')
  })
})

describe('peticionApagarTodo', () => {
  /*
   * 🔴 IGNORA LA SELECCIÓN A PROPÓSITO. Su caso de uso es apagar de golpe un
   *    robot que estorba —está medido que una luz olvidada aguanta 14 min 38 s—,
   *    y con selección apagaría solo lo elegido: quien acabe de marcar dos faros
   *    se quedaría con ocho encendidos creyendo que apagó.
   */
  it('🔴 apaga los doce, no lo seleccionado', () => {
    expect(peticionApagarTodo()).toEqual({
      servicio: '/set_led_rgb',
      cuerpo: { led_id: TODAS_LAS_LUCES, red: 0, green: 0, blue: 0 },
    })
  })
})
