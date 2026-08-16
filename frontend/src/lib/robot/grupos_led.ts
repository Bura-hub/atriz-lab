/**
 * LOS DOCE GRUPOS DE LED DEL RVR, y a qué servicio va cada selección.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA PANTALLA OFRECÍA **UNO DE DOCE**, Y NO ERA UNA DECISIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * `PanelLeds` mandaba **siempre** a `led_id 11` (`all_lights`). Los diez grupos
 * normales —faros, luces de freno, indicadores, puerta de la batería, botón de
 * encendido— existían en el robot, estaban en la lista blanca y **no había forma
 * de llegar a ellos desde la web**. El propio repositorio ya lo tenía anotado
 * como deriva abierta.
 *
 * 👤 Y para el profesor cierra un hueco que no tenía ningún otro sitio: con
 *    dieciséis robots iguales en una sala, **«enciende los faros de rvr-07» es la
 *    única forma de encontrarlo**. El override de direcciones del muro apunta a
 *    la red, no al sitio físico.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ LO QUE **NO** HAY QUE VIGILAR AQUÍ: EL CONTEO DE BITS
 * ═══════════════════════════════════════════════════════════════════════════
 * La trampa histórica es que `set_all_leds` espera **un valor de brillo por BIT
 * del grupo** —tres para los normales, treinta para `all_lights`, uno para
 * `undercarriage_white`— y mandar tres a los dos últimos **no da error**: el RVR
 * lo acepta y no hace nada.
 *
 * Eso está cerrado **río arriba**, en el driver, y lo comparten los tres
 * servicios de LED: cuenta los bits del grupo y expande. La web manda
 * `led_id + r + g + b`. **Un selector de doce grupos no puede reintroducir ese
 * fallo**, y decirlo aquí evita que alguien lo «arregle» otra vez en el cliente.
 */

import { RGB } from './color_led'

export interface GrupoLed {
  id: number
  /** En español, y agrupado por pareja física. Los nombres del SDK son inglés. */
  nombre: string
  /** `izquierdo`/`derecho` o `delante`/`detrás`. `null` para los que van solos. */
  lado: string | null
}

/**
 * Los diez grupos que se pueden elegir.
 *
 * 📌 `all_lights` va el ÚLTIMO en el driver a propósito, «para que el `led_id 0`
 *    sea una luz concreta y no todas — una sorpresa desagradable para quien
 *    pruebe». Aquí no aparece: no es una undécima luz, es el OR de estas diez.
 */
export const GRUPOS: readonly GrupoLed[] = [
  { id: 0, nombre: 'Faros', lado: 'izquierdo' },
  { id: 1, nombre: 'Faros', lado: 'derecho' },
  { id: 2, nombre: 'Luces de freno', lado: 'izquierdo' },
  { id: 3, nombre: 'Luces de freno', lado: 'derecho' },
  { id: 4, nombre: 'Indicadores', lado: 'izquierdo' },
  { id: 5, nombre: 'Indicadores', lado: 'derecho' },
  { id: 6, nombre: 'Puerta de la batería', lado: 'delante' },
  { id: 7, nombre: 'Puerta de la batería', lado: 'detrás' },
  { id: 8, nombre: 'Botón de encendido', lado: 'delante' },
  { id: 9, nombre: 'Botón de encendido', lado: 'detrás' },
]

/** `all_lights`. No se selecciona: es a lo que colapsa «todas». */
export const TODAS_LAS_LUCES = 11

/**
 * `undercarriage_white`. **No se puede elegir, y no es una omisión.**
 *
 * 🔴 Está MEDIDO que responde `success = true` y **deja el LED apagado**: el
 *    testigo de luz dio 0,0 contra 2,497 con los demás. No lo enciende este
 *    grupo sino `enable_color_detection`, que es otro comando.
 *
 * → Es el ÚNICO camino de esta interfaz que produce un `success` verdadero sin
 *   efecto. Ofrecerlo sería regalar el fallo. Se enseña **desactivado y con el
 *   motivo pegado**, en vez de esconderlo: con un selector delante, quien haya
 *   leído la tabla del SDK contará once y buscará el que falta — y el párrafo
 *   del pie explica una ausencia lejos de donde se nota.
 */
export const LED_BAJOS = 10

