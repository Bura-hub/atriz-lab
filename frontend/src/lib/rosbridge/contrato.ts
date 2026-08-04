/**
 * El contrato con el robot. NO se inventa: es la lista blanca de rosbridge de
 * `atriz_rvr_bringup/launch/robot.launch.py:320-360` en el repositorio Atriz_rvr.
 *
 * `herramientas/comprobar_contrato.mjs` compara este fichero con aquel. Si
 * divergen, gana el robot: la web no puede ampliar su propia autorizacion.
 */

export const TOPICS_LECTURA = [
  '/odom', '/imu', '/scan', '/battery_state', '/motor_status', '/encoders',
  '/color', '/estado_robot', '/map', '/tf', '/tf_static', '/collision_monitor_state',
  '/amcl_pose',
] as const

/** 🔴 /cmd_vel NO esta y no debe estar: es la SALIDA del collision_monitor. */
export const TOPICS_ESCRITURA = ['/cmd_vel_raw', '/emergency_stop', '/initialpose'] as const

export const SERVICIOS = [
  '/start_scan', '/stop_scan', '/release_emergency_stop', '/set_pos_and_yaw',
  '/set_led_rgb', '/set_multiple_leds', '/set_leds', '/trigger_led_event',
] as const

/**
 * 🔴 Punto 4 del encargo: esta constante estaba exportada y no la usaba ni la
 * comprobaba nadie -`grep ACCIONES` en todo el repositorio solo encontraba su
 * propia declaracion-. Hoy `teleoperacion.ts` no tiene soporte de acciones
 * (Nav2 / `/navigate_to_pose` se maneja fuera de este cliente por ahora), asi
 * que no hay ningun `permitidoAccion()` que llamar todavia -pero dejarla muda
 * es exactamente el "tope silencioso" que este proyecto ya ha pagado caro en
 * otros sitios: quien lea `ACCIONES` sin este comentario asume que algo la
 * usa. `permitidoAccion()`, justo debajo, existe para que el dia que se
 * implemente el soporte de acciones YA HAYA una comprobacion contra la lista
 * blanca -el mismo patron que `permitidoSuscribir`/`permitidoPublicar`/
 * `permitidoLlamar`- en vez de tener que acordarse de añadirla.
 *
 * ⚠️ Y `comprobar_contrato.mjs` NO compara este glob contra robot.launch.py
 * como hace con LEER/ESCRIBIR/SERVICIOS: en el launch, el glob de acciones va
 * INLINE (`_glob(['/navigate_to_pose'])`), no como una constante nombrada que
 * se pueda extraer con el mismo patron. El script lo dice explicitamente en
 * su salida -no es un ✅ silencioso de "los cuatro globs verificados".
 */
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
  // AÑADIDO 2026-08-04, cuando `feat/estado-robot` se fusiono en `ros2`. Trae lo
  // que la interfaz no podia saber: el `latido` (senal de vida DEL NODO, no del
  // topic), la bandera de parada -que el driver no publicaba-, y con que
  // distinguir un robot CARGANDO de uno DORMIDO.
  // 🔴 Y `antiguedad_odom_s`, que cubre un tercer estado que no veia nadie:
  //    llegan 4 de los 5 componentes de /odom -> el latido avanza y
  //    `rvr_responde` dice true con /odom a 0 Hz. Sin ese campo, el muro del
  //    profesor pinta VERDE un robot con la odometria muerta.
  '/estado_robot': 'atriz_rvr_msgs/msg/EstadoRobot',
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
/** Ver el comentario de ACCIONES: nadie la llama todavia, es para cuando exista soporte de acciones. */
export const permitidoAccion = (accion: string) => enLista(ACCIONES, accion)
export const tipoDe = (topic: string): string | undefined => TIPOS[topic]

