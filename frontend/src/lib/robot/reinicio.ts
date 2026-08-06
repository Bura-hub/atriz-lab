/**
 * DETECTAR QUE EL DRIVER SE HA REINICIADO. Puro, sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ HACE FALTA: EL ROBOT SE VE SANO Y HA PERDIDO DOS COSAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Medido el 2026-08-06, poniendo el RVR a cargar con la Raspberry Pi viva:
 *
 *     /odom          95 msg en 6 s     ✅   /scan     0     🔴
 *     /estado_robot   7 msg en 6 s     ✅   /map      0     🔴
 *     rvr_responde: true, muestra de hace 0,021 s
 *
 * El RVR se apagó y encendió, el driver murió, systemd lo reinició — y con él
 * volvió el barrido a su estado de reposo (apagado) y el origen de la odometría
 * a cero. `slam_toolbox`, que corría aparte, sobrevivió **vivo y mudo**: se queda
 * con un hueco en su búfer TF y deja de procesar.
 *
 * Nada de eso se ve en los indicadores habituales. Todos dicen que el robot está
 * bien, y lo está: lo que se ha perdido es el ESTADO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EL TESTIGO: EL `latido` RETROCEDE
 * ═══════════════════════════════════════════════════════════════════════════
 * `/estado_robot.latido` es un contador que **arranca de cero con el driver**.
 * Así que un latido MENOR que el anterior es prueba directa de un reinicio, sin
 * preguntarle nada a nadie y sin tocar el robot.
 *
 * Es el mismo mecanismo que usa la liberación de la parada de emergencia para
 * saber si un mensaje es posterior a su llamada.
 *
 * ⚠️ Lo que NO detecta: un reinicio tan rápido que el latido vuelva a pasar por
 *    encima del anterior antes de que llegue ningún mensaje. A 1 Hz de
 *    republicado eso exigiría no recibir nada durante el reinicio entero y
 *    reaparecer ya por delante — posible con la pestaña en segundo plano. Por
 *    eso esto es un AVISO y no una garantía, y la pantalla no afirma «no ha
 *    habido reinicios», solo señala los que ve.
 */

export interface EstadoReinicio {
  /** El último latido visto. `null` = todavía no ha llegado ninguno. */
  latidoPrevio: number | null
  /** Cuántos reinicios se han visto desde que se abrió la pantalla. */
  reinicios: number
  /** Instante del último reinicio detectado, en ms. `null` = ninguno. */
  ultimo: number | null
}

export const SIN_REINICIOS: EstadoReinicio = { latidoPrevio: null, reinicios: 0, ultimo: null }

/**
 * Un latido nuevo. Devuelve el estado siguiente.
 *
 * 🔴 EL PRIMER LATIDO NUNCA ES UN REINICIO, aunque valga 3. Sin referencia
 *    anterior no hay nada con que compararlo, y tratarlo como reinicio haría que
 *    **abrir la pantalla** —o reconectar— avisara de un reinicio que no ha
 *    ocurrido. Un aviso que salta solo se aprende a ignorar, y entonces no sirve
 *    el día que importa.
 *
 * ⚠️ Un latido REPETIDO tampoco lo es: el driver republica su estado a 1 Hz y el
 *    mismo valor puede llegar dos veces. Solo cuenta `ahora < previo`,
 *    estrictamente.
 */
export function trasLatido(e: EstadoReinicio, latido: number, cuando: number): EstadoReinicio {
  // Un valor roto no decide nada: se ignora entero, no se toma como referencia.
  // Si no, un NaN se quedaría de `latidoPrevio` y toda comparación posterior
  // daría `false` — el detector apagado en silencio.
  if (!Number.isFinite(latido)) return e

  if (e.latidoPrevio === null) return { ...e, latidoPrevio: latido }
  if (latido < e.latidoPrevio) {
    return { latidoPrevio: latido, reinicios: e.reinicios + 1, ultimo: cuando }
  }
  return { ...e, latidoPrevio: latido }
}