/** Los presets. Fijan la selección; no son un modo aparte. */
export const PRESETS: readonly { nombre: string; ids: readonly number[] }[] = [
  { nombre: 'Todas', ids: GRUPOS.map((g) => g.id) },
  // Delante y detrás salen de la geometría del RVR que SÍ está documentada:
  // faros delante, luces de freno detrás. Los otros seis grupos no tienen
  // posición registrada en ninguna evidencia, así que no se reparten.
  { nombre: 'Faros', ids: [0, 1] },
  { nombre: 'Freno', ids: [2, 3] },
  { nombre: 'Ninguna', ids: [] },
]

export type Peticion =
  | { servicio: '/set_led_rgb'; cuerpo: { led_id: number; red: number; green: number; blue: number } }
  | {
    servicio: '/set_multiple_leds'
    cuerpo: { led_ids: number[]; red_values: number[]; green_values: number[]; blue_values: number[] }
  }

/**
 * Qué mandar para pintar `seleccion` de `color`. `null` si no hay nada elegido.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LOS DIEZ SELECCIONADOS COLAPSAN A `all_lights`, Y ESO NO ES COSMÉTICA
 * ═══════════════════════════════════════════════════════════════════════════
 * El driver de `/set_multiple_leds` valida las cuatro listas **antes de mandar
 * nada** y luego emite **un `set_all_leds` por CADA id**. O sea que elegir los
 * diez a mano son **diez idas y vueltas al puerto serie** del RVR, y `all_lights`
 * es **una**. La persona ve diez casillas marcadas —que es la verdad— y el cable
 * lleva una llamada.
 *
 * ⚠️ Y hay un modo de fallo que la pantalla tiene que poder contar: ese bucle
 *    corta al primer error **con los anteriores ya cambiados**. La validación
 *    previa evita el estado a medias por datos malos, no por fallo de transporte.
 *    El `message` del robot trae el nombre exacto del que falló.
 *
 * 🔴 Y `LED_BAJOS` se filtra aquí también, no solo en la interfaz. Un control
 *    desactivado se puede saltar; una función pura, no — y esta es la que decide
 *    lo que sale por el cable.
 */
export function peticionPara(seleccion: readonly number[], color: RGB): Peticion | null {
  const validos = [...new Set(seleccion)]
    .filter((id) => GRUPOS.some((g) => g.id === id))
    .sort((a, b) => a - b)
  if (validos.length === 0) return null

  const { rojo: red, verde: green, azul: blue } = color

  if (validos.length === GRUPOS.length) {
    return { servicio: '/set_led_rgb', cuerpo: { led_id: TODAS_LAS_LUCES, red, green, blue } }
  }
  if (validos.length === 1) {
    return { servicio: '/set_led_rgb', cuerpo: { led_id: validos[0], red, green, blue } }
  }
  return {
    servicio: '/set_multiple_leds',
    cuerpo: {
      led_ids: validos,
      red_values: validos.map(() => red),
      green_values: validos.map(() => green),
      blue_values: validos.map(() => blue),
    },
  }
}

/**
 * Lo que se está a punto de pintar, en palabras. Para decirlo ANTES de pulsar.
 *
 * 📝 «los diez grupos» y no «todas las luces»: `undercarriage_white` no entra, y
 *    decir «todas» sería la duodécima vez que esta pantalla promete de más.
 */
export function describirSeleccion(seleccion: readonly number[]): string {
  const n = [...new Set(seleccion)].filter((id) => GRUPOS.some((g) => g.id === id)).length
  if (n === 0) return 'ningún grupo elegido'
  if (n === GRUPOS.length) return `los ${GRUPOS.length} grupos, en una sola llamada`
  if (n === 1) return '1 grupo'
  return `${n} grupos, en una llamada con la lista`
}

/**
 * 🔴 «APAGAR TODO» IGNORA LA SELECCIÓN, y es deliberado.
 *
 * Hoy «Apagar» apaga todo, y su caso de uso número uno —el que justifica el
 * aviso de esta pantalla— es **apagar de golpe un robot que estorba**: está
 * medido que una luz olvidada aguanta 14 min 38 s encendida. Con selección,
 * «apagar» pasaría a apagar solo lo elegido, y quien acabe de seleccionar dos
 * faros se quedaría con los otros ocho encendidos creyendo que apagó.
 *
 * Apagar es una salida de emergencia, no una operación sobre la selección.
 */
export const NEGRO: RGB = { rojo: 0, verde: 0, azul: 0 }

export function peticionApagarTodo(): Peticion {
  return {
    servicio: '/set_led_rgb',
    cuerpo: { led_id: TODAS_LAS_LUCES, red: 0, green: 0, blue: 0 },
  }
}
