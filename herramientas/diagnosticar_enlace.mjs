/**
 * «LA WEB NO VE AL ROBOT» — RECORRE LA CADENA Y DICE QUE ESLABON ESTA ROTO.
 *
 *     node herramientas/diagnosticar_enlace.mjs [--robot N]
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * El 2026-08-16 la plataforma no enseñaba a rvr-01. Desde el robot **todo estaba
 * bien y medido**: servicios arriba, RVR hablando, la puerta del testigo
 * verificada en las dos direcciones. Desde el PC no habia forma de saber donde
 * se cortaba: hubo que escribir tres guiones sueltos para descubrir que la causa
 * era **que nadie habia iniciado sesion**.
 *
 * Es el hermano de `diagnosticar_mudo.sh` del robot, y con el mismo proposito:
 * **partir el diagnostico en dos** para que nadie cruce el laboratorio a mirar
 * un robot que no tiene nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 NO PRUEBA DIRECCIONES ESCRITAS A MANO, Y ES LA LECCION DEL MISMO DIA
 * ═══════════════════════════════════════════════════════════════════════════
 * Ese dia probe `192.168.1.58` porque la copie de un documento viejo, se colgo
 * 10 s, y lo reporte como *«sigue siendo un agujero negro, la firma exacta de la
 * evidencia 74»*. **Falso**: el robot no anuncia esa direccion, no hay nadie en
 * ella, y el cuelgue era un SYN a una IP vacia de la LAN. Habria mandado a
 * alguien a buscar un fallo de red del robot que no existe.
 *
 * Asi que aqui **solo se prueba lo que el nombre RESUELVE de verdad**, y se dice
 * cuantas direcciones son — que es justo lo que la evidencia 74 vigila.
 *
 * ⚠️ Y OJO CON EL RESOLUTOR: `nslookup` y `Resolve-DnsName` preguntan al
 *    servidor DNS y **no hacen mDNS**, asi que sobre un `.local` dicen «no
 *    existe» mientras el navegador lo abre en 41 ms. Medido el mismo dia, en las
 *    dos direcciones. Aqui se usa `dns.lookup` (getaddrinfo), que es lo que usan
 *    Node y el navegador.
 *
 * ⚠️ LO QUE ESTO **NO** PUEDE DECIR: si el WebSocket abre DESDE EL NAVEGADOR.
 *    Node y Chromium no son el mismo cliente y este proyecto tiene escrito que
 *    no se transfieren —`ping`, `Resolve-DnsName` y `getent` dieron verde los
 *    tres con el navegador colgado—. Cuando todo esto sale en verde y la
 *    pantalla sigue sin ver al robot, **el siguiente testigo es el navegador**.
 */

import { readFileSync } from 'node:fs'
import { createPrivateKey, sign } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('../frontend/', import.meta.url))
const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : d
}
const ROBOT = Number(arg('--robot', '1'))
const WEB = arg('--web', 'http://localhost:3000')
const PUERTO_ROSBRIDGE = 9090

let roto = null
const paso = (n) => console.log(`\n${n}`)
const ok = (t) => console.log(`  ✅ ${t}`)
const mal = (t, remedio) => {
  console.log(`  🔴 ${t}`)
  if (roto === null) roto = { t, remedio }
}
const nota = (t) => console.log(`  ⚠️  ${t}`)

// ── 1 · El servidor de desarrollo ────────────────────────────────────────────
paso('1 · EL SERVIDOR DE LA WEB')
let webViva = false
try {
  const r = await fetch(WEB, { signal: AbortSignal.timeout(8000) })
  webViva = r.ok
  webViva ? ok(`${WEB} contesta ${r.status}`) : mal(`${WEB} contesta ${r.status}`, 'mira la consola de `npm run dev`')
} catch (e) {
  mal(`${WEB} no contesta (${e.name})`, 'arranca `npm run dev` dentro de frontend/')
}

