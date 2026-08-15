/**
 * DECIRLE AL ROBOT DÓNDE ESTÁ: el mensaje de `/initialpose`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ HACE FALTA, Y NO ES UNA COMODIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * AMCL arranca en (0,0) por su `set_initial_pose: true`. Si el robot no está
 * físicamente en el origen del mapa, **todo lo que venga después está
 * desplazado** — y Nav2 dirá `SUCCEEDED` igual, que es el peor fallo medido de
 * este proyecto: con un mapa que no era del sitio dio el objetivo por cumplido
 * **a 41,3 cm**, sin una línea de error en ningún log.
 *
 * Y no se puede resolver de otra manera: **este robot NO tiene rumbo absoluto**.
 * `magnetometer_calibrate_to_north()` se acepta sin error y es un no-op —
 * probado el 2026-08-01, el usuario mirando el robot—. Así que la pose de
 * partida **tiene que venir de fuera**: del operador. Con 16 robots sobre un
 * mismo mapa, esto es lo que hace posible «ve a la mesa 3».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL SELLO VA A CERO. NO ES UN DETALLE DE ESTILO
 * ═══════════════════════════════════════════════════════════════════════════
 * Con `now()`, AMCL **descarta el mensaje**: el sello iba 69 ms por delante de
 * lo último que tenía TF y lo rechazaba con «extrapolation into the future».
 * Pasó en **las 10 tandas de navegación de la historia del proyecto** sin que
 * nadie lo mirara: el banco creía fijar la pose y no la fijaba nunca.
 *
 * En tf2, sello `0` significa «usa la transformada más reciente», que es
 * exactamente lo que se quiere aquí. Evidencia 88.
 */

import { cuaternionDeYaw } from './mapa'

/**
 * Cuánto hay que arrastrar, en píxeles del canvas, para que el gesto defina un
 * rumbo.
 *
 * 🔴 NO SE PUEDE ASUMIR CERO SI NO SE ARRASTRA. Un rumbo equivocado es peor que
 *    ninguno: AMCL con 180° de error **no converge nunca**, y desde fuera eso
 *    se ve como «la navegación no funciona», que se busca en Nav2. Si el gesto
 *    es demasiado corto, esto se NIEGA a construir el mensaje — es la misma
 *    regla que «una rama por descarte necesita su propia condición de señal».
 */
export const ARRASTRE_MINIMO_PX = 12

/**
 * La covarianza que espera AMCL: 36 números (6×6), y solo importan tres.
 *
 * Son los valores que usa RViz en su «2D Pose Estimate», y se copian a
 * propósito en vez de inventarlos: 0,25 m² en x y en y (o sea ±0,5 m de
 * incertidumbre) y 0,0685 rad² en yaw (±15°). Le dicen a AMCL cuánto fiarse de
 * lo que acaba de recibir; con ceros se lo creería a ciegas y no repartiría
 * partículas para corregirse.
 */
export const COVARIANZA_POSE_INICIAL: readonly number[] = (() => {
  const c = new Array(36).fill(0)
  c[0] = 0.25          // x
  c[7] = 0.25          // y
  c[35] = 0.06853892   // yaw
  return c
})()

export interface PoseInicial {
  x: number
  y: number
  /** Radianes, medido como el resto del proyecto: antihorario desde +X. */
  yaw: number
}

/** El resultado de interpretar el gesto: o una pose, o por qué no la hay. */
export type LecturaDelGesto =
  | { hay: true; pose: PoseInicial }
  | { hay: false; motivo: string }

/**
 * Del arrastre sobre el canvas a una pose, o a una negativa con su motivo.
 *
 * @param desde  dónde se pulsó, en coordenadas del MUNDO
 * @param hasta  dónde se soltó, en coordenadas del MUNDO
 * @param arrastrePx  cuánto se arrastró en píxeles del canvas
 */
export function poseDelGesto(
  desde: { x: number; y: number },
  hasta: { x: number; y: number },
  arrastrePx: number,
): LecturaDelGesto {
  if (!Number.isFinite(desde.x) || !Number.isFinite(desde.y)
      || !Number.isFinite(hasta.x) || !Number.isFinite(hasta.y)) {
    return { hay: false, motivo: 'No he podido leer el punto del mapa.' }
  }
  if (!(arrastrePx >= ARRASTRE_MINIMO_PX)) {
    return {
      hay: false,
      motivo: 'Falta el rumbo: pulsa donde está el robot y **arrastra** hacia '
        + 'donde mira, sin soltar. Un rumbo equivocado es peor que ninguno — '
        + 'con 180° de error AMCL no converge nunca, y desde fuera parece que '
        + 'la navegación no funciona.',
    }
  }
  return {
    hay: true,
    pose: { x: desde.x, y: desde.y, yaw: Math.atan2(hasta.y - desde.y, hasta.x - desde.x) },
  }
}

/**
 * El mensaje de `/initialpose`, listo para publicar.
 *
 * 🔴 `stamp` a cero y `frame_id: 'map'`. Las dos cosas o no sirve: el sello por
 *    lo de arriba, y el marco porque una pose inicial en `odom` o en
 *    `base_link` no significa nada para AMCL.
 */
export function mensajePoseInicial(p: PoseInicial) {
  return {
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'map' },
    pose: {
      pose: {
        position: { x: p.x, y: p.y, z: 0 },
        orientation: cuaternionDeYaw(p.yaw),
      },
      covariance: [...COVARIANZA_POSE_INICIAL],
    },
  }
}

/**
 * Lo que la pantalla puede AFIRMAR tras publicar, que es menos de lo que
 * parece.
 *
 * 🔴 Publicar no es que AMCL lo acepte. `/initialpose` no tiene respuesta —es
 *    un topic, no un servicio— y `/amcl_pose` **no llega con el robot quieto**:
 *    AMCL solo publica tras moverse `update_min_d` (0,15 m). Así que justo
 *    después de fijar la pose **no hay forma de confirmarla**, y decir
 *    «fijada» sería afirmar lo que no se sabe.
 *
 * Lo que sí se puede decir es qué mirar para saberlo.
 */
export const LO_QUE_NO_SE_PUEDE_CONFIRMAR =
  'Se ha publicado, pero eso no es que AMCL la haya aceptado: `/initialpose` es '
  + 'un topic y no contesta, y `/amcl_pose` no llega con el robot quieto — solo '
  + 'publica tras moverse unos 15 cm. Mueve el robot un poco y mira si la pose '
  + 'que muestra el mapa cuadra con dónde está de verdad.'
