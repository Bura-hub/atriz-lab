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
 * `sensor_msgs/msg/Imu`.
 *
 * 🔴 SU `orientation` Y SU `angular_velocity` SON LOS MISMOS BITS QUE `/odom`.
 *    Medido contra rvr-01 el 2026-08-06, los dos topics a la vez: yaw −8,507°
 *    en los dos, giro z 8,127e−9 rad/s en los dos. El driver copia la misma
 *    fuente. Quien pinte esto tiene que saberlo: enseñar los dos como si fueran
 *    medidas independientes es afirmar que hay dos testigos donde hay uno.
 *
 * 🔴 Y `orientation.x` / `.y` valen **0 exactos**: el driver publica la
 *    orientación PLANA (`publicar_inclinacion: false`), porque la inclinación de
 *    6,9° que reporta el RVR es un artefacto de su acelerómetro descalibrado.
 *    No son una lectura de que el robot esté horizontal.
 *
 * ⚠️ Las tres covarianzas llegan **a cero**, no rellenas. Nada puede ponderar
 *    cuánto fiarse de cada eje.
 */
export interface MensajeImu {
  header: Cabecera
  orientation: Cuaternion
  orientation_covariance: number[]
  angular_velocity: Vector3
  angular_velocity_covariance: number[]
  linear_acceleration: Vector3
  linear_acceleration_covariance: number[]
}

/**
 * `atriz_rvr_msgs/msg/Color`. Son **dos campos y nada más**:
 * `int32[] rgb_color` y `float32 confidence`.
 *
 * 🔴 EL CANAL `clear` NO VIAJA, y es el que mejor discrimina: recorre 12,6×
 *    entre negro (181) y blanco (2288). Quien quiera seguir una linea con este
 *    topic tiene menos señal de la que caracterizo el robot.
 *
 * 🔴 Y en los 16 robots llega **a ceros** por defecto: el sensor no da nada sin
 *    su propia luz (4 apagado contra 741 encendido), y el driver solo la
 *    enciende con `color_detection:=true`, que es `false` porque deja un LED
 *    blanco bajo el chasis. Medido en rvr-01: 13,1 Hz de
 *    `{"rgb_color":[0,0,0],"confidence":0}`.
 *
 * ⚠️ `confidence` vale 0 SIEMPRE, y no por falta de configuracion: la paleta del
 *    RVR tiene cinco colores cargados y activos (comprobado). Vale 0 porque las
 *    superficies del laboratorio no se parecen a esos cinco.
 */
export interface MensajeColor {
  rgb_color: number[]
  confidence: number
}

/**
 * ⚠️ CORREGIDO EL 2026-08-06. Este bloque decia que `/color` llega a ceros «en
 *    los 16 robots por defecto» y que **no se puede encender desde la web**.
 *    Lo segundo es FALSO desde que el robot expone `/enable_color`
 *    (`std_srvs/SetBool`), y lo primero solo describe el arranque.
 *
 * 🔴 Y ahora la luz **se apaga sola**: por inactividad
 *    (`color_apagado_inactividad_s`, 120 s) y por tope duro
 *    (`color_apagado_max_s`, 900 s). Por eso el estado NO se puede recordar:
 *    hay que leer `color_activo` de `/estado_robot`.
 */

/**
 * `nav_msgs/msg/OccupancyGrid`.
 *
 * 🔴🔴 VA **LATCHEADO**: `RELIABLE + TRANSIENT_LOCAL`. Y `map_server` lo publica
 *      **una sola vez** al arrancar, al contrario que `slam_toolbox`, que lo
 *      reemite cada `map_update_interval` (5 s).
 *
 * ✅ Y AUN ASI LLEGA. Se temia que no: rosbridge se suscribe con
 *    `qos_profile_sensor_data` —BEST_EFFORT y **VOLATILE**— si no se le manda un
 *    `qos`, y un VOLATILE empareja con un TRANSIENT_LOCAL pero, en teoria, **no
 *    recibe lo ya publicado**. Medido el 2026-08-06 con un mapa de verdad
 *    (slam_toolbox, que republica cada 5 s), cinco suscripciones NUEVAS:
 *
 *        41 ms · 38 ms · 44 ms · 44 ms · 48 ms
 *
 *    Sin entrega del latch, una suscripcion en un instante cualquiera esperaria
 *    ~2,5 s de media. Cinco de cinco a ~40 ms zanjan que **el valor latcheado SI
 *    se entrega**. Y no hizo falta mandar `qos`, que era el arreglo obvio y el
 *    que habria tenido coste: rosbridge crea UNA suscripcion por topic y el QoS
 *    del PRIMER cliente gobierna a los demas.
 *
 * ⚠️ Lo medido es contra `slam_toolbox`. Con AMCL publica `map_server`, que lo
 *    emite **una sola vez**; el mecanismo de QoS es identico en los dos lados,
 *    asi que lo esperable es que tambien llegue — pero eso sigue **SIN MEDIR**.
 */
