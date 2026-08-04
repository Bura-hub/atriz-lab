/**
 * El contrato con el robot. NO se inventa: es la lista blanca de rosbridge de
 * `atriz_rvr_bringup/launch/robot.launch.py:320-360` en el repositorio Atriz_rvr.
 *
 * `herramientas/comprobar_contrato.mjs` compara este fichero con aquel. Si
 * divergen, gana el robot: la web no puede ampliar su propia autorizacion.
 */

export const TOPICS_LECTURA = [
  '/odom', '/imu', '/scan', '/battery_state', '/motor_status', '/encoders',
  '/color', '/map', '/tf', '/tf_static', '/collision_monitor_state', '/amcl_pose',
] as const

/** 🔴 /cmd_vel NO esta y no debe estar: es la SALIDA del collision_monitor. */
export const TOPICS_ESCRITURA = ['/cmd_vel_raw', '/emergency_stop', '/initialpose'] as const

export const SERVICIOS = [
  '/start_scan', '/stop_scan', '/release_emergency_stop', '/set_pos_and_yaw',
  '/set_led_rgb', '/set_multiple_leds', '/set_leds', '/trigger_led_event',
] as const

export const ACCIONES = ['/navigate_to_pose'] as const

export const TIPOS: Readonly<Record<string, string>> = {
  '/odom': 'nav_msgs/msg/Odometry',
  '/imu': 'sensor_msgs/msg/Imu',
  '/scan': 'sensor_msgs/msg/LaserScan',
  '/battery_state': 'sensor_msgs/msg/BatteryState',
  '/motor_status': 'atriz_rvr_msgs/msg/MotorStatus',
  // 🔴 `Encoder`, SINGULAR. `Encoders.msg` no existe: el driver importa
  //    `from atriz_rvr_msgs.msg import (Color, ControlState, Encoder, ...)` y
  //    publica `create_publisher(Encoder, 'encoders', qos_tel)`. Un tipo mal
  //    escrito da `InvalidClassException` en rosbridge y el sintoma es «ese
  //    topic no llega», que se busca en el sitio equivocado.
  '/encoders': 'atriz_rvr_msgs/msg/Encoder',
  '/color': 'atriz_rvr_msgs/msg/Color',
  '/map': 'nav_msgs/msg/OccupancyGrid',
  '/tf': 'tf2_msgs/msg/TFMessage',
  '/tf_static': 'tf2_msgs/msg/TFMessage',
  // ✅ VERIFICADO en el robot (2026-08-03): existe
  //    /opt/ros/jazzy/share/nav2_msgs/msg/CollisionMonitorState.msg
  //    (uint8 action_type, string polygon_name), y collision_monitor.yaml usa
  //    `state_topic: "collision_monitor_state"` con namespace vacio, asi que el
  //    absoluto es el correcto.
  '/collision_monitor_state': 'nav2_msgs/msg/CollisionMonitorState',
  '/amcl_pose': 'geometry_msgs/msg/PoseWithCovarianceStamped',
  '/cmd_vel_raw': 'geometry_msgs/msg/Twist',
  '/emergency_stop': 'std_msgs/msg/Empty',
  '/initialpose': 'geometry_msgs/msg/PoseWithCovarianceStamped',
}

const enLista = (lista: readonly string[], x: string) => lista.includes(x)

export const permitidoSuscribir = (topic: string) => enLista(TOPICS_LECTURA, topic)
export const permitidoPublicar = (topic: string) => enLista(TOPICS_ESCRITURA, topic)
export const permitidoLlamar = (servicio: string) => enLista(SERVICIOS, servicio)
export const tipoDe = (topic: string): string | undefined => TIPOS[topic]

/**
 * 🔴 CORREGIDO: NO es solo `/set_leds`. Cuatro de los ocho servicios tienen la
 * respuesta VACIA (`std_srvs/srv/Empty`, sin ningun campo debajo del `---`),
 * medido contra el repositorio del robot:
 *
 *   /start_scan, /stop_scan, /release_emergency_stop  -> std_srvs/srv/Empty
 *   /set_leds                                          -> SetLeds.srv, VACIA
 *
 * `/release_emergency_stop` es la operacion que devuelve el control del robot
 * a un aula con estudiantes: antes `confirmaEfecto()` decia `true` para los
 * tres primeros, que es exactamente la mentira que este proyecto ya paga con
 * la parada de emergencia. La UI NO puede prometer un efecto que la respuesta
 * no contiene ni un bit para confirmar.
 */
export const SERVICIOS_SIN_CONFIRMACION = [
  '/start_scan', '/stop_scan', '/release_emergency_stop', '/set_leds',
] as const
export const confirmaEfecto = (servicio: string) => !enLista(SERVICIOS_SIN_CONFIRMACION, servicio)

/**
 * /battery_state.percentage es una FRACCION 0-1, no un porcentaje: lo manda
 * sensor_msgs/BatteryState y el driver lo respeta.
 *
 * `null` cuando la fraccion no es un numero finito: NaN o Infinity no son un
 * porcentaje legible, y `Math.round(NaN * 100)` da NaN en silencio -misma
 * familia de bug que `nivelBateria(NaN)`.
 */
export const porcentajeLegible = (fraccion: number): number | null =>
  Number.isFinite(fraccion) ? Math.round(fraccion * 100) : null

export type NivelBateria = 'OK' | 'BAJA' | 'CRITICA' | 'DESCONOCIDO'

/** Umbrales del propio firmware del RVR. El PORCENTAJE no sirve para decidir carga. */
export const V_BAJA = 7.0
export const V_CRITICA = 6.5

/**
 * 🔴 CORREGIDO: `nivelBateria(NaN)` devolvia `'OK'`. `NaN < V_CRITICA` y
 * `NaN < V_BAJA` son los dos `false`, asi que caia en la rama «segura» por la
 * puerta equivocada -el mismo patron que `limitar(nan)` devolviendo el tope
 * en `atriz.py`. En el robot, `rvr_driver_node.py:958` publica exactamente
 * `voltage = NaN` cuando la lectura falla (RVR cargando con la Pi viva, o
 * dormido): con el bug, la vista de flota pintaba ese robot en OK.
 * `interpretarAntiguedad()` ya distinguia «no se sabe» de «todo bien»; esta
 * funcion no lo hacia, y es la senal que decide si alguien cruza el edificio.
 */
export function nivelBateria(voltios: number): NivelBateria {
  if (!Number.isFinite(voltios)) return 'DESCONOCIDO'
  if (voltios < V_CRITICA) return 'CRITICA'
  if (voltios < V_BAJA) return 'BAJA'
  return 'OK'
}

export type Frescura = { conocido: false } | { conocido: true; antiguedadS: number }

/**
 * -1.0 en antiguedad_atasco_s / _fallo_s / _termico_s es «no se sabe», no
 * «todo bien». Misma familia que `nivelBateria`: antes `NaN < 0` era `false`,
 * asi que un valor NO FINITO caia en la rama `conocido: true` con
 * `antiguedadS: NaN` en vez de en «no se sabe».
 */
export function interpretarAntiguedad(s: number): Frescura {
  return Number.isFinite(s) && s >= 0 ? { conocido: true, antiguedadS: s } : { conocido: false }
}
