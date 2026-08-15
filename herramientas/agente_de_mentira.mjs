/**
 * UN AGENTE DE SESIÓN DE MENTIRA, para probar el Taller sin robot.
 *
 *     node herramientas/agente_de_mentira.mjs
 *     node herramientas/agente_de_mentira.mjs --ocupado luis
 *     node herramientas/agente_de_mentira.mjs --sin-reloj
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LO QUE ESTE DOBLE **NO** PRUEBA, Y HAY QUE LEERLO ANTES DE FIARSE
 * ═══════════════════════════════════════════════════════════════════════════
 * **Node no tiene PTY.** Aquí no hay `pty.fork()`, ni señales de verdad, ni un
 * proceso hijo: hay transcripciones enlatadas reproducidas a la cadencia real.
 *
 * Este doble prueba que **la web no se rompe** ante cada estado. Que el ROBOT
 * haga eso lo prueba la Pi, y nada más. Los tres requisitos medidos del taller
 * —PTY en vez de tubería, `input()` bidireccional, y las señales— **no se
 * verifican aquí**, por construcción.
 *
 * 📝 Y el aviso no es teórico: el doble de rosbridge de este mismo repositorio
 *    se quedó atrás de los nombres de `/encoders` y durante un rato pareció que
 *    la web estaba rota. Un doble que miente es peor que no tener doble.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LO QUE SÍ HACE DE VERDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * **Verifica la firma Ed25519 del testigo**, con la clave pública derivada de la
 * misma `ATRIZ_CLAVE` que usa el servidor. Así los cuatro rechazos —sin testigo,
 * firma mala, otro robot, reloj sin hora— se recorren en el PC, **con su control
 * positivo al lado**. Sin ese control, «rechaza» no se distingue de «rechaza
 * siempre».
 */

import { createHash, createPublicKey, verify } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const PUERTO = 9443

/* ── Argumentos ────────────────────────────────────────────────────────── */
const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i === -1 ? null : process.argv[i + 1]
}
const tiene = (n) => process.argv.includes(n)

/** `--ocupado luis` → la ranura la tiene otro. El caso de concurrencia. */
const ocupadoPor = arg('--ocupado')
/** `--sin-reloj` → la Pi acaba de arrancar y NTP no ha contestado (cierre 1013). */
const sinReloj = tiene('--sin-reloj')
/** `--sin-firma` → acepta cualquier testigo. Para aislar fallos de transporte. */
const sinFirma = tiene('--sin-firma')
/** `--tope-salida` → escupe rápido y recorta, con su contador. */
const topeSalida = tiene('--tope-salida')
/** `--tope-pared N` → la cuenta atrás llega a cero de verdad. */
const topePared = Number(arg('--tope-pared') ?? 600)
/** `--muere-a-mitad` → corta el socket sin cerrar: prueba el reenganche. */
const muereAMitad = tiene('--muere-a-mitad')
/** `--kill-9` → termina dejando el barrido encendido, y lo dice. */
const kill9 = tiene('--kill-9')
const robot = Number(arg('--robot') ?? 7)

/* ── La clave pública, de la misma ATRIZ_CLAVE que firma el servidor ────── */
function publicaDelEnv() {
  try {
    const env = readFileSync(join(AQUI, '..', 'frontend', '.env.local'), 'utf8')
    const linea = env.split('\n').find((l) => l.trimStart().startsWith('ATRIZ_CLAVE='))
    if (linea === undefined) return null
    const pem = linea.slice(linea.indexOf('=') + 1).trim()
      .replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
    return createPublicKey({ key: pem, format: 'pem' })
  } catch {
    return null
  }
}
const PUBLICA = publicaDelEnv()
if (PUBLICA === null && !sinFirma) {
  console.error('🔴 No he podido derivar la clave pública de frontend/.env.local.')
  console.error('   Sin ella este doble no puede verificar nada, y verificar de verdad es')
  console.error('   lo único que hace de verdad. Genera una con:')
  console.error('     node herramientas/generar_clave.mjs')
  console.error('   O arráncalo con --sin-firma si lo que quieres es aislar otro fallo.')
  process.exit(1)
}