export interface MensajeMapa {
  header: Cabecera
  info: {
    resolution: number
    width: number
    height: number
    origin: { position: Vector3; orientation: Cuaternion }
  }
  data: number[]
}

/**
 * `geometry_msgs/msg/PoseWithCovarianceStamped`. Lo usan `/amcl_pose` (lectura) y
 * `/initialpose` (escritura).
 *
 * 📝 `/amcl_pose` NO llega con el robot quieto, y no es un fallo: AMCL solo
 *    actualiza tras moverse `update_min_d` (0,15 m).
 */
export interface MensajePoseConCovarianza {
  header: Cabecera
  pose: { pose: { position: Vector3; orientation: Cuaternion }; covariance: number[] }
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
 * `sensor_msgs/msg/LaserScan`. El YDLIDAR X2.
 *
 * 🔴 **ES EL 83 % DEL TRAFICO DE UN ROBOT** (~67 kB/s de los 80,7 navegando).
 * Suscribirse a `/scan` no es como suscribirse a los demas: solo se hace
 * mientras se esta MIRANDO, y la baja al desmontar tiene que llegar al robot.
 * Con 16 robots, dejarlo puesto por descuido son ~8,6 Mbit/s.
 *
 * 🔴 **`ranges` trae huecos, y no son ceros.** Entre el 83 y el 89 % de las
 * lecturas son validas; el resto llegan como `Infinity` o `NaN`. Pintarlos como
 * 0 dibujaria obstaculos pegados al robot que no existen. Hay que filtrar con
 * `Number.isFinite` **y** contra `range_min`/`range_max`.
 * ⚠️ El porcentaje **depende de la habitacion**, no es una constante del sensor.
 *
 * 🔴 **EL TAMAÑO CAMBIA ENTRE SESIONES DE BARRIDO, Y NO ES 260.** Medido desde
 * el robot el 2026-08-04, encendiendo y apagando el barrido cuatro veces con la
 * misma configuracion: **250 · 250 · 270 · 250**, y el journal del mismo dia
 * registro ademas 253, 254 y 255.
 *
 * Dentro de UNA sesion el tamaño es constante —por eso una medida de 35 barridos
 * seguidos vio «260, y solo 260», y era una observacion correcta— pero **la
 * conclusion de que 260 fuera el valor era falsa**. La causa esta en el propio
 * `fixed_resolution: true`: el driver fija el tamaño con el PRIMER barrido de
 * cada sesion, y ese primero depende de a que velocidad este girando el X2 en
 * ese instante — y el motor va libre, porque el `frequency: 10.0` esta
 * documentado como decorativo.
 *
 * → **Nada puede depender del numero.** `ranges.length` y `angle_increment`
 *   vienen en CADA mensaje: se leen de ahi y no se dan por sabidos. Un cliente
 *   que asuma un tamaño se rompera en la sesion que arranque a 250 o a 270, o
 *   sea **una de cada tres** — la peor frecuencia posible para depurar.
 *
 * 📝 Y la leccion de metodo, que ya estaba escrita en este proyecto: **una
 *    conclusion de una sola tanda puede ser coherente y falsa.**
 *
 * ⚠️ El barrido puede estar APAGADO, que es el estado de REPOSO NORMAL de los 16
 * robots: entonces este topic no llega y **eso no es una averia**. Se enciende
 * con `Teleoperacion.arrancarBarrido()`, que espera un `/scan` de verdad.
 *
 * 📝 Se recorre `ranges.length` y punto.
 */
export interface MensajeScan {
  header: Cabecera
  angle_min: number
  angle_max: number
  angle_increment: number
  time_increment: number
  scan_time: number
  range_min: number
  range_max: number
  ranges: number[]
  intensities: number[]
}

/**
 * `atriz_rvr_msgs/msg/EstadoRobot`. Añadido al robot el 2026-08-04.
 *
 * Trae lo que la interfaz no podia saber de ninguna otra forma:
 *
 * 🔴 `latido` — contador MONOTONO, la señal de vida **del nodo**. Un topic que
 *    existe no prueba que haya nadie detras: `ros2 topic list` conserva topics
 *    de nodos muertos. **Hay que comparar DOS lecturas separadas en el tiempo**;
 *    una sola no dice nada, y menos aun porque el topic va `TRANSIENT_LOCAL` y
 *    un suscriptor nuevo puede recibir el ultimo valor latcheado.
 * 🔴 `parada_emergencia` — la bandera del driver. Es lo UNICO que permite decir
 *    «parada activa» en vez de «parada enviada». ✅ Verificado contra el robot:
 *    hace un flanco false->true real al publicar en `/emergency_stop`.
 * 🔴 `antiguedad_muestra_s` y `antiguedad_odom_s` — **las dos, y por separado**.
 *    Si la primera se queda en ~0 y la segunda CRECE, llegan datos del RVR pero
 *    `/odom` no se completa (faltan componentes): un estado que no detecta ni el
 *    vigilante de silencio ni `rvr_responde`, y en el que el robot se pintaria
 *    verde con la odometria muerta. `-1.0` es «no se sabe», nunca «cero».
 * ⚠️ `reanudaciones_fallidas` distingue CARGANDO de DORMIDO, pero sus umbrales
 *    (1-2 / >2) **NO estan calibrados**: son orientacion, no criterio.
 */
export interface MensajeEstadoRobot {
  header: Cabecera
  latido: number
  parada_emergencia: boolean
  rvr_responde: boolean
  antiguedad_muestra_s: number
  antiguedad_odom_s: number
  reanudaciones_fallidas: number
  /**
   * ¿Está encendida la LUZ del sensor de color? Añadido en el robot el
   * 2026-08-06.
   *
   * 🔴 EXISTE PORQUE LA LUZ SE APAGA SOLA —por inactividad a los 120 s y por
   *    tope duro a los 900—, así que el estado **NO se puede recordar**. Un
   *    cliente que guardara «yo la encendí» acabaría pintando el botón encendido
   *    sobre un sensor a oscuras.
   *
   * ⚠️ Y NO vale deducirlo de que `/color` traiga ceros: **publica igual con la
   *    luz apagada** —no calla— y una superficie negra de verdad también da
   *    valores muy bajos. El topic dice QUÉ SE VE; este campo, SI HAY LUZ para
   *    verlo. Esta pantalla lo dedujo de los ceros durante un día y lo llamaba
   *    «una firma»: era lo mejor que había, y ya no hace falta.
   *
   * 📝 `true` también cuando se arrancó con `color_detection:=true`. En ese caso
   *    NO se apaga sola: la puso alguien a propósito.
   */
  color_activo: boolean
}

/**
 * `nav2_msgs/msg/CollisionMonitorState`. La capa de seguridad, vista desde fuera.
 *
 * El enum sale del `.msg` REAL del robot
 * (`/opt/ros/jazzy/share/nav2_msgs/msg/CollisionMonitorState.msg`, leido el
 * 2026-08-04), **no de una suposicion**: solo se habia observado el valor 1.
 *
 * 🔴 **NO publica periodicamente: publica al CAMBIAR**, y solo cuando el monitor
 * procesa, que es cuando le llega `cmd_vel_raw`. Medido (evidencia 72): 0
 * mensajes en 12 s con el robot en reposo, y UNO en 5 s de ticar a 10 Hz.
 * → Suscribirse cuesta ~0. Se puede tener siempre puesto.
 * → Y la otra cara: **con el robot quieto no llega nada**, asi que «sin mensaje»
 *   NO significa «todo bien». Significa «no se sabe».
 *
 * 🔴 **`polygon_name` NO siempre trae un poligono: a veces trae un MOTIVO.**
 * Medido con el barrido apagado: `{action_type: 1, polygon_name: 'invalid
 * source'}` — o sea STOP porque no le llega `/scan`. Es el mecanismo ya
 * documentado («sin /scan el collision_monitor bloquea el movimiento») pero que
 * hasta ahora **no se podia VER desde fuera**.
 */
export const ACCION_MONITOR = {
  NO_HACER_NADA: 0,
  PARAR: 1,
  RALENTIZAR: 2,
  APROXIMACION: 3,
  LIMITAR: 4,
} as const

export interface MensajeEstadoMonitor {
  action_type: number
  /** Un poligono (`Precaucion`, `Emergencia`…) **o un motivo** (`invalid source`). */
  polygon_name: string
}

/**
 * Los topics que esta web MODELA. Es a proposito un subconjunto de
 * `TOPICS_LECTURA`: modelar un topic significa haber leido su `.msg` y saber
 * que campos trae. Los que faltan (`/map`, `/tf`, `/color`, `/amcl_pose`,
 * `/imu`) estan permitidos por el robot pero **no tienen tipo aqui todavia**, y
 * añadirlos exige leer su definicion, no adivinarla.
 */
export interface MensajesPorTopic {
  '/battery_state': MensajeBateria
  '/motor_status': MensajeEstadoMotor
  '/odom': MensajeOdometria
  '/imu': MensajeImu
  '/color': MensajeColor
  '/map': MensajeMapa
  '/amcl_pose': MensajePoseConCovarianza
  '/encoders': MensajeEncoder
  '/scan': MensajeScan
  '/estado_robot': MensajeEstadoRobot
  '/collision_monitor_state': MensajeEstadoMonitor
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
