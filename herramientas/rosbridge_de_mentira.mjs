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
    slam_latcheado: latSlam,
    nav_latcheado: latNav,
  }
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
        if (m.topic === '/estado_navegacion') socket.write(marco(JSON.stringify({
          op: 'publish', topic: m.topic, msg: estadoAhora(),
        })))
      } else if (m.op === 'unsubscribe') {
        suscritos.delete(m.topic)
      } else if (m.op === 'call_service') {
        console.log(`  call_service ${m.service} ${JSON.stringify(m.args)}`)
        const arrancar = m.args?.data === true
        if (m.service === '/pedir_slam' || m.service === '/pedir_nav') {
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
    if (!suscritos.has('/estado_navegacion')) return
    socket.write(marco(JSON.stringify({
      op: 'publish', topic: '/estado_navegacion', msg: estadoAhora(),
    })))
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
