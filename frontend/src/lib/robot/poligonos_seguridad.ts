/**
 * LOS POLÍGONOS DEL `collision_monitor`, EN METROS. PURO: sin React ni canvas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTA ES LA CAUSA Nº1 DE «EL ROBOT NO OBEDECE», Y NO SE DIBUJABA
 * ═══════════════════════════════════════════════════════════════════════════
 * La capa de seguridad del robot no es una alarma: **recorta el mando antes de
 * que llegue a los motores**, y lo hace en silencio. Las dos formas medidas:
 *
 *   · `avanzar(0.20, 3)` pidió 60 cm y el robot hizo **26,4** una vez y **59,5**
 *     la siguiente, sin tocar nada. El journal lo explicaba —«Robot to slowdown
 *     for 40.000000 percents due to Precaucion polygon»— y el alumno no ve el
 *     journal: pide 60 cm, obtiene 26, y no recibe ningún mensaje.
 *   · Con algo dentro del círculo de aproximación el robot queda **inmóvil por
 *     completo**: avanzar alejándose 0,0 cm, girar 0,0°, retroceder 0,0 cm.
 *
 * Y hasta hoy estas dos zonas solo existían **como texto en otras dos
 * pantallas**. En la única que dibuja lo que el robot ve, no estaban.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 UN POLÍGONO NO SABE HACIA DÓNDE VAS
 * ═══════════════════════════════════════════════════════════════════════════
 * `Precaucion` es un rectángulo **estático**. Medido el 2026-08-02: un retroceso
 * de 2 s a 0,15 m/s —30 cm esperados— hizo **14**, porque la pared seguía dentro
 * del rectángulo aunque el robot se estuviera **alejando** de ella. No es un
 * fallo: es cómo funciona un polígono estático. Pero explica por qué «le cuesta
 * salir de un rincón», y por eso la pantalla lo dibuja en vez de contarlo.
 *
 * ⚠️ Todos estos números salen de `collision_monitor.yaml` del robot, **no de un
 *    topic**. Si alguien edita ese fichero, esto miente hasta que se actualice.
 *    Y `Aproximacion.radius` **es inerte en caliente**: `ros2 param set` lo
 *    acepta y el monitor no reconstruye el polígono, así que cambiarlo exige
 *    editar el YAML y reiniciar — es un cambio de imagen dorada, no un botón.
 */

import { Punto } from '../interfaz/barrido'

/**
 * El círculo de `Aproximacion`. **0,15 m desde el 2026-08-09**, bajado desde
 * 0,18 con todo medido.
 *
 * 🔴 LA SIMETRÍA QUE FIJA ESTE NÚMERO, y es lo que impide bajarlo más:
 *    `banda de inmovilización` = `margen ante el error del LIDAR` =
 *    `radius − 0,1442`. Son el MISMO número, así que no se puede encoger uno sin
 *    el otro.
 *
 *      radius   banda de trampa   hueco al parar a 0,40 m/s
 *       0.18         3,6 cm             10,9 cm
 *       0.15         0,6 cm              7,4 / 6,6 cm      <- el actual
 *       0.145        0,1 cm             (sin medir)        <- por debajo del ruido
 *
 *    Con 0.145 el margen queda por debajo del ruido MEDIDO del LIDAR (±0,3 cm):
 *    autorizaría a girar cuando el robot no cabe.
 */
export const APROXIMACION_RADIO_M = 0.15

/**
 * El rectángulo de `Precaucion`, tal cual está en el YAML:
 * `[[0.36, 0.20], [0.36, -0.20], [-0.24, -0.20], [-0.24, 0.20]]`.
 *
 * 🔴 ES MÁS ANCHO DE LO QUE PARECE: 60 cm de largo × **40 de ancho**. Con el
 *    robot midiendo 21,7 de ancho, **cualquier cosa a menos de ~9 cm de un
 *    costado** lo frena al 40 %, aunque se esté alejando de ella.
 */
export const PRECAUCION = { xMin: -0.24, xMax: 0.36, yMin: -0.20, yMax: 0.20 } as const

/** Lo que queda del mando dentro de `Precaucion`: el 40 %. */
export const PRECAUCION_RATIO = 0.4

