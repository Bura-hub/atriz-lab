/**
 * LAS PANTALLAS, RENDERIZADAS Y CON DATOS DEL ROBOT DE VERDAD.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO NO PODIA CUBRIRSE CON LAS DEMAS PRUEBAS
 * ═══════════════════════════════════════════════════════════════════════════
 * El 2026-08-04 la pantalla de telemetria pinto **«hace hace 7,9 s»** y
 * **«en reposo: 27,5 °C en reposo»**, y **las 321 pruebas pasaron**. Ninguna
 * mira texto pintado: corren en `environment: 'node'` sobre `src/lib` y
 * `src/hooks`, y `vitest.config.ts` documenta que `jsdom` no se instala.
 *
 * Y **no bastaba con mirar el HTML del servidor**: la antiguedad solo aparece
 * **con datos**, que llegan por WebSocket **despues de hidratar**. El fallo
 * vivia justo donde el servidor no llega.
 *
 * Lo encontro una captura de pantalla. Esto existe para que la proxima no
 * dependa de que alguien mire.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMO SE CORRE
 * ═══════════════════════════════════════════════════════════════════════════
 *   1. el robot encendido y con `atriz-robot.service` arriba
 *   2. el servidor de desarrollo:  npx next dev -p 3118
 *      ⚠️ **nunca a la vez que `npm run build`**: los dos escriben en `.next/`
 *         y las rutas empiezan a dar 500 con un error que no menciona tu
 *         fichero.
 *   3. ATRIZ_ROBOT=1 npx vitest run src/lib/interfaz/pantallas_reales.test.ts
 *
 * Variables: `ATRIZ_WEB` (por defecto http://localhost:3118), `ATRIZ_HOST` (el
 * segmento de `/robot/[id]`: un numero 1..16 o una IPv4, por defecto `1`),
 * `ATRIZ_NAVEGADOR` (ruta al binario) y `ATRIZ_CDP_PUERTO`.
 *
 * ⚠️ **NO mueve el robot** y **no enciende el barrido**: solo abre paginas, que
 *    se suscriben. La de LIDAR se suscribe a `/scan` mientras esta abierta —el
 *    83 % del trafico— y se cierra sola al pasar a la siguiente.
 *
 * Sin `ATRIZ_ROBOT=1` se salta, y vitest lo reporta como `skipped`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LO QUE ESTA PRUEBA **NO** ES
 * ═══════════════════════════════════════════════════════════════════════════
 * No es una prueba visual. No mira colores, ni espaciado, ni si algo se lee a
 * tres metros. **Eso sigue exigiendo una persona mirando**, y el muro del
 * profesor tiene ese criterio escrito en `CLAUDE.md`. Lo que esto cubre es lo
 * comprobable por maquina: texto que se repite, huecos afirmados como datos, y
 * frases que este proyecto tiene prohibidas por haber costado algo.
 */

import { existsSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ChildProcess, spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FRASES_PROHIBIDAS, normalizar } from './lenguaje'
import { SIN_DATO } from './formato'
import { marcasDe, marcasDefectuosas } from './semantica'
import { repeticionesEn } from './repeticion'

const CON_ROBOT = process.env.ATRIZ_ROBOT === '1'
const WEB = process.env.ATRIZ_WEB ?? 'http://localhost:3118'
/**
 * 🔴 EL SEGMENTO DE `/robot/[id]`, Y NO ES UN NOMBRE DE MAQUINA.
 *
 * La primera version de esta prueba puso aqui `rvr-01.local` y **las seis rutas
 * dieron 404**, porque `interpretarIdRobot()` acepta solo un numero 1..16 o una
 * IPv4 literal — a proposito: aceptar un anfitrion cualquiera convertiria la
 * ruta en «abre un WebSocket a donde diga la URL» sobre una aplicacion **sin
 * autenticacion**.
 *
 * 🔴 Y lo que eso destapo vale mas que el arreglo: **18 de las 19
 *    comprobaciones pasaron sobre seis paginas 404**. Las de repeticion, hueco
 *    y frase prohibida son de AUSENCIA, y una pagina vacia las cumple todas.
 *    Solo la que exige que los datos LLEGUEN lo vio. Es la razon de que exista,
 *    y por poco no se escribe.
 *
 * Con el numero, la aplicacion conecta a `rvr-NN.local` — que es justo el
 * camino que interesa ejercitar.
 */