// ── 2 · El interruptor y la clave ────────────────────────────────────────────
paso('2 · LO QUE ESTE PC NECESITA PARA FIRMAR')
let env = ''
try { env = readFileSync(`${RAIZ}.env.local`, 'utf8') } catch {
  mal('no hay frontend/.env.local', 'genera la pareja: node herramientas/generar_clave.mjs')
}
const exigido = /^NEXT_PUBLIC_ATRIZ_TESTIGO\s*=\s*1\s*$/m.test(env)
if (exigido) ok('NEXT_PUBLIC_ATRIZ_TESTIGO=1 — los robots exigen testigo')
else nota('NEXT_PUBLIC_ATRIZ_TESTIGO no esta a 1: la web abrira SIN testigo.\n'
  + '      Contra un robot ya parcheado eso da 4401. Contra uno sin parchear, funciona.')

let clave = null
const pem = env.match(/^ATRIZ_CLAVE\s*=\s*(.*)$/m)?.[1]?.trim()
  ?.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
if (pem === undefined) {
  if (exigido) mal('no hay ATRIZ_CLAVE', 'node herramientas/generar_clave.mjs')
} else {
  try {
    clave = createPrivateKey(pem)
    // ⚠️ La clave NO se imprime nunca, ni en trozos.
    ok(`ATRIZ_CLAVE presente y valida (${clave.asymmetricKeyType})`)
  } catch (e) { mal(`ATRIZ_CLAVE no es una clave privada: ${e.message}`, 'vuelve a generarla') }
}

// ── 3 · La sesion ────────────────────────────────────────────────────────────
paso('3 · LA SESION DE ESTE NAVEGADOR')
nota('esto mira la sesion del proceso que corre este guion, NO la de tu pestaña.\n'
  + '      Una sesion vive en una cookie del navegador: aqui siempre saldra que no hay.')
if (webViva) {
  try {
    const r = await fetch(`${WEB}/api/sesion/testigo?robot=${ROBOT}`, { signal: AbortSignal.timeout(8000) })
    if (r.status === 401) ok('/api/sesion/testigo pide sesion (401) — el servidor esta bien montado')
    else if (r.ok) ok('firma testigos sin cookie (hay sesion o el endpoint no la exige)')
    else mal(`/api/sesion/testigo contesta ${r.status}`, 'mira la consola de `npm run dev`')
  } catch (e) { mal(`no pude preguntar por el testigo (${e.name})`, '') }
}

// ── 4 · El nombre del robot ──────────────────────────────────────────────────
const NOMBRE = `rvr-${String(ROBOT).padStart(2, '0')}.local`
paso(`4 · EL NOMBRE DEL ROBOT — ${NOMBRE}`)
let direcciones = []
try {
  direcciones = await lookup(NOMBRE, { all: true })
  for (const d of direcciones) console.log(`     · ${d.address} (IPv${d.family})`)
  if (direcciones.length === 1) ok('UNA sola direccion — la evidencia 74 sigue cerrada')
  else mal(`${direcciones.length} direcciones: el navegador puede colgarse ~21 s en la que no sirve`,
    'en el robot: una .network por SSID, y en avahi use-ipv6=no MAS publish-aaaa-on-ipv4=no')
} catch (e) {
  mal(`getaddrinfo no resuelve ${NOMBRE} (${e.code})`,
    'comprueba que el robot este encendido y en esta red, o pon su IP en «dónde buscar»')
}

// ── 5 · El puerto ────────────────────────────────────────────────────────────
if (direcciones.length > 0) {
  paso(`5 · EL PUERTO ${PUERTO_ROSBRIDGE}`)
  for (const { address } of direcciones) {
    const abierto = await new Promise((r) => {
      const s = connect({ host: address, port: PUERTO_ROSBRIDGE, timeout: 6000 })
      s.on('connect', () => { s.destroy(); r(true) })
      s.on('timeout', () => { s.destroy(); r(false) })
      s.on('error', () => r(false))
    })
    abierto
      ? ok(`${address}:${PUERTO_ROSBRIDGE} abierto`)
      : mal(`${address}:${PUERTO_ROSBRIDGE} no abre`,
        'en el robot: systemctl status atriz-robot, y scripts/diagnosticar_mudo.sh')
  }
}

