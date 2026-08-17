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
  /*
   * 🔴 `/estado_navegacion` es el TOPIC PARA SABER, y su pareja son los servicios
   *    `/pedir_slam` y `/pedir_nav` de abajo. El reparto es deliberado: se PIDE
   *    por servicio y se SABE por topic, porque un servicio contesta una vez y
   *    arrancar Nav2 tarda decenas de segundos.
   */
  '/estado_navegacion',
  /*
   * 🆕 2026-08-11 · Los dos del sistema de infrarrojos robot-a-robot. Ninguno
   *    mueve nada: son de LECTURA.
   *
   * 🔴 `/estado_ir` trae `conduciendo_por_ir`, y es LA UNICA FORMA de que esta
   *    web sepa que un robot se esta moviendo. `following` y `evading` son modos
   *    del FIRMWARE: el RVR conduce solo, sin pasar por `cmd_vel`, asi que ni el
   *    vigilante ni el `collision_monitor` los ven. Sin este campo la interfaz
   *    pinta «parado» mientras el robot cruza el aula.
   *
   * 📝 `/infrared_messages` CAMBIO DE TIPO el 2026-08-11 (era `code` + cuatro
   *    `*_strength`; las cuatro intensidades eran ficcion —el firmware no las
   *    envia nunca en la recepcion—). No rompio nada aqui precisamente porque
   *    no estaba en la lista blanca: se rompio en el momento barato.
   */
  '/estado_ir', '/infrared_messages',
] as const

/** 🔴 /cmd_vel NO esta y no debe estar: es la SALIDA del collision_monitor. */
export const TOPICS_ESCRITURA = ['/cmd_vel_raw', '/emergency_stop', '/initialpose'] as const

/*
 * 🔴 `/enable_color` Y `/get_rgbc_sensor_values` VAN JUNTOS O NO SIRVE NINGUNO.
 *    Lo dice la lista blanca del robot con esas palabras: son la sesion de
 *    medicion completa —encender la luz y leer lo que ve el sensor—, y separarlos
 *    deja media herramienta.
 *
 * 📝 Añadidos el 2026-08-06, y merecen una nota porque este cliente llego a
 *    afirmar que el primero NO PODIA EXISTIR. El driver llevaba escrito
 *    «🔴 MEDIDO: NO PUEDE FUNCIONAR como servicio — 481 mensajes de /color, todos
 *    ceros», y se cito como establecido. **Aquella medida estaba mal hecha:** el
 *    servicio bajo prueba se apagaba a si mismo dentro de la misma llamada, asi
 *    que casi todos aquellos mensajes eran POSTERIORES al enable(False). Una
 *    medida que no separa las dos hipotesis no refuta ninguna.
 *    Remedido con el streaming corriendo: `/color` no-cero 0 -> 53 -> 0, canal
 *    claro 1 -> 1320 -> 0, y RGB reales (255, 224, 208).
 */
