/**
 * LAS DOCE PANTALLAS, EN CUATRO PASADAS, A UNA CARPETA.
 *
 *     node herramientas/capturas.mjs            # con `npm run dev` corriendo
 *     node herramientas/capturas.mjs --web http://localhost:3118
 *     node herramientas/capturas.mjs --solo /flota,/robot/1
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTO **NO** SUSTITUYE A LA PERSONA. LE QUITA LOS 48 CLICS.
 * ═══════════════════════════════════════════════════════════════════════════
 * `CLAUDE.md` lo dice sin matices: *«colores, espaciado y si algo se lee a tres
 * metros exigen una persona mirando»*, y el criterio de aceptacion del muro
 * aparece nueve veces escrito como **una persona a tres metros**. Ninguna prueba
 * de este repositorio renderiza un componente —no hay jsdom ni
 * `@testing-library`, y no se instalan— asi que lo visual **no tiene ejecutor**.
 *
 * Lo que esto hace es entregar una carpeta en vez de obligar a recorrer doce
 * rutas por cuatro estados a mano. Sin eso, «mirarlo en cada fase» es una
 * intencion, no un paso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LAS CUATRO PASADAS, Y POR QUE CADA UNA
 * ═══════════════════════════════════════════════════════════════════════════
 *   1. **1440x1100** — el portatil del aula. Es la escena que manda.
 *   2. **375x812**   — donde estan los desbordes reales (defecto 12). No se
 *                      diseña para movil, pero un desborde se arregla.
 *   3. **escala de grises** — 🔴 LA PRUEBA DE ACEPTACION DEL TRIPLE CODIGO.
 *                      `globals.css` declara que el estado se codifica por color
 *                      + palabra + trama porque *«una de cada doce personas no
 *                      distingue el lima del coral, y este muro se proyecta»*.
 *                      Desaturado, un desconocido tiene que poder separar las
 *                      baldosas MIRAR de las IR **sin leer**. Si no puede, la
 *                      redundancia no esta hecha.
 *   4. **movimiento reducido** — que las transiciones de color SIGAN vivas.
 *                      Matarlas devuelve el estroboscopio del muro a quien pidio
 *                      menos movimiento, que es lo que el bloque de
 *                      `prefers-reduced-motion` existe para impedir.
 *
 * ⚠️ Y UN LIMITE QUE HAY QUE DECIR: sin sesion y sin robot, muchas pantallas
 *    salen en su estado vacio. Eso **no es un defecto de la captura**: es lo que
 *    ve alguien que abre la aplicacion en frio, y conviene mirarlo. Para ver
 *    datos hace falta sesion y robot, y entonces se pasa `--cookie`.
 */

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NAVEGADORES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
]

/** Las doce rutas de la aplicacion. `/robot/1` cubre las siete pestañas. */
const RUTAS = [
  '/', '/entrar', '/usuarios', '/flota', '/cuaderno',
  '/robot/1', '/robot/1/conducir', '/robot/1/telemetria', '/robot/1/lidar',
  '/robot/1/navegar', '/robot/1/diagnostico', '/robot/1/no-obedece',
]

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : d
}
const WEB = arg('--web', 'http://localhost:3000')
const COOKIE = arg('--cookie', '')
const SOLO = arg('--solo', '')
const rutas = SOLO === '' ? RUTAS : SOLO.split(',').map((r) => r.trim())

/**
 * Las cuatro pasadas.
 *
 * `preparar` recibe el `cmd` del protocolo y lo deja todo listo ANTES de
 * navegar; `soltar` lo deshace, porque el mismo navegador sirve para las cuatro.
 */