const HOST = process.env.ATRIZ_HOST ?? '1'
const PUERTO = Number(process.env.ATRIZ_CDP_PUERTO ?? 9333)

/**
 * 🔴 ESPERA EN TIEMPO REAL, y esto no es negociable.
 *
 * `--virtual-time-budget` **congela el reloj del navegador y ahoga la red**.
 * Con el puesto, las paginas volvieron vacias tres veces seguidas y se estuvo a
 * punto de concluir que el WebSocket estaba roto.
 */
const ESPERA_MS = Number(process.env.ATRIZ_ESPERA_MS ?? 9000)

const RUTAS: readonly [string, string][] = [
  ['portada', '/'],
  ['flota', '/flota'],
  ['telemetría', `/robot/${HOST}/telemetria`],
  ['conducir', `/robot/${HOST}/conducir`],
  ['LIDAR', `/robot/${HOST}/lidar`],
  ['diagnóstico', `/robot/${HOST}/diagnostico`],
]

const CANDIDATOS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

function rutaDelNavegador(): string {
  const puesta = process.env.ATRIZ_NAVEGADOR
  if (puesta !== undefined && puesta !== '') return puesta
  const hallado = CANDIDATOS.find((c) => existsSync(c))
  if (hallado === undefined) {
    throw new Error(
      'no encuentro un navegador basado en Chromium. Pon ATRIZ_NAVEGADOR con la ruta al binario.',
    )
  }
  return hallado
}

/** Lo que se le pregunta a una pantalla ya hidratada. */
interface Informe {
  html: string
  /** El texto de cada hoja del DOM. SCRIPT/STYLE fuera: ver abajo. */
  hojas: string[]
  texto: string
}

/** Cliente CDP minimo. Sin dependencias: node 22 trae `WebSocket` global. */
class Navegador {
  private proceso: ChildProcess | null = null
  private ws: WebSocket | null = null
  private perfil = ''
  private id = 0
  private pendientes = new Map<number, (r: unknown) => void>()