export const SERVICIOS = [
  '/start_scan', '/stop_scan', '/release_emergency_stop', '/set_pos_and_yaw',
  '/set_led_rgb', '/set_multiple_leds', '/set_leds', '/trigger_led_event',
  '/enable_color', '/get_rgbc_sensor_values',
  /*
   * 🔴 SE PIDE, NO SE ORDENA — y el nombre lo dice a proposito. Estos dos no
   *    arrancan nada por si mismos: le dicen al supervisor del robot lo que se
   *    QUIERE, y el decide. Su `success` NO confirma que SLAM o Nav2 esten
   *    funcionando; eso lo dice `/estado_navegacion`, igual que `color_activo`
   *    confirma `enable_color`.
   */
  '/pedir_slam', '/pedir_nav',
  /*
   * 🆕 2026-08-11 · ENCIENDE EMISORES, NO MUEVE NADA. Por eso este esta abierto
   *    y sus dos hermanos no.
   *
   * 🔴 `/set_ir_mode` y `/set_ir_evading` se quedan FUERA a proposito, y no es
   *    un olvido que haya que corregir: ponen al robot a CONDUCIR **saltandose
   *    la capa de seguridad**. Ese es el motivo, y NO caduca.
   *
   * 🔴 CORREGIDO el 2026-08-15: aqui ponia ademas «y rosbridge no tiene
   *    identidad por usuario … se reabren cuando exista esa identidad (Fase B)».
   *    La identidad **ya existe** (A7, evidencia 124), y aun asi **NO se
   *    reabren**: saltarse el `collision_monitor` sigue siendo saltarselo, lo
   *    haga un desconocido o un alumno identificado. La Fase B cierra QUIEN
   *    entra; la lista blanca cierra QUE puede pedir. Son cosas distintas.
   */
  '/send_infrared_message',
  /*
   * 🆕 2026-08-17. La baliza continua, y **existe para no tener que abrir
   * `set_ir_mode`**: aquel lleva `broadcasting` y `following` en el mismo campo
   * como cadena libre, y esta lista filtra por SERVICIO, no por argumento — o
   * sea que abrirlo habria abierto tambien el modo que hace **conducir al robot
   * solo**, sin watchdog ni `collision_monitor`, porque los modos IR son del
   * firmware y no pasan por `cmd_vel`.
   *
   * 🔴 La seguridad no esta en que el driver valide bien: esta en que la
   *    peticion peligrosa **no se puede escribir**. `SetIRBaliza.srv` recibe un
   *    booleano, y no hay cadena con la que pedir `following`.
   */
  '/set_ir_baliza',
  /*
   * 🆕 2026-08-17. Los modos que CONDUCEN el robot: seguir y huir. Estuvieron
   * fuera desde el 2026-08-11 y se abren con dos condiciones, no una:
   *
   *   · **identidad por usuario** — la trajo la Fase B el 2026-08-15, y era la
   *     condición que el propio `robot.launch.py` había escrito. **No basta**:
   *     cambia quién responde, no que el firmware conduzca saltándose el
   *     `collision_monitor`.
   *   · **un plazo obligatorio** — `segundos` con tope, y un temporizador de un
   *     disparo en el driver que lo apaga solo. Es lo que de verdad reduce el
   *     peligro: no existe la petición «para siempre».
   *
   * 🔴 Y `modo` es un **uint8**, no una cadena: la enumeración está cerrada en
   *    el `.srv`, así que abrir este servicio no abre lo que una cadena admita
   *    el día que alguien añada un modo nuevo.
   */
  '/set_ir_conduccion',
] as const

/**
 * ✅ YA SE USA, desde el 2026-08-06. `Transporte.enviarObjetivo()` la comprueba
 * a traves de `permitidoAccion()`, y el cliente habla el protocolo de acciones
 * de rosbridge —verificado contra el rosbridge REAL de rvr-01, no solo contra
 * un doble: `accion_real.test.ts`—.
 *
 * 📝 Texto anterior, conservado porque su leccion vale: «esta constante estaba
 *    exportada y no la usaba ni la comprobaba nadie —`grep ACCIONES` en todo el
 *    repositorio solo encontraba su propia declaracion—. `permitidoAccion()`
 *    existe para que el dia que se implemente el soporte de acciones YA HAYA una
 *    comprobacion contra la lista blanca, en vez de tener que acordarse de
 *    añadirla.» Ese dia llego, y la comprobacion estaba puesta: no hubo que
 *    acordarse de nada.
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
  //    administrador pinta VERDE un robot con la odometria muerta.
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
  '/estado_navegacion': 'atriz_rvr_msgs/msg/EstadoNavegacion',
  // 🆕 2026-08-11. `EstadoIR` es el periodico (1 Hz) y `InfraredMessage` el
  // EVENTO, igual que `/estado_robot` frente a los topics sueltos: un topic mudo
  // no distingue el silencio del fallo.
  '/estado_ir': 'atriz_rvr_msgs/msg/EstadoIR',
  '/infrared_messages': 'atriz_rvr_msgs/msg/InfraredMessage',
  '/cmd_vel_raw': 'geometry_msgs/msg/Twist',
  '/emergency_stop': 'std_msgs/msg/Empty',
  '/initialpose': 'geometry_msgs/msg/PoseWithCovarianceStamped',
}

const enLista = (lista: readonly string[], x: string) => lista.includes(x)

export const permitidoSuscribir = (topic: string) => enLista(TOPICS_LECTURA, topic)
export const permitidoPublicar = (topic: string) => enLista(TOPICS_ESCRITURA, topic)
export const permitidoLlamar = (servicio: string) => enLista(SERVICIOS, servicio)
/** La llama `opSendActionGoal()`. 🔴 `opCancelActionGoal()` NO: cancelar es la salida de emergencia. */
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
 * espacio para "confirma" / "no confirma", y NINGUN servicio de los diez
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
 * `/set_leds`. Cuatro de los DIEZ servicios tienen la respuesta VACIA
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