// ── 6 · La puerta del testigo, con control negativo ──────────────────────────
if (clave !== null && direcciones.length > 0 && roto === null) {
  paso('6 · LA PUERTA DEL TESTIGO (con control negativo)')
  const b64u = (b) => Buffer.from(b).toString('base64url')
  const iat = Math.floor(Date.now() / 1000)
  const cab = b64u(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }))
  const cuerpo = `${cab}.${b64u(JSON.stringify({ sub: 'diagnostico', rob: ROBOT, exp: iat + 600, iat }))}`
  const jwt = `${cuerpo}.${b64u(sign(null, Buffer.from(cuerpo, 'ascii'), clave))}`

  const probar = (protocolos) => new Promise((r) => {
    const url = `ws://${NOMBRE}:${PUERTO_ROSBRIDGE}`
    const s = protocolos === null ? new WebSocket(url) : new WebSocket(url, protocolos)
    const plazo = setTimeout(() => { try { s.close() } catch {} ; r({ e: 'SE COLGO' }) }, 10000)
    s.onopen = () => { clearTimeout(plazo); setTimeout(() => { try { s.close() } catch {} ; r({ e: 'ABRE' }) }, 2000) }
    s.onclose = (x) => { if (x.code !== 1000 && x.code !== 1005) { clearTimeout(plazo); r({ e: `CIERRA ${x.code}`, motivo: x.reason }) } }
    s.onerror = () => { clearTimeout(plazo); r({ e: 'ERROR' }) }
  })

  const con = await probar(['atriz.v1', `atriz.token.${jwt}`])
  con.e === 'ABRE'
    ? ok('CON testigo firmado por este PC: ABRE — la clave casa con la del robot')
    : mal(`CON testigo: ${con.e} ${con.motivo ?? ''}`,
      con.e.startsWith('CIERRA 4401')
        ? 'la clave de este PC NO es pareja de /etc/atriz/testigo.pub — republicala: node herramientas/publicar_clave.mjs'
        : 'mira el journal del robot')

  const sin = await probar(null)
  // 🔴 EL CONTROL NEGATIVO: sin el, «me admitio» no distingue una clave buena de
  //    una puerta abierta de par en par.
  sin.e.startsWith('CIERRA 4401')
    ? ok(`SIN testigo: rechazado (4401) — «${sin.motivo}»`)
    : mal(`SIN testigo: ${sin.e} — la puerta NO esta cerrando, asi que el ✅ de arriba no prueba nada`,
      'en el robot: comprueba que robot.launch.py lanza atriz_rosbridge.py')
}

// ── Veredicto ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(74))
if (roto === null) {
  console.log('✅ LA CADENA ESTA ENTERA DESDE ESTE PC.')
  console.log('   Si la pantalla sigue sin ver al robot, lo que falta es INICIAR SESION en')
  console.log('   el navegador: sin ella no se firma testigo, y sin testigo el transporte ni')
  console.log('   siquiera abre el socket. El muro te lo dice desde el 2026-08-16.')
  console.log(`   -> ${WEB}/entrar  y luego  ${WEB}/flota`)
  console.log('\n⚠️  Y si YA has entrado y sigue sin verse: el siguiente testigo es EL NAVEGADOR.')
  console.log('   Node y Chromium no son el mismo cliente, y este proyecto tiene medido que')
  console.log('   pueden discrepar. Abre la consola del navegador y mira el WebSocket.')
} else {
  console.log(`🔴 SE CORTA AQUI: ${roto.t}`)
  if (roto.remedio !== '') console.log(`   -> ${roto.remedio}`)
  console.log('\n📌 Nota de atribucion: TODO lo de arriba menos los pasos 4-6 es del lado del PC.')
  console.log('   Antes de cruzar el laboratorio, comprueba que el corte no este aqui.')
}
process.exit(roto === null ? 0 : 1)
