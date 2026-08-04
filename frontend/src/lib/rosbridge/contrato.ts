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
 * SetLeds.srv tiene la respuesta del servicio VACIA: no hay ningun campo debajo
 * del `---`. Es la unica operacion de la superficie web sin deteccion de fallo,
 * y en este firmware hay comandos de LED que se aceptan en silencio sin hacer
 * nada. La UI NO puede prometer que el color cambio.
 */
export const SERVICIOS_SIN_CONFIRMACION = ['/set_leds'] as const
export const confirmaEfecto = (servicio: string) => !enLista(SERVICIOS_SIN_CONFIRMACION, servicio)

/**
 * /battery_state.percentage es una FRACCION 0-1, no un porcentaje: lo manda
 * sensor_msgs/BatteryState y el driver lo respeta.
 */
export const porcentajeLegible = (fraccion: number) => Math.round(fraccion * 100)

export type NivelBateria = 'OK' | 'BAJA' | 'CRITICA'

/** Umbrales del propio firmware del RVR. El PORCENTAJE no sirve para decidir carga. */
export const V_BAJA = 7.0
export const V_CRITICA = 6.5

export function nivelBateria(voltios: number): NivelBateria {
  if (voltios < V_CRITICA) return 'CRITICA'
  if (voltios < V_BAJA) return 'BAJA'
  return 'OK'
}

export type Frescura = { conocido: false } | { conocido: true; antiguedadS: number }

/** -1.0 en antiguedad_atasco_s / _fallo_s / _termico_s es «no se sabe», no «todo bien». */
export function interpretarAntiguedad(s: number): Frescura {
  return s < 0 ? { conocido: false } : { conocido: true, antiguedadS: s }
}