/* ── Las prácticas: las de VERDAD del robot, leídas del repo vecino ─────── */
/**
 * 🔴 SI NO ESTÁ EL REPO DEL ROBOT AL LADO, LA LISTA VA VACÍA Y SE DICE.
 *
 * Inventar nombres de práctica sería exactamente el fallo que este trabajo
 * encontró: `espacio.ts` listaba cinco ficheros que no existen en el robot. Un
 * doble que rellena huecos con datos plausibles hace creer que la cadena
 * funciona, y el fallo aparece en el aula.
 */
function practicas() {
  const dir = join(AQUI, '..', '..', 'Atriz_rvr', 'scripts', 'estudiantes')
  try {
    return readdirSync(dir)
      .filter((n) => n.endsWith('.py') && n !== 'atriz.py')
      .sort()
      .map((n) => ({ nombre: n, bytes: statSync(join(dir, n)).size }))
  } catch {
    console.warn('⚠️  No encuentro Atriz_rvr/scripts/estudiantes: la lista irá vacía.')
    console.warn('    Inventar nombres sería el fallo que este doble existe para no repetir.')
    return []
  }
}
const PRACTICAS = practicas()

function leerPractica(nombre) {
  const dir = join(AQUI, '..', '..', 'Atriz_rvr', 'scripts', 'estudiantes')
  try {
    return readFileSync(join(dir, nombre), 'utf8')
  } catch {
    return null
  }
}

/* ── Marcos WebSocket, calcados de rosbridge_de_mentira.mjs ─────────────── */
function marco(texto) {
  const carga = Buffer.from(texto, 'utf8')
  const n = carga.length
  let cab
  if (n < 126) { cab = Buffer.from([0x81, n]) }
  else if (n < 65536) { cab = Buffer.alloc(4); cab[0] = 0x81; cab[1] = 126; cab.writeUInt16BE(n, 2) }
  else { cab = Buffer.alloc(10); cab[0] = 0x81; cab[1] = 127; cab.writeBigUInt64BE(BigInt(n), 2) }
  return Buffer.concat([cab, carga])
}

/** Marco de cierre con su código y su motivo. El motivo NO es decorativo. */
function marcoCierre(codigo, motivo) {
  const texto = Buffer.from(motivo, 'utf8').subarray(0, 123)
  const carga = Buffer.alloc(2 + texto.length)
  carga.writeUInt16BE(codigo, 0)
  texto.copy(carga, 2)
  return Buffer.concat([Buffer.from([0x88, carga.length]), carga])
}

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

/* ── El testigo ────────────────────────────────────────────────────────── */
const PREFIJO = 'atriz.token.'
const SUBPROTOCOLO = 'atriz.v1'

/** Devuelve `{ok, codigo, motivo, sujeto}`. Mismo orden que atriz_testigo.py. */
function verificarTestigo(cabecera) {
  const ofrecidos = (cabecera ?? '').split(',').map((s) => s.trim())
  const conTestigo = ofrecidos.find((s) => s.startsWith(PREFIJO))
  if (conTestigo === undefined) {
    return { ok: false, codigo: 4401, motivo: 'no llegó ningún testigo' }
  }
  if (sinFirma) return { ok: true, sujeto: 'sin-firma' }

  const jwt = conTestigo.slice(PREFIJO.length)
  const partes = jwt.split('.')
  if (partes.length !== 3) {
    return { ok: false, codigo: 4403, motivo: 'el testigo no tiene la forma de un JWT' }
  }
  const [cab, cue, firma] = partes
  // 🔴 LA FIRMA PRIMERO. Leer los campos antes de verificarla es el fallo
  //    clásico de esta clase de código: quien manipule el testigo decide lo que
  //    lees. Mismo orden que `atriz_testigo.verificar`.
  let vale = false
  try {
    vale = verify(null, Buffer.from(`${cab}.${cue}`, 'ascii'), PUBLICA,
      Buffer.from(firma, 'base64url'))
  } catch { vale = false }
  if (!vale) return { ok: false, codigo: 4403, motivo: 'la firma no es válida' }

  let cuerpo
  try { cuerpo = JSON.parse(Buffer.from(cue, 'base64url').toString('utf8')) } catch {
    return { ok: false, codigo: 4403, motivo: 'el cuerpo del testigo no es JSON' }
  }
  if (cuerpo.rob !== robot) {
    return {
      ok: false, codigo: 4404,
      motivo: `este testigo es para el robot ${cuerpo.rob}, y este es el ${robot}`,
    }
  }
  // El reloj va DESPUÉS del robot, igual que en el verificador de verdad: si
  // cortocircuitara antes, un testigo del robot 7 abriría el 3 durante los ~18 s
  // que la Pi tarda en tener la hora — y los 16 arrancan a la vez.
  if (sinReloj) {
    return {
      ok: false, codigo: 1013,
      motivo: 'el robot aún no tiene la hora. Espera unos segundos y vuelve a intentarlo',
    }
  }
  return { ok: true, sujeto: String(cuerpo.sub ?? '?') }
}

