#!/usr/bin/env node
/**
 * UN ROSBRIDGE DE MENTIRA, para mirar la interfaz sin robot.
 *
 * 🔴 NO SUSTITUYE AL ROBOT, Y ESTE FICHERO NO PUEDE PRETENDERLO. Lo que sale de
 *    aquí es lo que YO creo que manda el robot: si me equivoco al escribirlo, la
 *    pantalla se verá perfecta y estará mal. Sirve para UNA cosa —conducir la
 *    interfaz por estados que el robot tarda minutos en producir, o que no
 *    produce nunca a demanda (CIEGO, MUDO, latcheado)— y para nada más.
 *
 *    Todo lo que se mire aquí queda **NO VERIFICADO** hasta repetirlo contra
 *    rvr-01. Es el mismo criterio que el resto del proyecto: un doble prueba que
 *    el código no revienta, no que el robot haga eso.
 *
 * Sin dependencias: hace el handshake de WebSocket (RFC 6455) a mano, porque
 * este repositorio tiene cinco dependencias y eso es un valor suyo.
 *
 *   node herramientas/rosbridge_de_mentira.mjs              # ciclo automático
 *   node herramientas/rosbridge_de_mentira.mjs --slam ciego # un estado fijo
 *   node herramientas/rosbridge_de_mentira.mjs --nav bloqueado --sin-mapa
 *   node herramientas/rosbridge_de_mentira.mjs --aproximacion       # 🔴 robot CONGELADO
 *   node herramientas/rosbridge_de_mentira.mjs --aproximacion --moviendose  # el control
 *   node herramientas/rosbridge_de_mentira.mjs --conduciendo-ir     # 🔴 se mueve SOLO
 *   node herramientas/rosbridge_de_mentira.mjs --objetivo falla    # 🔴 ABORTED con el robot llegado
 *   node herramientas/rosbridge_de_mentira.mjs --objetivo termina  # el otro desenlace
 *
 * Después: abrir http://localhost:3000/robot/rvr-01/navegar con la dirección
 * apuntando a `ws://localhost:9090`.
 */

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'

/*
 * 📝 `--puerto 0` deja que el sistema elija uno libre y el doble imprime el que
 *    le tocó, para que las pruebas no choquen entre sí ni con un doble que
 *    alguien dejara corriendo a mano. Mismo patrón que `agente_de_mentira.mjs`.
 */
const PUERTO = Number(
  (process.argv.indexOf('--puerto') === -1
    ? null
    : process.argv[process.argv.indexOf('--puerto') + 1]) ?? 9090,
)

const ESTADOS = {
  apagado: 0, arrancando: 1, funcionando: 2, ciego: 3, mudo: 4, fallo: 5, desconocido: 6,
}

/* ── Argumentos ────────────────────────────────────────────────────────── */
const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i === -1 ? null : process.argv[i + 1]
}
const fijoSlam = arg('--slam')
const fijoNav = arg('--nav')
const sinMapa = process.argv.includes('--sin-mapa')
/*
 * 🔴 `--frenando [parar]` hace que `/collision_monitor_state` publique un
 *    recorte. Es el estado que el alumno NO ve en el robot —el journal lo
 *    registra y la pantalla callaba— y no se puede provocar a demanda sin poner
 *    algo al lado del robot, que es justo por lo que hace falta aquí.
 */
const frenando = process.argv.includes('--frenando')
const frenandoParar = process.argv.includes('--parar')
/*
 * 🔴🔴 `--aproximacion` — EL CASO PEOR, y el doble no sabia producirlo.
 *
 * Medido en el robot el 2026-08-09 (evidencias 93-95) con 24 estaciones a mano:
 * con algo dentro del circulo de 15 cm, `approach` multiplica el mando ENTERO
 * —lineal y angular— por el tiempo hasta colision, y ese factor es CERO:
 *
 *     AVANZAR alejandose -> 0,0 cm   GIRAR -> 0,0°   RETROCEDER -> 0,0 cm
 *
 * Provocarlo en el robot cuesta poner una pared a 17 cm y medirla; aqui es una
 * bandera. Publica `action_type: 3` **y `/odom` a cero**, porque la pantalla no
 * decide con el codigo: mira si el robot se mueve. Las dos cosas hacen falta —
 * con `/odom` a 0,100 m/s se veria el aviso prudente, no la afirmacion.
 */
