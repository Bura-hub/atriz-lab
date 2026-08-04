/**
 * Como se lee un mensaje del robot SIN dar por hecho que trae lo que promete.
 * PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL `as` DE `useTopic` ES UNA ASERCION, NO UNA VALIDACION
 * ═══════════════════════════════════════════════════════════════════════════
 * `suscribirTopic()` hace `alMensaje(m as MensajesPorTopic[K])`. Eso convence al
 * compilador y **no comprueba nada en ejecucion**: la forma la sostiene el
 * contrato con el robot (el `type` que viaja en el `subscribe`), no un validador
 * en el cliente. Un `.msg` que cambie, un robot con otra version, o un tipo mal
 * escrito, entregan un objeto con otra forma y nadie lo detiene.
 *
 * → Consecuencia practica: **un campo cuyo tipo dice `number` puede llegar
 *   `undefined`**, y `x.toFixed(2)` sobre eso revienta el render entero. Por eso
 *   las interfaces de abajo declaran TODOS los campos opcionales aunque los
 *   `.msg` reales no lo sean: es la forma de obligar a comprobarlos.
 *
 * → Y la regla que sale de ahi: **la ausencia de un dato no es un cero**. Cuando
 *   falta, estas funciones devuelven `null`, que la interfaz escribe como «no se
 *   sabe».
 */

import { interpretarAntiguedad } from '../rosbridge/contrato'
import { EntradaBaldosa } from '../flota/resumen'

/**
 * Lo que la interfaz lee de `sensor_msgs/msg/BatteryState`. PARCIAL a proposito
 * (ver la cabecera). Un `MensajeBateria` completo encaja aqui por estructura.
 */
export interface LecturaBateria {
  /** 🔴 La señal autoritativa. El driver publica `NaN` cuando la lectura falla. */
  voltage?: number
  /** ⚠️ FRACCION 0-1, no un porcentaje. Y dijo «100 %» con la bateria a 8,29 V. */
  percentage?: number
}

/** Lo que la interfaz lee de `atriz_rvr_msgs/msg/MotorStatus`. PARCIAL a proposito. */
export interface LecturaMotores {
  atascado_izquierdo?: boolean
  atascado_derecho?: boolean
  fallo?: boolean
  temperatura_izquierdo?: number
  temperatura_derecho?: number
  estado_termico_izquierdo?: number
  estado_termico_derecho?: number
  antiguedad_atasco_s?: number
  antiguedad_fallo_s?: number
  antiguedad_termico_s?: number
}

/** Un numero, o `null` si no lo hay o no es finito. La puerta por la que pasa todo. */
export function numeroValido(v: number | undefined | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Un booleano, o `null` si el campo no vino. 🔴 `undefined` NO se colapsa a `false`. */
export function booleanoValido(v: boolean | undefined | null): boolean | null {
  return typeof v === 'boolean' ? v : null
}

/** Los voltios de `/battery_state`, o `null`. NUNCA el `percentage`. */
export function voltajeDe(m: LecturaBateria | null | undefined): number | null {
  return numeroValido(m?.voltage)
}

/**
 * `percentage` como porcentaje 0-100, SOLO para enseñarlo como dato secundario
 * y explicado. 🔴 No se usa para decidir nada: dijo 100 % a 8,29 V, a 1,29 V del
 * umbral de «baja» del propio firmware.
 */
export function porcentajeDe(m: LecturaBateria | null | undefined): number | null {
  const f = numeroValido(m?.percentage)
  return f === null ? null : f * 100
}

/**
 * ¿Hay un atasco? `true` · `false` · **`null` = no se sabe**, que no es lo mismo
 * que `false`.
 *
 * 🔴 El `null` sale de `antiguedad_atasco_s`, no de las banderas. El atasco solo
 * existe por NOTIFICACION del firmware -el SDK no tiene `get_motor_stall_state`,
 * asi que no se puede sondear-, y mientras no haya llegado ninguna desde que
 * arranco el driver el campo vale **-1.0: «nunca se ha sabido nada»**. En ese
 * estado las dos banderas valen `false` porque es su valor INICIAL, no porque
 * nadie haya comprobado nada. Leerlas como «no hay atasco» es exactamente la
 * falsa tranquilidad que el propio `.msg` del robot documenta haber pagado ya.
 */
export function atascoDe(m: LecturaMotores | null | undefined): boolean | null {
  if (m === null || m === undefined) return null
  if (!interpretarAntiguedad(numeroValido(m.antiguedad_atasco_s) ?? -1).conocido) return null
  const izq = booleanoValido(m.atascado_izquierdo)
  const der = booleanoValido(m.atascado_derecho)
  if (izq === null && der === null) return null
  return izq === true || der === true
}

/**
 * Lo mismo para el fallo electrico, que SI se sondea cada 30 s: ahi la
 * antiguedad es real y `false` significa «se comprobo y no hay».
 */
export function falloDe(m: LecturaMotores | null | undefined): boolean | null {
  if (m === null || m === undefined) return null
  if (!interpretarAntiguedad(numeroValido(m.antiguedad_fallo_s) ?? -1).conocido) return null
  return booleanoValido(m.fallo)
}

/**
 * Arma la entrada de una baldosa del muro a partir de lo que llego por el cable.
 *
 * 🔴 `msDesdeUltimoLatido` tiene que venir de **`/motor_status`**, y no de
 * cualquier topic: `UMBRAL_LATIDO_MURO_MS` (5000) esta calculado como CINCO
 * periodos de ese topic, que va a 1 Hz. Con `/battery_state` (cada 30,0 s) el
 * umbral seria absurdo y las 16 baldosas dirian «sin señal de vida» todo el
 * rato. `resumirBaldosa` no puede comprobarlo -es responsabilidad de quien arma
 * la entrada, o sea de esta funcion, y por eso el parametro se llama asi.
 */
export function entradaDeBaldosa(datos: {
  id: number
  conectado: boolean
  bateria: LecturaBateria | null
  motores: LecturaMotores | null
  msDesdeUltimoMotorStatus: number | null
}): EntradaBaldosa {
  return {
    id: datos.id,
    conectado: datos.conectado,
    voltios: voltajeDe(datos.bateria),
    antiguedadTermicoS: numeroValido(datos.motores?.antiguedad_termico_s),
    atascado: atascoDe(datos.motores),
    msDesdeUltimoLatido: datos.msDesdeUltimoMotorStatus,
  }
}

/**
 * La respuesta de un servicio, leida sin dar nada por hecho. `Transporte.llamar()`
 * resuelve con `unknown` -es lo que mando el robot, sin tipar.
 *
 * ⚠️ Que `success` sea `true` NO significa que el efecto fisico ocurriera: ver
 * `confirmaEfecto()` en `contrato.ts` y `textoDeConfirmacion()` en `lenguaje.ts`.
 * Esta funcion solo LEE el campo; interpretarlo es de aquellas.
 */
export function leerRespuestaServicio(v: unknown): { success: boolean | null; message: string | null } {
  if (typeof v !== 'object' || v === null) return { success: null, message: null }
  const r = v as { success?: unknown; message?: unknown }
  return {
    success: typeof r.success === 'boolean' ? r.success : null,
    message: typeof r.message === 'string' && r.message.length > 0 ? r.message : null,
  }
}