  async arrancar(): Promise<void> {
    this.perfil = mkdtempSync(join(tmpdir(), 'atriz-cdp-'))
    this.proceso = spawn(rutaDelNavegador(), [
      '--headless=new',
      `--remote-debugging-port=${PUERTO}`,
      `--user-data-dir=${this.perfil}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ], { stdio: 'ignore' })

    // Esperar a que el puerto de depuracion conteste, sin dormir un numero
    // inventado: se pregunta hasta que responde.
    let objetivo: { webSocketDebuggerUrl: string } | undefined
    for (let i = 0; i < 100 && objetivo === undefined; i++) {
      await dormir(200)
      try {
        const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()
        objetivo = (lista as { type: string; webSocketDebuggerUrl: string }[])
          .find((t) => t.type === 'page')
      } catch { /* todavia no escucha */ }
    }
    if (objetivo === undefined) throw new Error('el navegador no abrio su puerto de depuracion')

    const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
    await new Promise<void>((ok, err) => {
      ws.onopen = () => ok()
      ws.onerror = () => err(new Error('no se pudo hablar con el navegador por CDP'))
    })
    ws.onmessage = (e: MessageEvent) => {
      const m = JSON.parse(String(e.data)) as { id?: number; result?: unknown }
      if (m.id !== undefined) {
        const cb = this.pendientes.get(m.id)
        if (cb !== undefined) { this.pendientes.delete(m.id); cb(m.result) }
      }
    }
    this.ws = ws

    await this.cmd('Page.enable')
    await this.cmd('Runtime.enable')
    await this.cmd('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  }

  private cmd(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const ws = this.ws
    if (ws === null) throw new Error('el navegador no esta arrancado')
    return new Promise((ok) => {
      const n = ++this.id
      this.pendientes.set(n, ok)
      ws.send(JSON.stringify({ id: n, method, params }))
    })
  }

  async mirar(ruta: string): Promise<Informe> {
    await this.cmd('Page.navigate', { url: WEB + ruta })
    await dormir(ESPERA_MS)   // 🔴 en tiempo real. Ver la nota de ESPERA_MS.

    /*
     * 🔴 SCRIPT/STYLE/TEMPLATE fuera del barrido de hojas.
     *    El payload de hidratacion de Next.js lleva dentro cosas como
     *    «border border» y disparaba los detectores de repeticion sobre texto
     *    que **nadie ve**. Fue el primer falso positivo de esta comprobacion.
     */
    const expr = `(() => {
      const INVISIBLE = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
      const hojas = [...document.body.querySelectorAll('*')]
        .filter(e => !INVISIBLE.has(e.tagName) && e.children.length === 0)
        .map(e => e.innerText || '')
        .map(s => s.trim())
        .filter(s => s !== '')
      return {
        html: document.documentElement.outerHTML,
        hojas,
        texto: document.body.innerText,
      }
    })()`
    const r = await this.cmd('Runtime.evaluate',
      { expression: expr, returnByValue: true }) as
      { result?: { value?: Informe }; exceptionDetails?: unknown }
    const valor = r.result?.value
    if (valor === undefined) throw new Error(`no pude leer ${ruta}: ${JSON.stringify(r)}`)
    return valor
  }

  cerrar(): void {
    try { this.ws?.close() } catch { /* da igual */ }
    try { this.proceso?.kill() } catch { /* da igual */ }
    // ⚠️ En Windows `kill()` puede dejar procesos hijos del navegador. El
    //    perfil temporal se borra igual; si quedara alguno, muere al cerrar la
    //    sesion. Es una prueba manual, no de CI.
    try { rmSync(this.perfil, { recursive: true, force: true }) } catch { /* da igual */ }
  }
}

describe.skipIf(!CON_ROBOT)('las pantallas, renderizadas y con datos reales', () => {
  const nav = new Navegador()
  const informes = new Map<string, Informe>()

  beforeAll(async () => {
    await nav.arrancar()
    for (const [nombre, ruta] of RUTAS) informes.set(nombre, await nav.mirar(ruta))
  }, 60000 + RUTAS.length * (ESPERA_MS + 5000))

  afterAll(() => { nav.cerrar() })

  it.each(RUTAS.map(([n]) => n))('%s: ninguna palabra ni frase repetida', (nombre) => {
    const inf = informes.get(nombre)
    expect(inf, `no hay informe de ${nombre}`).toBeDefined()
    const malos = repeticionesEn(inf!.hojas)
    expect(malos, JSON.stringify(malos, null, 2)).toEqual([])
  })

  it.each(RUTAS.map(([n]) => n))('%s: ningun hueco disfrazado de dato', (nombre) => {
    /*
     * 🔴 La regla central del proyecto, comprobada sobre el DOM y no sobre una
     *    clase de CSS: `<data value>` existe SOLO cuando hay valor. Un
     *    `value=""` o un `SIN_DATO` dentro de un `<data>` afirma que hay un
     *    valor legible por maquina, y no lo hay.
     */
    const inf = informes.get(nombre)!
    const fallos = marcasDefectuosas(marcasDe(inf.html), SIN_DATO)
    expect(fallos, JSON.stringify(fallos, null, 2)).toEqual([])
  })

  it.each(RUTAS.map(([n]) => n))('%s: ninguna frase prohibida', (nombre) => {
    const inf = informes.get(nombre)!
    const texto = normalizar(inf.texto)
    const halladas = FRASES_PROHIBIDAS.filter((f) => texto.includes(normalizar(f)))
    expect(halladas, JSON.stringify(halladas)).toEqual([])
  })

  it('🔴 y la MITAD que nunca se verifico: que los datos LLEGUEN', () => {
    /*
     * Las tres comprobaciones de arriba son de AUSENCIA: pasan sobre una
     * pantalla en blanco. Sin esta, una regresion que dejara la telemetria
     * muda daria verde entero — que es exactamente la familia de fallo que
     * este proyecto persigue: la comprobacion muerta que cuenta como aprobada.
     */
    const tele = informes.get('telemetría')!
    const marcas = marcasDe(tele.html)
    expect(marcas.length, 'la telemetria no trajo ni un <data value>').toBeGreaterThan(0)

    // Y que sean numeros de verdad, no cadenas puestas para rellenar.
    const numericas = marcas.filter((m) => Number.isFinite(Number(m.value)))
    expect(numericas.length).toBe(marcas.length)
  })
})