/* ── Transcripciones enlatadas, con la cadencia REAL de cada práctica ───── */
/**
 * 🔴 Las cadencias no son inventadas: `05_sensor_color.py` imprime una fila cada
 *    0,5 s y el seguidor de línea gira a 10 Hz. Son las mismas que justifican el
 *    requisito del PTY, así que el doble tiene que reproducirlas o no probaría
 *    lo que dice probar.
 */
function guionDe(codigo, nombre) {
  if (topeSalida) {
    return { tipo: 'DILUVIO' }
  }
  if (nombre.startsWith('04_') || codigo.includes('input(')) {
    return {
      tipo: 'PREGUNTA',
      pasos: [
        { ms: 300, texto: 'Robot listo.\r\n' },
        { ms: 600, texto: 'Voy a girar 90 grados a la izquierda.\r\n' },
        { ms: 1500, texto: 'Mide con el transportador y escribe los grados: ' },
        { espera: true },
        { ms: 200, texto: '\r\nAnotado. Repito el giro.\r\n' },
        { ms: 1500, texto: '¿Cuántos grados esta vez? ' },
        { espera: true },
        { ms: 200, texto: '\r\nListo.\r\n' },
      ],
    }
  }
  if (nombre.startsWith('05_') || nombre.startsWith('11_')) {
    return { tipo: 'FILAS', cada: 500, texto: (i) => `R=${120 + i} G=${98 + i} B=${77 + i} claro=${900 + i * 3}\r\n` }
  }
  return {
    tipo: 'PASOS',
    pasos: [
      { ms: 300, texto: 'Conectando con el robot...\r\n' },
      { ms: 1200, texto: 'Robot listo.\r\n' },
      { ms: 500, texto: 'Avanzando 0.20 m/s durante 3 s...\r\n' },
      { ms: 3000, texto: 'Listo. Recorrido aproximado: 0.58 m\r\n' },
    ],
  }
}

/* ── El servidor ───────────────────────────────────────────────────────── */
const servidor = createServer((_, res) => { res.writeHead(426); res.end('solo WebSocket') })

/** La ranura es del PROCESO, no de la conexión: uno por robot. */
let ranura = ocupadoPor === null ? null : {
  sujeto: ocupadoPor, estado: 'CORRIENDO', pid: 4711,
  nombre: '03_cuadrado.py', desde_s: 214,
}