const aproximacion = process.argv.includes('--aproximacion')
// Con `--aproximacion --moviendose` sale el otro lado: el robot SI se mueve, y
// entonces la pantalla NO puede afirmar que este congelado. Es el control.
const seMueveIgual = process.argv.includes('--moviendose')
const robotQuieto = aproximacion && !seMueveIgual
/*
 * 🔴 `--conduciendo-ir` — el robot se mueve SOLO, conducido por su firmware.
 *
 * `following` y `evading` no pasan por `cmd_vel`, asi que ni el vigilante ni el
 * `collision_monitor` los ven: sin `/estado_ir.conduciendo_por_ir` la web pinta
 * «parado» un robot que cruza el aula. Este es el unico interruptor que produce
 * ese estado sin dos robots de verdad y un emisor infrarrojo.
 */
const conduciendoIR = process.argv.includes('--conduciendo-ir')
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 `--objetivo termina|falla` — LA PANTALLA DE NAVEGAR NO SE PODIA MIRAR
 * ═══════════════════════════════════════════════════════════════════════════
 * `/map` y `/amcl_pose` solo existen con Nav2 levantado, y Nav2 no arranca solo
 * a proposito —cuesta ~58 % de un nucleo y sale de la bateria del RVR—. O sea
 * que para ver el mapa dibujado, el modo «decirle al robot donde esta» o el
 * desenlace de un objetivo habia que arrancar Nav2 en un robot y conducirlo.
 * **Esta pantalla se rediseño sin poder mirarla**, que es justo lo que este
 * doble existe para evitar.
 *
 * `--objetivo falla` da el caso que MAS importa y que el robot casi nunca
 * produce a demanda: `ABORTED` sobre un robot que llego igual (evidencia 88).
 *
 * ⚠️ Y sigue valiendo la cabecera: esto es lo que YO creo que manda Nav2. Que
 *    la pantalla se vea bien aqui **no dice nada** sobre el robot.
 */
const objetivoAcaba = (arg('--objetivo') ?? 'termina').toLowerCase()
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 FASE B (A7): EL TESTIGO — Y LO QUE ESTE DOBLE **NO** PUEDE PROBAR
 * ═══════════════════════════════════════════════════════════════════════════
 * `--exige-testigo`      rechaza con 4401 si no llega un `atriz.token.<jwt>`
 * `--rechazar <codigo>`  cierra siempre con ese codigo, justo tras el apreton
 *
 * Sirven para ejercitar el lado del CLIENTE sin robot: que no reintente un
 * 4403, que enseñe el motivo, que el 1013 si reintente.
 *
 * 🔴 ESTE DOBLE NO VERIFICA NINGUNA FIRMA, Y NO DEBE PARECER QUE LO HACE.
 *    Mira si el subprotocolo EMPIEZA por `atriz.token.` y nada mas. Que este
 *    doble acepte un testigo **no dice absolutamente nada** sobre si el robot
 *    lo aceptaria: la firma la comprueba `atriz_testigo.py` con Ed25519.
 *
 * 🔴 Y HAY ALGO QUE NO PUEDE PROBAR NI QUERIENDO: el manejo de errores de
 *    tornado. Este apreton se escribe A MANO —`createHash` mas arriba— y no
 *    ejecuta el `assert self.selected_subprotocol in subprotocols` del
 *    original. El 2026-08-15 esa diferencia exacta dejo EN VERDE una prueba del
 *    Taller sobre un camino que en el robot devolvia **HTTP 500** (evidencia
 *    120), y el mismo dia un doble mio afirmo que un campo se llamaba `valido`
 *    cuando se llama `ok`, con 24 pruebas confirmandolo (evidencia 124).
 *    → Lo que este doble diga sobre el APRETON hay que confirmarlo contra el
 *      robot: `src/lib/rosbridge/testigo_real.test.ts`.
 */
const exigeTestigo = process.argv.includes('--exige-testigo')
const rechazarCon = Number(arg('--rechazar') ?? 0)
// 🔴 «Latcheado» no es un estado del enum: es una bandera aparte, y la interfaz
//    tiene que pintarla ENCIMA de lo que diga el estado. Se pide por su nombre.
const latSlam = fijoSlam === 'bloqueado'
const latNav = fijoNav === 'bloqueado'