const PASADAS = [
  {
    nombre: 'portatil', ancho: 1440, alto: 1100,
    preparar: async () => {},
  },
  {
    nombre: 'movil', ancho: 375, alto: 812,
    preparar: async () => {},
  },
  {
    nombre: 'gris', ancho: 1440, alto: 1100,
    // 🔴 El filtro va en `documentElement`, no en `body`: el fondo de `body` y
    //    los orbes de `.luz-ambiente` (que son `fixed`) se quedarian en color.
    preparar: async (cmd) => {
      await cmd('Page.addScriptToEvaluateOnNewDocument', {
        source: `addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.filter = 'grayscale(1)'
        })`,
      })
    },
  },
  {
    nombre: 'sin-movimiento', ancho: 1440, alto: 1100,
    preparar: async (cmd) => {
      await cmd('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
    },
  },
]

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const nombreDeRuta = (r) => (r === '/' ? 'portada' : r.slice(1).replace(/\//g, '-'))

const navegador = NAVEGADORES.find((c) => {
  try { readFileSync(c); return true } catch { return false }
})
if (navegador === undefined) {
  console.log('🔴 no encuentro Chrome ni Edge')
  process.exit(1)
}

// La carpeta lleva la fecha para poder comparar fases. Se pasa por argumento
// porque los scripts de este repositorio no pueden llamar a `Date.now()` dentro
// de un flujo reproducible; aqui es una carpeta, no una medida.
const sello = arg('--sello', new Date().toISOString().slice(0, 16).replace(/[:T]/g, ''))
const RAIZ = fileURLToPath(new URL('../capturas/', import.meta.url))
const DESTINO = join(RAIZ, sello)

// Un intento en frio: si la web no esta, decirlo aqui y no tras arrancar Chrome.
//
// ⚠️ 45 s y no 8: una recompilacion de Turbopack tras tocar la configuracion
//    tarda mas de ocho segundos, y con el plazo corto esto decia «no contesta»
//    sobre un servidor que contestaba en 0,37 s. Medido el 2026-08-16 — un
//    diagnostico falso que manda a arrancar lo que ya esta arrancado.
try {
  const r = await fetch(WEB, { signal: AbortSignal.timeout(45000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
} catch (e) {
  console.log(`🔴 ${WEB} no contesta (${e.message}). ¿Esta corriendo \`npm run dev\`?`)
  process.exit(1)
}

const perfil = mkdtempSync(join(tmpdir(), 'capturas-'))
const proc = spawn(navegador, [
  '--headless=new', '--remote-debugging-port=9337', `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' })

await dormir(2500)
const lista = await (await fetch('http://127.0.0.1:9337/json/list')).json()
const ws = new WebSocket(lista.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => { ws.onopen = r })

let id = 0
const pendientes = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (pendientes.has(m.id)) { pendientes.get(m.id)(m.result); pendientes.delete(m.id) }
}
const cmd = (method, params = {}) => new Promise((r) => {
  const n = ++id
  pendientes.set(n, r)
  ws.send(JSON.stringify({ id: n, method, params }))
})

await cmd('Page.enable')
if (COOKIE !== '') {
  const { host } = new URL(WEB)
  await cmd('Network.enable')
  await cmd('Network.setCookie', {
    name: 'atriz_sesion', value: COOKIE, domain: host.split(':')[0], path: '/',
  })
  console.log('🍪 con sesion: las pantallas privadas saldran con datos')
} else {
  console.log('⚠️  SIN sesion: muchas pantallas saldran en su estado vacio. Es lo que ve')
  console.log('    alguien que abre la aplicacion en frio, y tambien conviene mirarlo.')
}

console.log(`\ndestino: capturas/${sello}/`)
let hechas = 0
for (const pasada of PASADAS) {
  mkdirSync(join(DESTINO, pasada.nombre), { recursive: true })
  await cmd('Emulation.setDeviceMetricsOverride', {
    width: pasada.ancho, height: pasada.alto, deviceScaleFactor: 1, mobile: false,
  })
  await pasada.preparar(cmd)
  process.stdout.write(`  ${pasada.nombre.padEnd(16)}`)

  for (const ruta of rutas) {
    await cmd('Page.navigate', { url: WEB + ruta })
    // 🔴 En tiempo REAL, nunca `--virtual-time-budget`: congela el reloj y ahoga
    //    la red. Este proyecto ya estuvo a punto de concluir que el WebSocket
    //    estaba roto por eso — las paginas volvian vacias tres veces seguidas.
    await dormir(5500)
    const { data } = await cmd('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
    })
    writeFileSync(join(DESTINO, pasada.nombre, `${nombreDeRuta(ruta)}.png`),
      Buffer.from(data, 'base64'))
    process.stdout.write('.')
    hechas++
  }
  process.stdout.write('\n')
}

ws.close()
proc.kill()

console.log(`\n✅ ${hechas} capturas en capturas/${sello}/`)
console.log('\n🔴 LO QUE HAY QUE MIRAR, y no lo puede mirar nadie mas:')
console.log('   · portatil        — ¿se ve de un vistazo lo mismo que antes, o menos?')
console.log('   · gris            — ¿se separan las baldosas MIRAR de las IR SIN LEER?')
console.log('                       Si no, el triple codigo no esta hecho.')
console.log('   · movil           — ¿algo se sale de la pantalla?')
console.log('   · sin-movimiento  — ¿siguen vivas las transiciones de color?')
console.log('\n   Y la que ninguna captura puede dar: proyectar /flota y leerla a TRES METROS.')