/**
 * El otro lado de SERVICIOS_SIN_CONFIRMACION: los que devuelven `bool success`.
 *
 * ⚠️ `success` sigue sin ser el efecto. En `/enable_color` es
 *    `std_srvs/SetBool`: un `true` dice que la llamada al SDK no lanzo, **no que
 *    haya luz**. Lo que lo prueba es `/estado_robot.color_activo` subiendo, o
 *    `/color` dejando de traer ceros — y esa es la comprobacion que hace la
 *    pantalla, igual que el `latido` para la parada y `/odom` para el origen.
 */
export const SERVICIOS_SOLO_NO_LANZO = [
  '/set_pos_and_yaw', '/set_led_rgb', '/set_multiple_leds', '/trigger_led_event',
  '/enable_color', '/get_rgbc_sensor_values',
  /*
   * 🔴 SE PIDE, NO SE ORDENA — y el nombre lo dice a proposito. Estos dos no
   *    arrancan nada por si mismos: le dicen al supervisor del robot lo que se
   *    QUIERE, y el decide. Su `success` NO confirma que SLAM o Nav2 esten
   *    funcionando; eso lo dice `/estado_navegacion`, igual que `color_activo`
   *    confirma `enable_color`.
   */
  '/pedir_slam', '/pedir_nav',
  /*
   * `SendInfraredMessage.srv` devuelve `bool success` + `string message`, asi
   * que cae de este lado. ⚠️ Y aqui «no lanzo» pesa mas de lo normal: el efecto
   * es una luz INFRARROJA, o sea INVISIBLE para quien esta delante del robot.
   * En los demas servicios queda el ojo del usuario como ultimo testigo; en este
   * NO HAY TESTIGO HUMANO POSIBLE. Lo unico que lo confirma es el `/estado_ir`
   * del OTRO robot trayendo el codigo.
   */
  '/send_infrared_message',
  /*
   * La baliza tiene el MISMO problema y peor: el infrarrojo es invisible, el
   * robot no se escucha a si mismo, y ademas queda ENCENDIDA — asi que ni
   * siquiera hay un instante en el que mirar. El unico testigo sigue siendo el
   * `/estado_ir` del OTRO robot.
   *
   * ⚠️ `success` del `.srv` dice que el driver acepto la peticion, no que la luz
   *    infrarroja este saliendo. Son cosas distintas y la pantalla no puede
   *    confundirlas.
   */
  '/set_ir_baliza',
  /*
   * Y el que conduce. `success` dice que el driver aceptó y armó el plazo — no
   * que el robot se esté moviendo, ni que vaya a encontrar a nadie. Lo que sí
   * se puede mirar es `/estado_ir`: `modo` y `conduciendo_por_ir`.
   */
  '/set_ir_conduccion',
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