/* ── El guion, cuando no se fija nada ──────────────────────────────────── */
const GUION = [
  { slam: 'apagado', nav: 'apagado', d: 'sin arrancar' },
  { slam: 'arrancando', nav: 'apagado', d: 'esperando a slam_toolbox' },
  { slam: 'funcionando', nav: 'apagado', d: '' },
  // Los dos que un interruptor esconde, y son la razón de este fichero.
  { slam: 'ciego', nav: 'apagado', d: 'no llega /scan: ¿alguien apagó el barrido?' },
  { slam: 'mudo', nav: 'apagado', d: 'slam_toolbox no procesa: búfer TF roto' },
  { slam: 'funcionando', nav: 'arrancando', d: '' },
  { slam: 'funcionando', nav: 'funcionando', d: '' },
  { slam: 'funcionando', nav: 'fallo', d: 'atriz-nav salió con código 1' },
]

let paso = 0
let latido = 0
let arrancandoDesde = null

function estadoAhora() {
  const g = GUION[paso % GUION.length]
  const slam = fijoSlam !== null ? (ESTADOS[fijoSlam] ?? 6) : ESTADOS[g.slam]
  const nav = fijoNav !== null ? (ESTADOS[fijoNav] ?? 6) : ESTADOS[g.nav]
  const arrancando = slam === 1 || nav === 1
  if (arrancando && arrancandoDesde === null) arrancandoDesde = Date.now()
  if (!arrancando) arrancandoDesde = null
  // 🔴 -1.0 cuando no aplica, NUNCA 0: en este proyecto -1 significa siempre
  //    «no se sabe», y un 0 se leería como «acaba de empezar».
  const seg = arrancandoDesde === null ? -1 : (Date.now() - arrancandoDesde) / 1000

  return {
    header: { stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 }, frame_id: '' },
    latido: ++latido,
    slam, nav,
    slam_detalle: fijoSlam !== null ? '' : (slam >= 3 ? g.d : ''),
    nav_detalle: fijoNav !== null ? '' : (nav >= 3 ? g.d : ''),
    slam_arrancando_s: slam === 1 ? seg : -1,
    nav_arrancando_s: nav === 1 ? seg : -1,
    hay_mapa: !sinMapa,
    /*
     * 🔴 AÑADIDOS AL DOBLE EL 2026-08-09, y llegaron tarde: el robot los publica
     *    desde el 08 y este fichero se quedó atrás, así que la pantalla pintaba
     *    su texto de reserva («el robot no dice qué mapa tiene») sobre un doble
     *    que simplemente no lo mandaba. Es el mismo descuido que ya costó los
     *    nombres de campo de /encoders. **Al cambiar un `.msg`, este doble va
     *    detrás en el mismo tirón.**
     * Valores reales de rvr-01: cuarto3.yaml con 104976 s (1,22 días).
     */
    mapa_nombre: sinMapa ? '' : 'cuarto3.yaml',
    mapa_edad_s: sinMapa ? -1 : 104976,
    slam_latcheado: latSlam,
    nav_latcheado: latNav,
  }
}

/* ── Los demás topics, para poder MIRAR las otras pantallas ────────────── */
/*
 * 🔴 ESTOS NÚMEROS SALEN DE `CLAUDE.md`, NO DE MI CABEZA. Son los valores de
 *    referencia medidos del proyecto, y están puestos así para que una pantalla
 *    que los pinte mal se note: 8,28 V al «100 %», batería como FRACCIÓN 0-1 (no
 *    porcentaje, que ya causó una falsa alarma), ticks de encoder SIN SIGNO en
 *    32 bits, `/scan` con un tamaño que NO es constante entre sesiones.
 *
 * ⚠️ Aun así siguen siendo inventados: prueban que la pantalla no revienta y
 *    que el formato encaja, NO que el robot mande esto.
 */
let t = 0
/*
 * 🔴 El estado de la LUZ del sensor, para que `/get_rgbc_sensor_values` conteste
 *    distinto en cada modo — que es lo único que hace interesante a ese servicio.
 *    Los números son los MEDIDOS sobre una pantalla de móvil roja a tope
 *    (evidencia 86): con la luz apagada R/G = 5,12; con ella encendida, 0,66 —o
 *    sea el resultado INVERTIDO, que es lo que la pantalla tiene que atrapar.
 */
let luzEncendida = false
/** Tics que lleva corriendo un objetivo de navegacion. 0 = ninguno. */
let navegando = 0
/** Cuantas lecturas de color se han pedido. Da ruido reproducible. */
let lecturasColor = 0
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * UN CUARTO DE MENTIRA: 3,45 x 4,10 m a 5 cm/celda = 69 x 82 celdas
 * ═══════════════════════════════════════════════════════════════════════════
 * Son las medidas del cuarto que se mapeo de verdad el 2026-08-07, y el tamaño
 * importa: con 69x82 se reproduce el mapa APAISADO al reves —mas alto que
 * ancho—, que es el que destapo los dos fallos de escalado del lienzo.
 *
 * 🔴 CON UNA FRONTERA ABIERTA A PROPOSITO: un hueco de 3 celdas en la pared de
 *    arriba, con desconocido detras. Sin eso `fronteraAbierta()` daria 0 y el
 *    dato mas interesante de la pantalla saldria siempre en su caso trivial.
 *    Los valores son los de ROS: -1 desconocido, 0 libre, 100 ocupado.
 */
