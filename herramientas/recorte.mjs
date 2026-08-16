/**
 * UN PRIMER PLANO DE **UN** ELEMENTO, no de la página entera.
 *
 * `capturas.mjs` saca la página completa, que es lo que hace falta para juzgar
 * jerarquía y densidad. Pero una pieza de 90 px de alto dentro de una página de
 * 3100 no se puede juzgar así: al mirarla escalada, un rótulo de 10,5 px y una
 * regla de 1 px **desaparecen**, y entonces se da por bueno lo que no se ha
 * visto. Este proyecto ya tiene esa lección escrita para otras cosas: comprobar
 * la existencia y llamarlo efecto.
 *
 *     node herramientas/recorte.mjs --ruta /robot/1/telemetria \
 *       --sel ".regla-escala" --margen 90 --cookie "$C"
 *
 * `--sel` es un selector CSS; se recorta el PRIMERO que case, con margen.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : d
}
const WEB = arg('--web', 'http://localhost:3000')
const RUTA = arg('--ruta', '/flota')
const SEL = arg('--sel', 'body')
const MARGEN = Number(arg('--margen', '24'))
const COOKIE = arg('--cookie', '')
const SALIDA = arg('--salida', 'capturas/recortes')
const ESPERA = Number(arg('--espera', '9000'))

if (!RUTA.startsWith('/')) {
  // Misma trampa que en `capturas.mjs`: MSYS convierte «/flota» en una ruta de
  // Windows antes de que node lo vea, y el navegador acaba en una página de
  // error perfectamente válida.
  console.error(`🔴 «${RUTA}» no es una ruta. Repite con MSYS_NO_PATHCONV=1`)
  process.exit(1)
}

const CANDIDATOS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium',
]
const NAVEGADOR = process.env.ATRIZ_NAVEGADOR ?? CANDIDATOS.find((c) => existsSync(c))
if (NAVEGADOR === undefined) {
  console.error('🔴 no encuentro un navegador. Pon ATRIZ_NAVEGADOR.')
  process.exit(1)
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const PUERTO = 9761
const perfil = mkdtempSync(join(tmpdir(), 'atriz-rec-'))
const proc = spawn(NAVEGADOR, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' })

let objetivo
for (let i = 0; i < 120 && objetivo === undefined; i++) {
  await dormir(200)
  try {
    const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()
    objetivo = l.find((t) => t.type === 'page')
  } catch { /* aún no escucha */ }
}
if (objetivo === undefined) { console.error('🔴 el navegador no abrió su puerto'); process.exit(1) }

const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
await new Promise((ok) => { ws.onopen = ok })
let id = 0
const pend = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data))
  if (m.id === undefined || !pend.has(m.id)) return
  /*
   * 🔴 UN ERROR DE CDP LLEGA COMO `{error}` SIN `result`, y la primera versión
   *    de esto entregaba `m.result` a secas: el `await` resolvía a `undefined` y
   *    reventaba veinte líneas más abajo con «Cannot read properties of
   *    undefined», que apunta al sitio equivocado. Se lanza aquí, con el motivo
   *    que da el navegador.
   */
  const cb = pend.get(m.id)
  pend.delete(m.id)
  cb(m.error !== undefined ? { __error: m.error } : m.result)
}
const cmd = async (metodo, params = {}) => {
  const r = await new Promise((ok) => {
    const n = ++id
    pend.set(n, ok)
    ws.send(JSON.stringify({ id: n, method: metodo, params }))
  })
  if (r !== undefined && r.__error !== undefined) {
    throw new Error(`CDP ${metodo}: ${r.__error.message ?? JSON.stringify(r.__error)}`)
  }
  return r
}

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable')
/*
 * 🔴 x2. Un recorte existe para mirar 1 px de cerca, y a escala 1 el
 *    antialiasing se come justo lo que se va a juzgar.
 */
await cmd('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1100, deviceScaleFactor: 2, mobile: false })
if (COOKIE !== '') {
  await cmd('Network.setCookie', {
    name: 'atriz_sesion', value: COOKIE, domain: new URL(WEB).hostname,
    path: '/', httpOnly: true, secure: false, sameSite: 'Lax',
  })
}
await cmd('Page.navigate', { url: WEB + RUTA })
await dormir(ESPERA)

const caja = await cmd('Runtime.evaluate', {
  expression: `(() => {
    const e = document.querySelector(${JSON.stringify(SEL)})
    if (e === null) return 'null'
    const r = e.getBoundingClientRect()
    return JSON.stringify({ x: r.x, y: r.y + scrollY, w: r.width, h: r.height })
  })()`,
  returnByValue: true,
})
if (caja.result.value === 'null') {
  console.error(`🔴 ningún elemento casa «${SEL}» en ${RUTA}.`)
  console.error('   Y esto NO significa que el estilo esté mal: puede que la pieza')
  console.error('   solo exista con datos, o que el selector sea de otra pantalla.')
  ws.close(); proc.kill(); process.exit(1)
}
const c = JSON.parse(caja.result.value)

const png = await cmd('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: {
    x: Math.max(0, c.x - MARGEN),
    y: Math.max(0, c.y - MARGEN),
    width: c.w + MARGEN * 2,
    height: c.h + MARGEN * 2,
    scale: 1,
  },
})

mkdirSync(SALIDA, { recursive: true })
const nombre = `${RUTA.replace(/\//g, '-').replace(/^-/, '')}__${SEL.replace(/[^\w-]/g, '')}.png`
const destino = join(SALIDA, nombre)
writeFileSync(destino, Buffer.from(png.data, 'base64'))
console.log(`✅ ${destino}  (${Math.round(c.w)}x${Math.round(c.h)} css px, x2)`)

ws.close(); proc.kill()
try { rmSync(perfil, { recursive: true, force: true }) } catch { /* da igual */ }
