'use client'

/**
 * Suscripcion TIPADA a un topic del robot, con baja de verdad al desmontar.
 *
 * 🔴 DOS COSAS QUE ESTE HOOK NO PUEDE HACER MAL:
 *
 * 1. **Un topic fuera de la lista blanca se RECHAZA nombrandolo**, y se rechaza
 *    en el render -no dentro del efecto-. Si se dejara para el efecto, el error
 *    aparece un tick despues, lejos de la linea que lo causo, y sobre un
 *    componente ya montado. rosbridge, ademas, **deniega en silencio**: no manda
 *    `status` por el socket (verificado en su fuente), asi que si esto no lanza
 *    aqui, el sintoma es «ese topic no llega» y se busca en el robot.
 *
 * 2. **La limpieza da de baja de verdad.** `Transporte.suscribir()` devuelve la
 *    funcion de baja y esa funcion manda `unsubscribe` AL ROBOT cuando se va el
 *    ultimo oyente. Olvidarla no es una fuga de memoria: es `/scan` -el 83 % del
 *    trafico de un robot- llegando para siempre, y volviendo a pedirse en cada
 *    reconexion.
 */

import { useEffect, useState } from 'react'
import { permitidoSuscribir } from '../lib/rosbridge/contrato'
import { Transporte } from '../lib/rosbridge/transporte'

/** `std_msgs/msg/Header`, tal y como lo serializa rosbridge. */
export interface Cabecera {
  stamp: { sec: number; nanosec: number }
  frame_id: string
}

/**
 * `sensor_msgs/msg/BatteryState`.
 *
 * 🔴 `voltage` es la señal autoritativa, y lo dice el propio driver: el
 * `percentage` marco **100 % con la bateria a 8,29 V**, a 1,29 V del umbral de
 * «baja» del firmware. Y `percentage` es una FRACCION 0-1, no un porcentaje:
 * `0.34` son 34 %. Los dos campos pueden llegar como `NaN` -el driver los pone
 * asi a proposito cuando la lectura falla, porque 0.0 V es un dato y no un hueco.
 */
export interface MensajeBateria {
  header: Cabecera
  voltage: number
  current: number
  temperature: number
  charge: number
  capacity: number
  design_capacity: number
  percentage: number
  power_supply_status: number
  power_supply_health: number
  power_supply_technology: number
  present: boolean
}

/**
 * `atriz_rvr_msgs/msg/MotorStatus`. Los nombres salen del `.msg` real del
 * repositorio del robot, no de una suposicion.
 *
 * 🔴 `antiguedad_*_s = -1.0` significa **nunca se ha sabido nada de eso**, no
 * «hace cero segundos». Sin esa distincion, «todo a false» seria indistinguible
 * de «nadie ha dicho nada todavia». Se interpreta con `interpretarAntiguedad()`.
 *
 * ⚠️ `estado_termico_*` se publica EN CRUDO: 0 es normal y el resto de valores
 * los define el RVR, y este proyecto no los ha caracterizado. No les inventes un
 * significado.
 */
export interface MensajeEstadoMotor {
  header: Cabecera
  atascado_izquierdo: boolean
  atascado_derecho: boolean
  fallo: boolean
  temperatura_izquierdo: number
  temperatura_derecho: number
  estado_termico_izquierdo: number
  estado_termico_derecho: number
  antiguedad_atasco_s: number
  antiguedad_fallo_s: number
  antiguedad_termico_s: number
}

export interface Vector3 { x: number; y: number; z: number }
export interface Cuaternion { x: number; y: number; z: number; w: number }

/** `nav_msgs/msg/Odometry`. Se publica BEST_EFFORT a ~16,5 Hz. */
export interface MensajeOdometria {
  header: Cabecera
  child_frame_id: string
  pose: { pose: { position: Vector3; orientation: Cuaternion }; covariance: number[] }
  twist: { twist: { linear: Vector3; angular: Vector3 }; covariance: number[] }
}

/**
 * `atriz_rvr_msgs/msg/Encoder`. 🔴 `Encoder`, SINGULAR: `Encoders.msg` no existe,
 * y un tipo mal escrito da `InvalidClassException` en rosbridge con el sintoma
 * «ese topic no llega».
 */
export interface MensajeEncoder {
  left_wheel_count: number
  right_wheel_count: number
}

/**
 * Los topics que esta web MODELA. Es a proposito un subconjunto de
 * `TOPICS_LECTURA`: modelar un topic significa haber leido su `.msg` y saber
 * que campos trae. Los que faltan (`/scan`, `/map`, `/tf`, `/color`,
 * `/amcl_pose`, `/collision_monitor_state`, `/imu`) estan permitidos por el
 * robot pero **no tienen tipo aqui todavia**, y añadirlos exige leer su
 * definicion, no adivinarla.
 */
export interface MensajesPorTopic {
  '/battery_state': MensajeBateria
  '/motor_status': MensajeEstadoMotor
  '/odom': MensajeOdometria
  '/encoders': MensajeEncoder
}

export type TopicModelado = keyof MensajesPorTopic

/**
 * Rechaza un topic que el robot no autoriza, **nombrandolo**. Acepta `string` y
 * no `TopicModelado` a proposito: el tipo protege en compilacion, pero un topic
 * puede llegar de un dato en ejecucion, y ahi hace falta esta comprobacion.
 */
export function exigirTopicPermitido(topic: string): void {
  if (!permitidoSuscribir(topic)) {
    throw new Error(
      `«${topic}» no esta en la lista blanca de lectura del robot (contrato.ts, espejo de ` +
        'robot.launch.py): useTopic() NO se suscribe. rosbridge denegaria en silencio y el sintoma ' +
        'seria «ese topic no llega». Si de verdad hace falta, se amplia EN EL ROBOT, no aqui.',
    )
  }
}

/**
 * EL CUERPO DEL EFECTO, sin React: valida, se suscribe y devuelve la baja.
 *
 * 📝 El `as` sobre el mensaje es una asercion, no una comprobacion, y conviene
 * saberlo: rosbridge entrega lo que le da el robot serializado segun el `type`
 * que se pidio en el `subscribe` (`tipoObligatorio()` garantiza que ese `type`
 * viaja), asi que la forma la sostiene el contrato con el robot, **no una
 * validacion en el cliente**. No hay validador de esquema aqui: seria codigo
 * nuevo sin nada medido detras, y el proyecto ya tiene `comprobar_contrato.mjs`
 * vigilando justo esa junta.
 */
export function suscribirTopic<K extends TopicModelado>(
  transporte: Transporte,
  topic: K,
  alMensaje: (m: MensajesPorTopic[K]) => void,
): () => void {
  exigirTopicPermitido(topic)
  return transporte.suscribir(topic, (m) => alMensaje(m as MensajesPorTopic[K]))
}

/** `null` hasta que llegue el primer mensaje. `null` NO es «no hay dato bueno». */
export function useTopic<K extends TopicModelado>(
  transporte: Transporte,
  topic: K,
): MensajesPorTopic[K] | null {
  // En el render, no en el efecto: el error sale en la linea que lo causo.
  exigirTopicPermitido(topic)

  const [mensaje, setMensaje] = useState<MensajesPorTopic[K] | null>(null)

  useEffect(() => {
    setMensaje(null)   // al cambiar de robot o de topic, lo anterior ya no vale
    return suscribirTopic(transporte, topic, (m) => setMensaje(m))
  }, [transporte, topic])

  return mensaje
}
