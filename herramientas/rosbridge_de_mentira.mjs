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
 *
 * Después: abrir http://localhost:3000/robot/rvr-01/navegar con la dirección
 * apuntando a `ws://localhost:9090`.
 */

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'

const PUERTO = 9090

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
const CUERPOS = {
  '/odom': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: 'odom' },
    child_frame_id: 'base_footprint',
    pose: { pose: {
      position: { x: 0.30 + t * 0.001, y: -0.02, z: 0 },
      orientation: { x: 0, y: 0, z: 0.0011, w: 1 },
    } },
    twist: { twist: { linear: { x: 0.100, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0.002 } } },
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
      : frenando ? { action_type: 2, polygon_name: 'Precaucion' }
        : { action_type: 0, polygon_name: '' }),
  '/estado_robot': () => ({
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    latido: 100 + t, parada_emergencia: false, rvr_responde: true,
    antiguedad_muestra_s: 0.06, antiguedad_odom_s: 0.06,
    reanudaciones_fallidas: 0, color_activo: luzEncendida,
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
    if ((b[i] & 0x0f) === 0x01) salida.push(carga.toString('utf8'))
    i = j + n
  }
  return salida
}

const servidor = createServer((_, res) => { res.writeHead(426); res.end('solo WebSocket') })

servidor.on('upgrade', (req, socket) => {
  const clave = req.headers['sec-websocket-key']
  const acepta = createHash('sha1')
    .update(clave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
    + `Connection: Upgrade\r\nSec-WebSocket-Accept: ${acepta}\r\n\r\n`,
  )

  const suscritos = new Set()
  console.log('· cliente conectado')

  socket.on('data', (b) => {
    for (const txt of desmarcar(b)) {
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
          const v = luzEncendida
            ? { red_channel_value: 817, green_channel_value: 1238, blue_channel_value: 607, clear_channel_value: 1238 }
            : { red_channel_value: 512, green_channel_value: 100, blue_channel_value: 15, clear_channel_value: 150 }
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

  socket.on('close', () => { clearInterval(reloj); clearInterval(escena); console.log('· cliente fuera') })
  socket.on('error', () => { clearInterval(reloj); clearInterval(escena) })
})

servidor.listen(PUERTO, () => {
  console.log(`rosbridge DE MENTIRA en ws://localhost:${PUERTO}`)
  console.log(fijoSlam || fijoNav
    ? `  fijo: slam=${fijoSlam ?? 'auto'} nav=${fijoNav ?? 'auto'}${sinMapa ? ' · sin mapa' : ''}`
    : '  ciclando el guion cada 6 s')
  console.log('🔴 lo que se vea aquí queda NO VERIFICADO hasta repetirlo contra rvr-01')
})