const MAPA_ANCHO = 69
const MAPA_ALTO = 82
const MAPA_DATA = (() => {
  const d = new Array(MAPA_ANCHO * MAPA_ALTO).fill(-1)
  const en = (x, y) => y * MAPA_ANCHO + x
  for (let y = 6; y < MAPA_ALTO - 6; y++) {
    for (let x = 6; x < MAPA_ANCHO - 6; x++) {
      const borde = y === 6 || y === MAPA_ALTO - 7 || x === 6 || x === MAPA_ANCHO - 7
      // El hueco de la puerta, en la pared de arriba.
      const puerta = y === 6 && x >= 30 && x <= 32
      d[en(x, y)] = borde && !puerta ? 100 : 0
    }
  }
  // Una mesa dentro, para que el mapa no sea una caja vacia.
  for (let y = 20; y < 30; y++) for (let x = 40; x < 52; x++) d[en(x, y)] = 100
  return d
})()

const CUERPOS = {
  /*
   * `/map` es TRANSIENT_LOCAL en el robot, y el doble lo entrega al suscribirse
   * como hace rosbridge — medido: 38-48 ms en cinco suscripciones nuevas.
   */
  '/map': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'map' },
    info: {
      resolution: 0.05,
      width: MAPA_ANCHO,
      height: MAPA_ALTO,
      origin: { position: { x: -1.7, y: -2.0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
    },
    data: MAPA_DATA,
  }),
  /*
   * 📝 AMCL **no publica con el robot quieto** (solo actualiza tras moverse
   *    `update_min_d` = 0,15 m), pero aqui se manda en cada tic: sin el, la
   *    pantalla no distingue «Nav2 arrancado» de «esto es SLAM» y no habria
   *    forma de llegar al caso normal.
   */
  '/amcl_pose': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'map' },
    pose: { pose: {
      position: { x: 0.1 + navegando * 0.05, y: -0.35, z: 0 },
      orientation: { x: 0, y: 0, z: 0.38, w: 0.925 },
    }, covariance: new Array(36).fill(0) },
  }),
  '/odom': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'odom' },
    child_frame_id: 'base_footprint',
    pose: { pose: {
      // 🔴 AVANZA MIENTRAS NAVEGA: el desenlace de un objetivo pinta el
      //    desplazamiento medido por `/odom`, y con una posicion fija saldria
      //    «0,00 m» — que es un valor valido y esconderia el caso normal.
      position: { x: 0.30 + t * 0.001 + navegando * 0.06, y: -0.02, z: 0 },
      orientation: { x: 0, y: 0, z: 0.0011, w: 1 },
    } },
    // 🔴 Con el robot congelado por `approach`, `/odom` da CERO EXACTO. No es un
    //    detalle del doble: es lo que la pantalla mira para no tener que
    //    adivinar si la accion 3 es «mas lento» o «parado».
    twist: robotQuieto
      ? { twist: { linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } } }
      : { twist: { linear: { x: 0.100, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0.002 } } },
  }),
  '/imu': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'imu_link' },
    orientation: { x: 0, y: 0, z: 0.0011, w: 1 },
    angular_velocity: { x: 0.001, y: -0.002, z: 0.004 },
    // |g| sale 3,8 % corto: el acelerómetro está descalibrado, y es un dato real.
    linear_acceleration: { x: -0.09, y: 0.02, z: 9.435 },
  }),
  '/battery_state': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    // 🔴 FRACCIÓN 0-1. Leerlo como 0-100 hizo creer que un robot al 34 % estaba a 0.
    percentage: 0.94, voltage: 8.28, current: NaN, charge: NaN, capacity: NaN,
    power_supply_status: 0,
  }),
  /*
   * 🔴🔴 LOS NOMBRES SALEN DEL `.msg`, Y AQUI ME EQUIVOQUE A LA PRIMERA.
   *
   *   escribi                    el .msg dice
   *   temperatura_izquierda  ->  temperatura_izquierdo   (masculino)
   *   fallo_izquierdo/derecho ->  fallo                  (UNO, no dos)
   *   estado_termico          ->  estado_termico_izquierdo / _derecho
   *   ticks_izquierda/derecha ->  left_wheel_count / right_wheel_count (¡ingles!)
   *
   * Consecuencia: la pantalla de telemetria pinto `—` en los encoders y en las
   * dos temperaturas, con datos llegando. **Y parecia un fallo de la web.**
   * Estuve a punto de reportar dos defectos que no existian.
   *
   * → Antes de tocar este fichero, lee el `.msg` en `Atriz_rvr/atriz_rvr_msgs/`.
   *   Un doble con los nombres mal no es un doble: es una fuente de fallos
   *   inventados, y este proyecto ya lleva seis veces que el instrumento miente.
   */
  '/motor_status': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    atascado_izquierdo: false, atascado_derecho: false, fallo: false,
    temperatura_izquierdo: 27.5, temperatura_derecho: 28.3,
    estado_termico_izquierdo: 0, estado_termico_derecho: 0,
    // -1.0 = «no se sabe», que NO es «no hay atasco».
    antiguedad_atasco_s: -1.0, antiguedad_fallo_s: 8.0, antiguedad_termico_s: 12.0,
  }),
  // Sin `header`: `Encoder.msg` no lo lleva. Y los ticks van CON SIGNO aqui
  // porque el driver ya deshace el sin-signo de 32 bits del RVR.
  '/encoders': () => ({ left_wheel_count: 2338, right_wheel_count: 2340 }),
  '/color': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    rgb_color: [255, 224, 208], confianza: 0.0, color: 'desconocido',
  }),
  '/collision_monitor_state': () => (
    frenandoParar ? { action_type: 1, polygon_name: 'invalid source' }
      : aproximacion ? { action_type: 3, polygon_name: 'Aproximacion' }
        : frenando ? { action_type: 2, polygon_name: 'Precaucion' }
          : { action_type: 0, polygon_name: '' }),
  /*
   * 🆕 2026-08-11. Por defecto: sondeo ENCENDIDO (el driver trae
   * `ir_sondeo_hz: 1.0`), lectura fresca y nadie cerca — o sea los cuatro
   * sensores en 255, que es como se ve un aula normal.
   *
   * 🔴 `--conduciendo-ir` produce el caso que ningun otro doble sabia hacer: el
   *    robot MOVIENDOSE sin que nadie se lo haya mandado desde la web. Es la
   *    unica forma de estrenar el camino de pintado `POSIBLE`, que hasta hoy no
   *    lo producia ninguna causa.
   */
  '/estado_ir': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    crudo: 0xFFFFFFFF, sensor_0: 255, sensor_1: 255, sensor_2: 255, sensor_3: 255,
    lecturas_validas: true, antiguedad_lectura_s: 0.3,
    ultimo_codigo: 0, hay_mensaje: false, antiguedad_mensaje_s: -1.0,
    modo: conduciendoIR ? 'following' : 'off', far_code: 0, near_code: 0,
    conduciendo_por_ir: conduciendoIR,
  }),
  '/estado_robot': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    latido: 100 + t, parada_emergencia: false, rvr_responde: true,
    antiguedad_muestra_s: 0.06, antiguedad_odom_s: 0.06,
    reanudaciones_fallidas: 0, color_activo: luzEncendida,
    /*
     * 🆕 2026-08-11. El robot lo duplico aqui desde `/estado_ir` el mismo dia:
     * este es el canal barato, y es de donde lo leen la baldosa del muro y la
     * pantalla de «por que no obedece». Si el doble solo lo mandara en
     * `/estado_ir`, las dos saldrian diciendo que el robot esta parado.
     */
    conduciendo_por_ir: conduciendoIR,
  }),
  '/scan': () => {
    // 🔴 250 puntos, NO 255 ni 260: el tamaño NO es una constante entre
    //    sesiones, y un cliente que lo asuma se rompe 1 de cada 3 veces.
    const n = 250
    const ranges = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      // Un cuarto rectangular de ~3x2,4 m con el robot dentro.
      return Math.min(1.5 / Math.abs(Math.cos(a) || 1e-3), 1.2 / Math.abs(Math.sin(a) || 1e-3), 6)
    })
    return {
      header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'laser' },
      angle_min: -Math.PI, angle_max: Math.PI, angle_increment: (Math.PI * 2) / n,
      time_increment: 0, scan_time: 0.084, range_min: 0.1, range_max: 8.0,
      ranges, intensities: [],
    }
  },
}

