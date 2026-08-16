/**
 * MEDIR EL COLOR EN CONTINUO — la decisión de cuándo sondear. Sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EL MODO «SUPERFICIE LUMINOSA» ERA UN DISPARO Y EL OTRO NO
 * ═══════════════════════════════════════════════════════════════════════════
 * No era una decisión: es que **son dos caminos distintos del robot**, y solo
 * uno de ellos emite solo.
 *
 *   REFLEJO   el LED del sensor encendido → `/color` publica a ~13 Hz, y la
 *             pantalla lo enseña vivo. Los números cambian solos.
 *   EMISIÓN   el LED apagado → **`/color` publica CEROS**. Medido: 40 de 40
 *             mensajes no-cero con la luz encendida, **0 de 39** con ella
 *             apagada. El dato solo existe llamando a
 *             `/get_rgbc_sensor_values`, que es una CONSULTA: contesta una vez.
 *
 * Así que la superficie que emite se leía a golpes, con un botón, mientras la
 * normal cambiaba sola. 👤 Y quien mide una pantalla o una baldosa LED quiere
 * exactamente lo mismo que quien mide el suelo: mover el robot y ver el número
 * seguir. Se pide el servicio en bucle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL RITMO NO ES «LO MÁS RÁPIDO QUE SE PUEDA», Y HAY DOS TOPES MEDIDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *   · **El sensor refresca a ~21 Hz** aunque el servicio conteste a ~54: el
 *     61 % de las muestras de una tanda a tope eran **el mismo dato repetido**.
 *     Pedir más rápido que el sensor no trae información, trae tráfico.
 *   · **Una persona no lee un número que cambia 16 veces por segundo.** Está
 *     escrito en `useMuestreo` y es la razón de que la telemetría se muestree a
 *     2 Hz en vez de a 16,5.
 *
 * → **4 Hz.** Por debajo del refresco del sensor, así que cada muestra es nueva;
 *   y despacio para poder leerla. Cuesta cuatro llamadas por segundo de JSON
 *   diminuto por rosbridge, solo mientras la pestaña está delante.
 */

/** Cada cuánto se pide una lectura. Ver la cabecera: 4 Hz, no «lo que aguante». */
export const PERIODO_SONDEO_MS = 250

/**
 * Fallos seguidos antes de rendirse.
 *
 * 🔴 SIN ESTO, UN ERROR SE CONVIERTE EN CUATRO ERRORES POR SEGUNDO. Un bucle
 *    que reintenta sin memoria contra un robot que se acaba de apagar llena la
 *    pantalla de avisos idénticos y el journal del robot de llamadas — y el
 *    aviso que importa se pierde entre los cien iguales. Es la forma del driver
 *    imprimiendo «streaming reanudado» ocho veces en 30 s con el RVR apagado.
 *
 * ⚠️ Tres y no uno: la primera respuesta puede perderse por un hipo de WiFi, y
 *    rendirse al primero convertiría un parpadeo en una parada que hay que
 *    deshacer a mano.
 */
export const FALLOS_SEGUIDOS_PARA_PARAR = 3

export interface Sondeo {
  /** Lo paró una persona. */
  pausado: boolean
  /** Fallos consecutivos. Se pone a cero con cada acierto. */
  fallos: number
}

export const SONDEO_INICIAL: Sondeo = { pausado: false, fallos: 0 }

/** Lo paró la racha de fallos, no una persona. Son dos paradas distintas. */
export function paradoPorFallos(s: Sondeo): boolean {
  return s.fallos >= FALLOS_SEGUIDOS_PARA_PARAR
}

/**
 * ¿Hay que pedir otra lectura?
 *
 * 🔴 `hayModo` NO ES UN DETALLE: sin modo elegido la pantalla no sabe qué hay
 *    debajo del robot, y medir sin saberlo **no da un número peor, da el número
 *    al revés** — una pantalla roja a tope leída con el LED encendido sale con
 *    `R/G = 0,66`, o sea menos roja que verde. Antes de que alguien elija, no se
 *    mide nada.
 */
export function debeSondear(s: Sondeo, conectado: boolean, hayModo: boolean): boolean {
  return conectado && hayModo && !s.pausado && !paradoPorFallos(s)
}

export function trasFallo(s: Sondeo): Sondeo {
  return { ...s, fallos: s.fallos + 1 }
}

/**
 * 🔴 UN ACIERTO BORRA LA RACHA ENTERA, no resta uno. Si restara, dos fallos de
 *    cada tres irían acumulando hasta parar un sondeo que está funcionando —el
 *    falso positivo que este contador existe para evitar—.
 */
export function trasAcierto(s: Sondeo): Sondeo {
  return s.fallos === 0 ? s : { ...s, fallos: 0 }
}

/**
 * El botón. Reanudar **limpia los fallos**: si no, pulsar «seguir» tras una
 * parada por fallos no haría nada y el botón parecería roto.
 */
export function alternarPausa(s: Sondeo): Sondeo {
  return s.pausado || paradoPorFallos(s)
    ? { pausado: false, fallos: 0 }
    : { ...s, pausado: true }
}

/** Lo que dice el botón. */
export function rotuloBoton(s: Sondeo): string {
  return debeSondear(s, true, true) ? 'Pausar' : 'Seguir midiendo'
}

/**
 * En qué estado está el sondeo, para pintarlo. Cada caso tiene su causa, y son
 * distintas: «no has elegido», «no hay enlace», «lo paraste tú» y «se rindió».
 */
export type EstadoSondeo = 'SIN_MODO' | 'SIN_ENLACE' | 'PAUSADO' | 'RENDIDO' | 'MIDIENDO'

export function estadoDe(s: Sondeo, conectado: boolean, hayModo: boolean): EstadoSondeo {
  if (!hayModo) return 'SIN_MODO'
  if (!conectado) return 'SIN_ENLACE'
  if (paradoPorFallos(s)) return 'RENDIDO'
  if (s.pausado) return 'PAUSADO'
  return 'MIDIENDO'
}

/** Techo deliberado: si crece, ha vuelto el párrafo. */
export const TECHO_FRASE = 130

export function fraseDe(e: EstadoSondeo): string {
  switch (e) {
    case 'SIN_MODO':
      return 'Elige qué hay debajo del robot y empezará a medir solo.'
    case 'SIN_ENLACE':
      return 'Sin enlace con el robot no se puede pedir una lectura.'
    case 'PAUSADO':
      return 'En pausa. Lo de abajo es la última lectura, con su hora.'
    case 'RENDIDO':
      return `El sensor falló ${FALLOS_SEGUIDOS_PARA_PARAR} veces seguidas y dejé de pedirle. Mira el robot.`
    default:
      return `Midiendo solo, ${Math.round(1000 / PERIODO_SONDEO_MS)} veces por segundo.`
  }
}