/**
 * 🔴🔴 Punto 2 del encargo: `confirmaEfecto()` prometia un EFECTO que este
 * proyecto midio que NO ocurre. El arreglo anterior (CORREGIDO, abajo) se
 * quedo en la forma del `.srv`: distinguio los cuatro con respuesta VACIA de
 * los otros cuatro, y a esos otros cuatro los llamo "SI confirman". Pero
 * "confirmar" era la palabra equivocada. Los cuatro que devuelven
 * `bool success` lo hacen asi, en el driver (rvr_driver_node.py):
 *
 *   ok, _, msg = self._pedir(...)   # _pedir: «Devuelve (ok, resultado,
 *                                   #   mensaje). Nunca lanza»
 *   resp.success = ok               # ok = la CORRUTINA no lanzo en 5 s
 *
 * `success = true` dice UNA cosa: que la llamada al SDK no lanzo una
 * excepcion. NO dice que el efecto FISICO ocurriera -y hay un caso medido y
 * alcanzable donde las dos cosas se separan:
 *
 *   🔴 `undercarriage_white` NO ENCIENDE EL LED DE LOS BAJOS, y devuelve
 *   `success=True`. Lo enciende `enable_color_detection` -un comando
 *   DISTINTO-. Medido con el sensor de luz como testigo.
 *
 * `LEDS[10] = 'undercarriage_white'` (`/set_led_rgb(led_id=10)`) es una
 * llamada perfectamente legitima por esta lista blanca: la interfaz puede
 * alcanzar este caso sin hacer nada raro. Si `confirmaEfecto()` dijera
 * `true` para `/set_led_rgb`, estaria prometiendo un LED encendido que no se
 * encendio -la misma mentira, en otro sitio, que ya le costo caro a este
 * proyecto con la parada de emergencia.
 *
 * Por eso la funcion ya NO devuelve un booleano: un booleano solo tiene
 * espacio para "confirma" / "no confirma", y NINGUN servicio de los ocho
 * confirma el efecto de verdad. `ConfirmacionServicio` no tiene un tercer
 * valor tipo "CONFIRMA" -no existe en la union- para que sea IMPOSIBLE que
 * el tipo prometa algo que ningun servicio da:
 *
 *   - `'NINGUNA'`          -> la respuesta esta VACIA: no hay ni un bit.
 *   - `'SOLO_QUE_NO_LANZO'` -> hay un `bool success`, pero solo prueba que
 *     la corrutina del SDK no lanzo -NO que el efecto fisico paso. Ver
 *     `undercarriage_white` arriba: es el ejemplo real de por que esta
 *     categoria no vale como confirmacion para la interfaz.
 *
 * Version anterior (CORREGIDO), conservada porque su hallazgo sigue en pie
 * -solo la palabra "confirman" de la version vieja era el error-: NO es solo
 * `/set_leds`. Cuatro de los ocho servicios tienen la respuesta VACIA
 * (`std_srvs/srv/Empty`, sin ningun campo debajo del `---`), medido contra
 * el repositorio del robot:
 *
 *   /start_scan, /stop_scan, /release_emergency_stop  -> std_srvs/srv/Empty
 *   /set_leds                                          -> SetLeds.srv, VACIA
 *
 * `/release_emergency_stop` es la operacion que devuelve el control del robot
 * a un aula con estudiantes: antes `confirmaEfecto()` decia `true` para los
 * tres primeros, que es exactamente la mentira que este proyecto ya paga con
 * la parada de emergencia.
 */
export type ConfirmacionServicio = 'NINGUNA' | 'SOLO_QUE_NO_LANZO'

export const SERVICIOS_SIN_CONFIRMACION = [
  '/start_scan', '/stop_scan', '/release_emergency_stop', '/set_leds',
] as const

/** El otro lado de SERVICIOS_SIN_CONFIRMACION: los cuatro con `bool success`. */
export const SERVICIOS_SOLO_NO_LANZO = [
  '/set_pos_and_yaw', '/set_led_rgb', '/set_multiple_leds', '/trigger_led_event',
] as const

export function confirmaEfecto(servicio: string): ConfirmacionServicio {
  return enLista(SERVICIOS_SIN_CONFIRMACION, servicio) ? 'NINGUNA' : 'SOLO_QUE_NO_LANZO'
}

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