servidor.on('upgrade', (req, socket) => {
  const clave = req.headers['sec-websocket-key']
  const acepta = createHash('sha1')
    .update(clave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  const v = verificarTestigo(req.headers['sec-websocket-protocol'])

  /*
   * 🔴 SE DEVUELVE EL SUBPROTOCOLO SIEMPRE, incluso al ir a rechazar.
   *
   * Si no se devuelve ninguno, el navegador cierra por su cuenta con 1006 y
   * **sin motivo**: el alumno vería «la conexión se cortó» en vez de «esa
   * credencial es de otro robot». El rechazo tiene que llegar como un cierre
   * NUESTRO, con su código y su frase.
   */
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
    + `Connection: Upgrade\r\nSec-WebSocket-Accept: ${acepta}\r\n`
    + `Sec-WebSocket-Protocol: ${SUBPROTOCOLO}\r\n\r\n`,
  )

  if (!v.ok) {
    console.log(`· RECHAZADO ${v.codigo}: ${v.motivo}`)
    socket.write(marcoCierre(v.codigo, v.motivo))
    setTimeout(() => socket.destroy(), 50)
    return
  }

  const sujeto = v.sujeto
  console.log(`· ${sujeto} conectado`)
  const enviar = (o) => { try { socket.write(marco(JSON.stringify(o))) } catch { /* cerrado */ } }

  let temporizadores = []
  const luego = (ms, f) => { const t = setTimeout(f, ms); temporizadores.push(t); return t }
  const limpiar = () => { temporizadores.forEach(clearTimeout); temporizadores = [] }

  enviar({
    op: 'atriz_bienvenida',
    robot,
    sujeto,
    reloj_fiable: true,
    directorio: '/home/sphero/atriz_ws/src/Atriz_rvr/scripts/estudiantes',
    sesion: ranura,
  })

  let esperandoEntrada = null
  let descartadas = 0

  function terminar(motivo, extra = {}) {
    limpiar()
    ranura = null
    enviar({
      op: 'atriz_fin',
      motivo,
      codigo: motivo === 'SALIDA_NORMAL' ? 0 : null,
      duracion_s: 12,
      lineas_descartadas: descartadas,
      /*
       * 🔴 El efecto con sus campos honestos. `null` significa «no lo sé», que
       *    es distinto de `false`. Con --kill-9 el barrido queda ENCENDIDO, que
       *    es el objeto de estudio del ejercicio 5 de la práctica 99.
       */
      efecto: kill9
        ? { scan_llegaba: true, navegacion_en_marcha: false, stop_scan_llamado: true, odom_max_lineal: 0.0 }
        : { scan_llegaba: false, navegacion_en_marcha: null, stop_scan_llamado: false, odom_max_lineal: 0.0 },
      ...extra,
    })
    enviar({ op: 'atriz_estado', estado: 'LIBRE', sujeto: '', soy_el_dueno: false, pid: null })
  }

  function arrancar(codigo, nombre) {
    const pid = 5000 + Math.floor(codigo.length % 900)
    ranura = { sujeto, estado: 'CORRIENDO', pid, nombre, desde_s: 0 }
    const arrancoEn = Date.now()
    enviar({
      op: 'atriz_estado', estado: 'CORRIENDO', sujeto, soy_el_dueno: true, pid,
      nombre, huella: createHash('sha256').update(codigo).digest('hex').slice(0, 12),
      restante_s: topePared, lineas_descartadas: 0,
    })
    // El latido de 1 Hz: es lo que alimenta la cuenta atrás en la pantalla.
    const latido = setInterval(() => {
      const va = Math.round((Date.now() - arrancoEn) / 1000)
      const queda = topePared - va
      enviar({
        op: 'atriz_estado', estado: 'CORRIENDO', sujeto, soy_el_dueno: true, pid, nombre,
        restante_s: Math.max(0, queda), lineas_descartadas: descartadas,
      })
      if (queda <= 0) { clearInterval(latido); terminar('TOPE_PARED') }
    }, 1000)
    temporizadores.push(latido)

    const g = guionDe(codigo, nombre)
    if (g.tipo === 'DILUVIO') {
      let n = 0
      const chorro = setInterval(() => {
        for (let i = 0; i < 40; i += 1) enviar({ op: 'atriz_salida', texto: `linea ${n++}\r\n` })
        descartadas += 160
        enviar({ op: 'atriz_recorte', lineas_descartadas: descartadas, bytes_descartados: descartadas * 12 })
      }, 200)
      temporizadores.push(chorro)
      return
    }
    if (g.tipo === 'FILAS') {
      let i = 0
      const filas = setInterval(() => enviar({ op: 'atriz_salida', texto: g.texto(i++) }), g.cada)
      temporizadores.push(filas)
      if (muereAMitad) luego(4000, () => { console.log('· cortando el socket a lo bruto'); socket.destroy() })
      return
    }

    let t = 0
    for (const paso of g.pasos) {
      if (paso.espera) { esperandoEntrada = true; break }
      t += paso.ms
      luego(t, () => enviar({ op: 'atriz_salida', texto: paso.texto }))
    }
    if (g.tipo === 'PASOS') luego(t + 300, () => terminar('SALIDA_NORMAL'))
  }

  socket.on('data', (b) => {
    for (const txt of desmarcar(b)) {
      let m
      try { m = JSON.parse(txt) } catch { continue }

      if (m.op === 'atriz_listar') {
        enviar({
          op: 'atriz_listado',
          directorio: '/home/sphero/atriz_ws/src/Atriz_rvr/scripts/estudiantes',
          ficheros: PRACTICAS,
        })
      } else if (m.op === 'atriz_leer') {
        const texto = leerPractica(m.fichero)
        if (texto === null) {
          enviar({ op: 'atriz_rechazo', codigo: 'NO_ESTA', motivo: `no tengo «${m.fichero}»` })
        } else {
          enviar({ op: 'atriz_fichero', nombre: m.fichero, texto })
        }
      } else if (m.op === 'atriz_exec') {
        if (ranura !== null && ranura.sujeto !== sujeto) {
          // 🔴 NO se cierra la conexión: el segundo tiene que VER de quién es.
          enviar({
            op: 'atriz_rechazo', codigo: 'OCUPADO',
            motivo: `lo tiene ${ranura.sujeto} con «${ranura.nombre}»`,
          })
        } else {
          console.log(`  ejecutar ${m.nombre} (${m.codigo.length} bytes)`)
          arrancar(String(m.codigo ?? ''), String(m.nombre ?? 'mi_programa.py'))
        }
      } else if (m.op === 'atriz_stdin') {
        if (esperandoEntrada) {
          // El eco del PTY: lo que el alumno teclea vuelve por la salida, como
          // por SSH. Por eso la caja de entrada NO debe escribirlo localmente.
          enviar({ op: 'atriz_salida', texto: m.texto })
          esperandoEntrada = false
          luego(400, () => enviar({ op: 'atriz_salida', texto: 'Anotado.\r\n' }))
          luego(1200, () => terminar('SALIDA_NORMAL'))
        }
      } else if (m.op === 'atriz_signal' || m.op === 'atriz_parar') {
        if (ranura === null || ranura.sujeto !== sujeto) {
          enviar({ op: 'atriz_rechazo', codigo: 'NADA_CORRIENDO', motivo: 'no hay nada tuyo corriendo' })
        } else {
          const senal = m.op === 'atriz_parar' ? 'SIGINT' : m.senal
          console.log(`  ${senal}`)
          enviar({ op: 'atriz_estado', estado: 'PARANDO', sujeto, soy_el_dueno: true, pid: ranura.pid, nombre: ranura.nombre })
          luego(700, () => terminar('SENAL', { senal }))
        }
      }
    }
  })

  socket.on('close', () => { limpiar(); console.log(`· ${sujeto} desconectado`) })
  socket.on('error', () => limpiar())
})

servidor.listen(PUERTO, () => {
  console.log(`agente de mentira en ws://localhost:${PUERTO}  (robot ${robot})`)
  console.log(`  prácticas listadas: ${PRACTICAS.length}`)
  if (ocupadoPor) console.log(`  🔴 la ranura la tiene «${ocupadoPor}»`)
  if (sinReloj) console.log('  🔴 sin reloj: cerrará con 1013')
  if (sinFirma) console.log('  ⚠️  sin verificar firmas')
  if (topeSalida) console.log('  🔴 diluvio de salida, con recorte')
  console.log('  ⚠️  NO hay PTY: esto reproduce transcripciones, no ejecuta nada.')
})
