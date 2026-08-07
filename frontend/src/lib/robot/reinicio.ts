/**
 * DETECTAR QUE EL ROBOT SE HA REINICIADO POR DEBAJO. Puro, sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA CAUSA, MEDIDA: APAGAR EL RVR REINICIA LA RASPBERRY PI ENTERA
 * ═══════════════════════════════════════════════════════════════════════════
 * La Pi se alimenta del **USB del RVR**, así que ponerlo a cargar la tumba.
 * Confirmado el 2026-08-06 con las cabeceras de arranque del journal:
 *
 *     arranque -1 termina 15:09:03  →  arranque 0 empieza 16:17:06
 *
 * Y lo que se pierde en ese hueco es **estado**, no salud: vuelve `atriz-robot`
 * y nada más. El barrido queda **apagado** —lo fuerza el `ExecStartPost` en cada
 * arranque—, el origen de la odometría vuelve a cero, la **parada de emergencia
 * baja sola**, y un `slam_toolbox` lanzado a mano por SSH se muere con la sesión.
 *
 * ⚠️ **Una versión anterior de este fichero decía «el driver murió, systemd lo
 *    reinició» como si fuera un hecho.** Era una deducción a partir de que el
 *    barrido estuviera apagado, y era **falsa**: no se reinició el driver, se
 *    reinició la máquina. La corrección vino de mirar el índice de arranques —el
 *    contenido del journal ya se había rotado, pero las cabeceras bastaban.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y ESO CAMBIA DÓNDE SE PUEDE OBSERVAR: **NO DENTRO DE UNA CONEXIÓN VIVA**
 * ═══════════════════════════════════════════════════════════════════════════
 * `rosbridge` es un nodo **del mismo launch que el driver** (`robot.launch.py`).
 * Así que cualquier cosa que se lleve al driver —un reinicio de la unidad, o de
 * la Pi entera— **se lleva también el WebSocket**. El latido no «retrocede ante
 * tus ojos»: el socket se cae, y más tarde vuelve con un latido bajo.
 *
 * → Por eso este estado **tiene que sobrevivir a la reconexión**. La comparación
 *   útil es «el último latido de ANTES de la caída» contra «el primero de
 *   DESPUÉS». `Transporte` reconecta con espera creciente y vuelve a suscribirse
 *   con el mismo objeto, así que colgar este estado **del `Transporte`** —y no
 *   del componente que lo pinta— es lo que hace que funcione.
 *
 * 🔴 Y NO del marco del robot: `MarcoRobot` renderiza `ProveedorRobot` **sin
 *    `key`**, así que cambiar de robot **no desmonta nada** —React reconcilia—.
 *    El latido del robot 1 se compararía con el del robot 2 y la pantalla
 *    anunciaría un reinicio que no ocurrió, en el robot equivocado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EL TESTIGO: EL `latido` RETROCEDE
 * ═══════════════════════════════════════════════════════════════════════════
 * `/estado_robot.latido` es un contador que **arranca de cero con el driver**.
 * Un latido menor que el anterior es prueba directa de que hubo reinicio, sin
 * preguntarle nada a nadie y sin tocar el robot.
 *
 * ⚠️ Lo que NO detecta, y hay que saberlo antes de fiarse:
 *   · una caída del enlace **sin** reinicio (WiFi) — el latido sigue subiendo;
 *   · un reinicio del que no llegue a verse ningún mensaje anterior;
 *   · dos reinicios seguidos entre dos mensajes: se cuenta uno.
 * Por eso esto es un AVISO de lo que se ve, y la pantalla no puede decir «no ha
 * habido reinicios».
 */

export interface EstadoReinicio {
  /** El último latido visto. `null` = todavía no ha llegado ninguno. */
  latidoPrevio: number | null
  /** Cuántos reinicios se han visto con este `Transporte`. */
  reinicios: number
  /** Instante del último reinicio detectado, en ms. `null` = ninguno. */
  ultimo: number | null
}

export const SIN_REINICIOS: EstadoReinicio = { latidoPrevio: null, reinicios: 0, ultimo: null }

/**
 * Un latido nuevo. Devuelve el estado siguiente.
 *
 * 🔴 EL PRIMER LATIDO NUNCA ES UN REINICIO, aunque valga 3. Sin referencia
 *    anterior no hay con qué compararlo, y tratarlo como reinicio haría que
 *    **abrir la pantalla** avisara de uno que no ha ocurrido. Un aviso que salta
 *    solo se aprende a ignorar, y entonces no sirve el día que importa.
 *
 * ⚠️ Un latido REPETIDO tampoco lo es: el driver republica su estado a 1 Hz y el
 *    mismo valor puede llegar dos veces. Solo cuenta `ahora < previo`,
 *    estrictamente.
 *
 * 🔴 UN VALOR NO FINITO SE IGNORA ENTERO, y no se toma como referencia. Si se
 *    guardara, toda comparación posterior daría `false` y el detector quedaría
 *    **apagado en silencio** — el mismo modo de fallo que existe para detectar.
 *    Importa de verdad: `latido` es `uint64` en `EstadoRobot.msg`, y si alguna
 *    capa lo entregara como cadena, `Number.isFinite` diría `false`.
 */
export function trasLatido(e: EstadoReinicio, latido: number, cuando: number): EstadoReinicio {
  if (!Number.isFinite(latido)) return e

  if (e.latidoPrevio === null) return { ...e, latidoPrevio: latido }
  if (latido < e.latidoPrevio) {
    return { latidoPrevio: latido, reinicios: e.reinicios + 1, ultimo: cuando }
  }
  return { ...e, latidoPrevio: latido }
}

/**
 * Lo que se ha perdido en el reinicio. **Son CUATRO, y la primera es de
 * seguridad.**
 *
 * 🔴 La parada de emergencia **baja sola** al reiniciarse el driver, y la web
 *    **no la vuelve a publicar al reconectar** —está escrito a propósito en
 *    `transporte.ts`—. O sea que nadie la repone. Va la primera por eso.
 *
 * 📝 No se calcula «hace ~N s» a partir del latido, y no es pereza: entre el
 *    reinicio y el primer latido hay `RestartSec=15`, hasta 60 s de espera de
 *    udev, ~10 s de launch y hasta 30 s de `ExecStartPost`. El error es
 *    **monótono y siempre hacia abajo** — siempre diría «acaba de pasar».
 */
export const PERDIDAS_TRAS_REINICIO: readonly string[] = [
  'La parada de emergencia ha bajado sola, y nadie la repone al reconectar.',
  'El barrido del LIDAR está apagado: sin él, el robot no se mueve.',
  'El origen de la odometría ha vuelto a cero.',
  'Si estabas mapeando, SLAM se ha perdido: no vuelve solo.',
]