/* ── WebSocket a mano ──────────────────────────────────────────────────── */
/**
 * Un marco de CIERRE, con codigo y motivo. Hace falta desde la Fase B (A7):
 * el robot rechaza asi, y el cliente tiene que saber distinguirlo.
 *
 * 🔴 El codigo va en los DOS PRIMEROS BYTES, big-endian, y el motivo detras en
 *    UTF-8. Mandar solo el motivo deja al navegador con un 1005 «sin codigo», y
 *    entonces el cliente no puede distinguir «credencial mala» de «se cayo el
 *    WiFi» — que es justo la distincion que `rechazo.ts` existe para hacer.
 */
function marcoCierre(codigo, motivo = '') {
  const texto = Buffer.from(motivo, 'utf8')
  const carga = Buffer.alloc(2 + texto.length)
  carga.writeUInt16BE(codigo, 0)
  texto.copy(carga, 2)
  return Buffer.concat([Buffer.from([0x88, carga.length]), carga])
}

function marco(texto) {
  const carga = Buffer.from(texto, 'utf8')
  const n = carga.length
  let cab
  if (n < 126) { cab = Buffer.from([0x81, n]) }
  else if (n < 65536) { cab = Buffer.alloc(4); cab[0] = 0x81; cab[1] = 126; cab.writeUInt16BE(n, 2) }
  else { cab = Buffer.alloc(10); cab[0] = 0x81; cab[1] = 127; cab.writeBigUInt64BE(BigInt(n), 2) }
  return Buffer.concat([cab, carga])
}

