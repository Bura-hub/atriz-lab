/**
 * LATIDO VIVO CON TELEMETRÍA VIEJA: el cuelgue parcial del RVR, visto desde el muro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUÉ EL MURO NO PODÍA VERLO, Y POR QUÉ IMPORTA
 * ═══════════════════════════════════════════════════════════════════════════
 * El 2026-08-17 (evidencia 129) el RVR se colgó **a medias**: el procesador
 * principal (ST) dejó de mandar telemetría, keepalive y `get_system_info`,
 * mientras el otro (Nordic) seguía contestando `success=True` a los comandos de
 * infrarrojos **minutos después**. Ni dormido, ni apagado, ni el puerto muerto
 * de la evidencia 126: un modo de fallo nuevo.
 *
 * El robot escribió cuál es el síntoma en la plataforma —*«telemetría vieja con
 * latido vivo»*— y esta web **no podía distinguirlo**:
 *
 *   · el latido de la baldosa es `/motor_status`, y el driver lo **republica a
 *     1 Hz con su propio temporizador**, así que sigue llegando puntual con el
 *     último valor conocido aunque el RVR haya dejado de contestar;
 *   · `/battery_state` deja de llegar, pero como llega **cada 30 s** de todos
 *     modos, su ausencia no se distingue de la espera normal sin mirar el reloj.
 *
 * Resultado: **una baldosa en verde, «en línea», con un voltaje congelado.** Es
 * exactamente la familia de fallo que este proyecto persigue en el robot —el RVR
 * dormido con el nodo vivo, el nodo muerto con systemd en verde— aparecida en la
 * pantalla que existe para no cometerla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL UMBRAL SE EXPRESA EN MENSAJES PERDIDOS, NO EN MILISEGUNDOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Es regla escrita de este proyecto, y con un caso medido detrás: los 3000 ms de
 * `salud.ts` están calibrados contra `/odom` (16,5 Hz), o sea **50 mensajes**;
 * el mismo número sobre `/motor_status` (1 Hz) son **tres**, y habría pintado
 * las dieciséis baldosas «sin señal de vida» al primer hipo de WiFi.
 *
 * Aquí el topic que se vigila es `/battery_state`, que llega **cada 30,0 s
 * exactos**. Un umbral en milisegundos copiado de cualquier otro sitio sería
 * ruido; el que vale es «cuántas publicaciones suyas se han perdido».
 */

import { RITMO_MEDIDO_HZ } from '../interfaz/llegadas'

/**
 * Cuántas publicaciones de su topic hay que perder antes de decir nada.
 *
 * 🔴 **Tres, y no una.** Con una sola, un robot recién conectado —o uno cuya
 *    primera batería aún no ha llegado— saldría marcado a los 30 s de nada. Con
 *    tres hay 90 s de margen, que sobre un fenómeno que en la evidencia 129 duró
 *    **quince minutos** no pierde nada y evita el falso positivo.
 *
 * ⚠️ Es una elección, no una medida: el fenómeno se ha visto UNA vez y no hay
 *    con qué calibrar. Se dice así.
 */
export const MENSAJES_PERDIDOS_PARA_SOSPECHAR = 3

/** El topic cuya ausencia delata el cuelgue: es el que viene del RVR de verdad. */
export const TOPIC_TESTIGO = '/battery_state'

/**
 * El umbral en milisegundos, **derivado** del ritmo medido de su propio topic.
 *
 * 📝 Se calcula, no se escribe: así el día que `/battery_state` cambie de ritmo
 *    en `RITMO_MEDIDO_HZ`, esto se mueve solo. Un número a mano aquí sería la
 *    tercera copia del mismo dato.
 */
export const UMBRAL_TELEMETRIA_VIEJA_MS =
  (MENSAJES_PERDIDOS_PARA_SOSPECHAR / RITMO_MEDIDO_HZ[TOPIC_TESTIGO]) * 1000

export interface EntradaCuelgue {
  /** ¿La baldosa considera vivo el latido? Sale de `/motor_status`. */
  latidoVivo: boolean
  /** Desde el último `/battery_state`. `null` = no ha llegado ninguno. */
  msDesdeTestigo: number | null
}

/**
 * ¿Hay motivo para sospechar un cuelgue parcial del firmware?
 *
 * 🔴 **Solo cuando el latido está VIVO.** Con el latido caído ya hay un aviso
 *    —«sin señal de vida»— y añadir otro sería decir dos veces lo mismo; peor,
 *    taparía el diagnóstico bueno con uno peor fundado.
 *
 * 🔴 Y `null` **no** dispara: que no haya llegado ninguna batería todavía es el
 *    estado normal de los primeros 30 s de cualquier conexión. Confundir «aún no
 *    ha llegado» con «dejó de llegar» es el error que este proyecto arrastra
 *    desde `antiguedad_atasco_s = -1`.
 */
export function hayCuelgueParcial(e: EntradaCuelgue): boolean {
  if (!e.latidoVivo) return false
  if (e.msDesdeTestigo === null) return false
  return e.msDesdeTestigo > UMBRAL_TELEMETRIA_VIEJA_MS
}

/**
 * Qué decirle a quien lo esté mirando.
 *
 * ⚠️ **Es una SOSPECHA y se dice así.** El cuelgue parcial se ha visto una vez;
 *    lo mismo lo produce un WiFi con un mal rato. Lo que sí está medido es el
 *    remedio —el botón del RVR, y la Pi se reanuda sola— y el discriminador: si
 *    un servicio de infrarrojos contesta mientras la telemetría calla, es el
 *    firmware a medias y no la red.
 */
export const FRASE_CUELGUE_PARCIAL =
  'Este robot responde pero sus medidas están viejas. Puede ser un mal rato de la red, o el '
  + 'cuelgue parcial del RVR visto el 17 de agosto de 2026: el procesador que manda la telemetría '
  + 'calla mientras el otro sigue contestando. Se distingue pidiéndole algo de infrarrojos —si '
  + 'contesta, es el firmware— y se arregla apagando y encendiendo el RVR con su botón.'