/**
 * Cuántos puntos necesita el monitor para creerse un obstáculo (`min_points`).
 *
 * 🔴🔴 SON DOS NÚMEROS DISTINTOS, Y ESTE FICHERO NACIÓ CON UNO SOLO.
 * ═══════════════════════════════════════════════════════════════════════════
 * Puse `MIN_PUNTOS = 2` para los dos polígonos porque es el valor que aparece
 * citado en la documentación. En el YAML del robot:
 *
 *     collision_monitor.yaml:316   Aproximacion  min_points: 2
 *     collision_monitor.yaml:340   Precaucion    min_points: 4
 *
 * Con el 2 en los dos, esta pantalla anunciaba **«FRENA» con 2 o 3 puntos**
 * dentro del rectángulo, cuando el robot necesita 4. Falla del lado prudente —
 * avisa de más, no de menos— y aun así es una cifra de la interfaz que no
 * coincide con el fichero del que dice salir. Es la deriva que este proyecto
 * persigue, cometida en un fichero escrito para cerrar otra deriva.
 *
 * 📌 Lo cazó un agente leyendo el YAML, no yo escribiéndolo: **había citado la
 *    fuente sin abrirla.**
 *
 * ⚠️ Y el 2 de `Aproximacion` es deliberadamente sensible; su propio comentario
 *    lo dice: *«una parada de más molesta, una de menos choca»*. No hay que
 *    igualarlos.
 *
 * ⚠️ Los dos salen del YAML, no de una medida. Y hay un motivo para no fiarse
 *    del todo: el X2 tira un rayo cada 1,7 cm a 0,68 m, así que **un objeto fino
 *    de 5 cm da 2-3 puntos y en un barrido suelto puede desaparecer** — con
 *    `Precaucion` en 4, ese objeto no frena al robot.
 */
export const MIN_PUNTOS_APROXIMACION = 2
export const MIN_PUNTOS_PRECAUCION = 4

/**
 * El punto ciego del LIDAR: `range_min`.
 *
 * 🔴 SOBRESALE DEL CHASIS POR DELANTE Y POR DETRÁS, ~1 cm que **ningún polígono
 *    cubre**. La media longitud del robot es 0,090 y `range_min` vale 0,100. El
 *    manual afirmaba lo contrario —«cae dentro del chasis, no hay zona muerta»—
 *    con los números correctos y la conclusión mala.
 *
 * ⚠️ Se centra en el LIDAR, no en el robot: por eso el dibujo lo desplaza
 *    `LASER_X`. Son 5 mm, por debajo de un píxel a esta escala, y se hace igual
 *    porque el fichero que lo omitiera acabaría copiado a otra escala.
 */
export const RANGE_MIN_M = 0.10

/** Cuántos puntos del barrido caen dentro de cada zona. */
export interface Invasion {
  aproximacion: number
  precaucion: number
}

/**
 * @param puntos en el marco del ROBOT — `puntosDelBarrido()` ya suma `LASER_X`,
 *               así que llegan en `base_footprint` y se comparan directamente.
 */
export function contarInvasiones(puntos: readonly Punto[]): Invasion {
  let aproximacion = 0
  let precaucion = 0
  for (const p of puntos) {
    // 🔴 `isFinite` antes de comparar: un `NaN` hace falsas TODAS las
    //    comparaciones, así que un barrido con huecos contaría cero invasiones
    //    y la pantalla diría «nada dentro» sobre un robot bloqueado. Es la forma
    //    de `limitar(nan)`, que devolvía el tope de velocidad.
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    if (Math.hypot(p.x, p.y) <= APROXIMACION_RADIO_M) aproximacion++
    if (p.x >= PRECAUCION.xMin && p.x <= PRECAUCION.xMax
      && p.y >= PRECAUCION.yMin && p.y <= PRECAUCION.yMax) precaucion++
  }
  return { aproximacion, precaucion }
}

/**
 * Qué le está haciendo la capa de seguridad al mando, **según el barrido**.
 *
 * 🔴 ES UNA DEDUCCIÓN, NO UNA MEDIDA, y la pantalla tiene que decirlo así. Lo
 *    que de verdad hace el monitor lo publica `/collision_monitor_state`; esto
 *    reconstruye la misma cuenta desde `/scan` para poder DIBUJARLA. Coinciden
 *    salvo en los bordes —`min_points`, el instante exacto del barrido— y ahí
 *    manda el topic.
 */
export type Efecto = 'INMOVIL' | 'FRENA' | 'NADA'

export function efectoDe(inv: Invasion): Efecto {
  // 🔴 EL ORDEN ES LA PRECEDENCIA: inmóvil gana. Un robot con algo dentro del
  //    círculo tiene además cosas dentro del rectángulo —el círculo cabe entero
  //    en él—, y decir «frena al 40 %» de un robot que no se mueve en absoluto
  //    mandaría a buscar la avería al sitio equivocado.
  if (inv.aproximacion >= MIN_PUNTOS_APROXIMACION) return 'INMOVIL'
  if (inv.precaucion >= MIN_PUNTOS_PRECAUCION) return 'FRENA'
  return 'NADA'
}

/**
 * La frase que se lee con el robot delante. Corta: si crece, ha vuelto el
 * párrafo — y hay una prueba con techo, como en el desenlace de Navegar.
 */
export const TECHO_FRASE = 150

export function fraseDe(efecto: Efecto): string {
  switch (efecto) {
    case 'INMOVIL':
      // La parte que NADIE espera: ni siquiera puede alejarse.
      return 'Hay algo dentro del círculo: el robot no se moverá, ni siquiera para alejarse. Quítalo o apártalo a mano.'
    case 'FRENA':
      return 'Hay algo en el rectángulo: el robot irá al 40 %, también si se aleja. Pedirle 60 cm puede dar 26.'
    default:
      return 'Nada dentro de las dos zonas. Si aun así no se mueve, la causa es otra.'
  }
}