/** Desenmarca lo que manda el navegador (siempre enmascarado). Solo texto. */
function desmarcar(b) {
  const salida = []
  let i = 0
  while (i + 2 <= b.length) {
    const fin = b[i + 1] & 0x80
    let n = b[i + 1] & 0x7f
    let j = i + 2
    if (n === 126) { n = b.readUInt16BE(j); j += 2 }
    else if (n === 127) { n = Number(b.readBigUInt64BE(j)); j += 8 }
    let mask = null
    if (fin) { mask = b.subarray(j, j + 4); j += 4 }
    const carga = Buffer.from(b.subarray(j, j + n))
    if (mask) for (let k = 0; k < carga.length; k++) carga[k] ^= mask[k % 4]
    const opcode = b[i] & 0x0f
    if (opcode === 0x01) salida.push(carga.toString('utf8'))
    /*
     * 🔴 EL MARCO DE CIERRE (0x8) SE DESCARTABA EN SILENCIO, y eso dejaba
     *    colgado a cualquier cliente que cerrara educadamente: manda su cierre,
     *    espera el del servidor, y no llega nunca.
     *
     *    No se habia notado porque el navegador acaba cerrando por su cuenta y
     *    el doble se usa a ojo. Aparecio al escribir la PRIMERA prueba
     *    automatica que espera al `onclose`: cinco de siete agotaban el plazo,
     *    y las dos que pasaban eran justo las que cierra el SERVIDOR.
     *
     * 📝 Un doble solo revela lo que alguien le pide. Este llevaba meses
     *    sirviendo pantallas con esto roto.
     */
    if (opcode === 0x08) salida.cerrar = true
    i = j + n
  }
  return salida
}

const servidor = createServer((_, res) => { res.writeHead(426); res.end('solo WebSocket') })

servidor.on('upgrade', (req, socket) => {
  const clave = req.headers['sec-websocket-key']
  const acepta = createHash('sha1')
    .update(clave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  /*
   * 🔴 Se responde SOLO con algo que el cliente haya ofrecido, nunca un valor
   *    fijo. El servidor real (tornado) ejecuta
   *        assert self.selected_subprotocol in subprotocols
   *    y saltarselo da un HTTP 500 en vez de un cierre con motivo. Aqui no hay
   *    assert que lo cace —por eso este doble NO basta—, pero imitar la regla
   *    evita acostumbrar al cliente a algo que el robot no hara.
   */
  const ofrecidos = (req.headers['sec-websocket-protocol'] ?? '')
    .split(',').map((x) => x.trim()).filter((x) => x !== '')
  const testigo = ofrecidos.find((x) => x.startsWith('atriz.token.')) ?? null
  const elegido = ofrecidos.includes('atriz.v1') ? 'atriz.v1' : (ofrecidos[0] ?? null)

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
    + `Connection: Upgrade\r\nSec-WebSocket-Accept: ${acepta}\r\n`
    + (elegido === null ? '' : `Sec-WebSocket-Protocol: ${elegido}\r\n`)
    + '\r\n',
  )

  /*
   * Los rechazos van DESPUES del apreton, como en el robot: un cierre con
   * motivo no cabe antes. Por eso el cliente ve `onopen` y LUEGO `onclose`, y
   * por eso no puede tomar `onopen` como «conectado» (evidencia 124).
   */
  if (rechazarCon !== 0) {
    console.log(`· RECHAZO forzado con ${rechazarCon}`)
    socket.write(marcoCierre(rechazarCon, 'rechazo de mentira, pedido con --rechazar'))
    socket.end()
    return
  }
  if (exigeTestigo && testigo === null) {
    console.log('· RECHAZADO: no llego ningun testigo')
    socket.write(marcoCierre(4401, 'no llego ningun testigo (doble con --exige-testigo)'))
    socket.end()
    return
  }

  const suscritos = new Set()
  /** El temporizador del objetivo en curso, si lo hay. */
  let objetivo = null
  // ⚠️ NO se verifica la firma. Ver la cabecera de las banderas del testigo.
  console.log(`· cliente conectado${testigo === null ? '' : ' (con testigo, SIN verificar)'}`)

  socket.on('data', (b) => {
    const marcos = desmarcar(b)
    // El apreton de cierre se contesta: eco del cierre y adios.
    if (marcos.cerrar === true) { socket.write(marcoCierre(1000, '')); socket.end(); return }
    for (const txt of marcos) {
      let m
      try { m = JSON.parse(txt) } catch { continue }

      if (m.op === 'subscribe') {
        suscritos.add(m.topic)
        console.log(`  subscribe ${m.topic}`)
        // Los latcheados llegan de inmediato, como en el robot.
        if (m.topic === '/estado_navegacion') socket.write(marco(JSON.stringify({
          op: 'publish', topic: m.topic, msg: estadoAhora(),
        })))
        else if (CUERPOS[m.topic] !== undefined) socket.write(marco(JSON.stringify({
          op: 'publish', topic: m.topic, msg: CUERPOS[m.topic](),
        })))
      } else if (m.op === 'unsubscribe') {
        suscritos.delete(m.topic)
      } else if (m.op === 'call_service') {
        console.log(`  call_service ${m.service} ${JSON.stringify(m.args)}`)
        const arrancar = m.args?.data === true
        if (m.service === '/enable_color') {
          luzEncendida = m.args?.data === true
          socket.write(marco(JSON.stringify({
            op: 'service_response', id: m.id, service: m.service, result: true,
            values: { success: true, message: luzEncendida ? 'luz encendida' : 'luz apagada' },
          })))
        } else if (m.service === '/get_rgbc_sensor_values') {
          // Pantalla ROJA a tope, medida en los dos estados de la luz.
          /*
           * 🔴 CON RUIDO, Y NO ES ADORNO. Sin el, dos lecturas seguidas son
           *    IDENTICAS y una pantalla que sondea en continuo se ve **igual**
           *    que una que dispara una vez: el doble no distinguiria el defecto
           *    que se acaba de arreglar del arreglo. Y ademas es lo que hace el
           *    sensor de verdad: sobre una pantalla quieta se midieron 2-4
           *    cuentas de dispersion.
           *
           * ⚠️ `t` avanza 1 por segundo; se combina con el contador de llamadas
           *    para que dos lecturas dentro del mismo segundo tampoco coincidan.
           *    Nada de `Math.random()`: un doble que no se puede repetir no
           *    sirve para comparar dos capturas.
           */
          lecturasColor += 1
          const ruido = (k) => ((t * 7 + lecturasColor * 3 + k * 11) % 7) - 3
          const v = luzEncendida
            ? { red_channel_value: 817 + ruido(1), green_channel_value: 1238 + ruido(2), blue_channel_value: 607 + ruido(3), clear_channel_value: 1238 + ruido(4) }
            : { red_channel_value: 512 + ruido(1), green_channel_value: 100 + ruido(2), blue_channel_value: 15 + ruido(3), clear_channel_value: 150 + ruido(4) }
          socket.write(marco(JSON.stringify({
            op: 'service_response', id: m.id, service: m.service, result: true,
            values: { ...v, success: true,
              message: luzEncendida ? '' : 'la luz del sensor esta apagada' },
          })))
        } else if (m.service === '/pedir_slam' || m.service === '/pedir_nav') {
          // Mueve el guion, para que pulsar el botón tenga efecto visible.
          paso = arrancar ? 1 : 0
          socket.write(marco(JSON.stringify({
            op: 'service_response', id: m.id, service: m.service, result: true,
            values: { success: true, message: arrancar ? 'petición aceptada' : 'parando' },
          })))
        } else {
          socket.write(marco(JSON.stringify({
            op: 'service_response', id: m.id, service: m.service, result: true, values: {},
          })))
        }
      } else if (m.op === 'send_action_goal') {
        /*
         * ═══════════════════════════════════════════════════════════════════
         * UN OBJETIVO DE NAV2: unos partes de avance y UN desenlace
         * ═══════════════════════════════════════════════════════════════════
         * 🔴 La distincion que hay que respetar, y que el transporte ya mide
         *    contra el robot: llegan VARIOS `action_feedback` y **un solo**
         *    `action_result`. Confundirlos cerraria la navegacion en el primer
         *    parte de progreso.
         *
         * 🔴 Y AL FALLAR, `values` LLEGA COMO CADENA, no como objeto — medido
         *    contra el robot («No action server available»). Mandar un objeto
         *    aqui dejaria sin ejercitar la rama que lo convierte en mensaje.
         */
        console.log(`  send_action_goal ${m.action} -> ${objetivoAcaba}`)
        navegando = 1
        let quedan = 1.4
        clearInterval(objetivo)
        objetivo = setInterval(() => {
          navegando += 1
          quedan = Math.max(0, quedan - 0.3)
          if (navegando <= 5) {
            socket.write(marco(JSON.stringify({
              op: 'action_feedback', id: m.id, action: m.action,
              values: { feedback: { distance_remaining: quedan } },
            })))
            return
          }
          clearInterval(objetivo)
          objetivo = null
          if (objetivoAcaba === 'falla') {
            socket.write(marco(JSON.stringify({
              op: 'action_result', id: m.id, action: m.action, result: false,
              // El mensaje real de un aborto de `bt_navigator`, no uno inventado.
              values: 'Goal was aborted',
            })))
          } else {
            socket.write(marco(JSON.stringify({
              op: 'action_result', id: m.id, action: m.action, result: true,
              values: { result: {} },
            })))
          }
        }, 700)
      } else if (m.op === 'cancel_action_goal') {
        /*
         * 🔴 CANCELAR **NO** CIERRA LA ESPERA POR SU CUENTA: el robot manda
         *    ademas un `action_result` con estado de cancelado, y es ese el que
         *    la cierra. Si este doble no lo mandara, la pantalla se quedaria
         *    con el objetivo colgado hasta el plazo — y pareceria un fallo del
         *    boton de cancelar.
         */
        console.log(`  cancel_action_goal ${m.action}`)
        clearInterval(objetivo)
        objetivo = null
        navegando = 0
        socket.write(marco(JSON.stringify({
          op: 'action_result', id: m.id, action: m.action, result: false,
          values: 'Goal was canceled',
        })))
      }
    }
  })

  // 1 Hz, el ritmo real del supervisor.
  const reloj = setInterval(() => {
    t += 1
    if (suscritos.has('/estado_navegacion')) socket.write(marco(JSON.stringify({
      op: 'publish', topic: '/estado_navegacion', msg: estadoAhora(),
    })))
    for (const [topic, cuerpo] of Object.entries(CUERPOS)) {
      if (suscritos.has(topic)) {
        socket.write(marco(JSON.stringify({ op: 'publish', topic, msg: cuerpo() })))
      }
    }
  }, 1000)

  // Cambia de escena cada 6 s, salvo que se haya fijado un estado.
  const escena = setInterval(() => {
    if (fijoSlam === null && fijoNav === null) paso++
  }, 6000)

  // 🔴 `objetivo` tambien: un temporizador que sobrevive al socket escribe en
  //    un descriptor muerto en cada tic. Es la forma del `finally` que faltaba.
  const parar = () => { clearInterval(reloj); clearInterval(escena); clearInterval(objetivo) }
  socket.on('close', () => { parar(); console.log('· cliente fuera') })
  socket.on('error', parar)
})

servidor.listen(PUERTO, () => {
  const real = servidor.address().port
  console.log(`rosbridge DE MENTIRA en ws://localhost:${real}`)
  console.log(fijoSlam || fijoNav
    ? `  fijo: slam=${fijoSlam ?? 'auto'} nav=${fijoNav ?? 'auto'}${sinMapa ? ' · sin mapa' : ''}`
    : '  ciclando el guion cada 6 s')
  console.log('🔴 lo que se vea aquí queda NO VERIFICADO hasta repetirlo contra rvr-01')
})
