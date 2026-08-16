/**
 * UN NAVEGADOR DE VERDAD, SIN DEPENDENCIAS. Solo para pruebas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE EXISTE ESTE FICHERO (extraido el 2026-08-09)
 * ═══════════════════════════════════════════════════════════════════════════
 * Este cliente CDP vivia dentro de `pantallas_reales.test.ts` y era privado. Se
 * saca aqui **porque hizo falta una segunda prueba que lo necesitaba**, y la
 * alternativa era copiarlo.
 *
 * 🔴 Y el motivo de esa segunda prueba merece quedar escrito, porque es un error
 *    mio: el 2026-08-09 escribi —en el CHANGELOG, en el README y en el canal del
 *    robot— que las tarjetas de `APROXIMACION` y del mapa **no se podian
 *    verificar aqui**, «porque son de cliente y ninguna prueba las mira». Lo
 *    segundo era cierto; lo primero, falso. **El conductor de navegador ya
 *    estaba en el repositorio**, a un fichero de distancia, y lo habia usado esa
 *    misma noche sin reparar en lo que permitia.
 *
 * 📝 La leccion, que es la de siempre en este proyecto con otra cara: **«no se
 *    puede verificar» es una afirmacion, y necesita la misma comprobacion que
 *    cualquier otra.** La mia se apoyaba en no haber mirado.
 *
 * ⚠️ Esto NO es una prueba visual. No mira colores, ni espaciado, ni si algo se
 *    lee a tres metros. Eso sigue exigiendo una persona. Lo que da es **el texto
 *    que el navegador acaba pintando**, despues de hidratar y de recibir por
 *    WebSocket — que es justo lo que el HTML del servidor no tiene.
 */

import { ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COOKIE } from '@/lib/sesion/peticion'
import { DURACION_SESION_MS, firmar } from '@/lib/sesion/testigo'

const CANDIDATOS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
]

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * El secreto con el que firma el SERVIDOR, para poder firmar igual.
 *
 * 🔴 LEE `.env.local` A MANO, y solo aquí. Next lo carga en `dev` y en `build`;
 *    **vitest no**, así que sin esto la primera prueba de navegador tras la
 *    puerta muere con «no hay ATRIZ_SECRETO» — que es lo que pasó al estrenarla.
 *
 * ⚠️ Y NO se carga el fichero entero en `process.env` desde un `setupFiles`
 *    global, que era la solución cómoda: ahí dentro vive también
 *    `NEXT_PUBLIC_ATRIZ_TESTIGO=1`, y meterlo en las 1031 pruebas cambiaría el
 *    comportamiento por defecto que varias de ellas comprueban. Se coge **una
 *    variable**, en **un sitio**, para **un uso**.
 *
 * 🔴 Falla RUIDOSO si no lo encuentra. Un `return` silencioso dejaría la prueba
 *    mirando `/entrar` y pasando: el «saltada = pasada» que esto viene a cerrar.
 */
function secretoDePruebas(): string {
  const puesto = process.env.ATRIZ_SECRETO
  if (puesto !== undefined && puesto !== '') return puesto

  const fichero = join(process.cwd(), '.env.local')
  if (existsSync(fichero)) {
    for (const linea of readFileSync(fichero, 'utf8').split(/\r?\n/)) {
      if (!linea.startsWith('ATRIZ_SECRETO=')) continue
      // El valor puede llevar `=` dentro; se corta por el PRIMER `=` y se le
      // quitan las comillas si las trae.
      const v = linea.slice(linea.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
      if (v !== '') return v
    }
  }
  throw new Error(
    'no encuentro ATRIZ_SECRETO ni en el entorno ni en frontend/.env.local. Sin el no se puede '
    + 'firmar la cookie, el navegador se quedaria en /entrar, y esta prueba comprobaria la '
    + 'pantalla equivocada.',
  )
}

export function rutaDelNavegador(): string {
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
export interface Informe {
  html: string
  /** El texto de cada hoja del DOM. SCRIPT/STYLE fuera: ver abajo. */
  hojas: string[]
  texto: string
  /**
   * El texto de cada `[role="status"]` de la pagina, por separado.
   *
   * 🔴 EXISTE POR UN FALSO POSITIVO MIO, el 2026-08-09. Una comprobacion escrita
   * como «la tarjeta NO dice 40 %» sobre `texto` —la pagina entera— salto sobre
   * la MISMA pantalla, porque mas abajo hay un bloque permanente que explica el
   * 40 % del poligono `Precaucion` y es correcto que este ahi.
   *
   * 📝 Es la tercera vez en este proyecto que un detector mio acusa a codigo
   *    sano por mirar mas de la cuenta. **Una afirmacion sobre UNA tarjeta se
   *    comprueba sobre esa tarjeta**, no sobre todo lo que hay alrededor.
   */
  estados: string[]
  /**
   * Donde acabo el navegador DE VERDAD, que no tiene por que ser donde se le
   * mando: `(privado)` redirige a `/entrar` sin sesion. Ver `mirar()`.
   */
  url: string
}

/**
 * 🔴 ESPERA EN TIEMPO REAL, y esto no es negociable.
 *
 * `--virtual-time-budget` **congela el reloj del navegador y ahoga la red**. Con
 * el puesto, las paginas volvieron vacias tres veces seguidas y se estuvo a
 * punto de concluir que el WebSocket estaba roto.
 */
export const ESPERA_MS = Number(process.env.ATRIZ_ESPERA_MS ?? 9000)

/** Cliente CDP minimo. Sin dependencias: node 22 trae `WebSocket` global. */
export class Navegador {
  private proceso: ChildProcess | null = null
  private ws: WebSocket | null = null
  private perfil = ''
  private id = 0
  private pendientes = new Map<number, (r: unknown) => void>()

  constructor(private readonly puerto: number, private readonly base: string) {}

  async arrancar(): Promise<void> {
    this.perfil = mkdtempSync(join(tmpdir(), 'atriz-cdp-'))
    this.proceso = spawn(rutaDelNavegador(), [
      '--headless=new',
      `--remote-debugging-port=${this.puerto}`,
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
        const lista = await (await fetch(`http://127.0.0.1:${this.puerto}/json/list`)).json()
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

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 SIN ESTO, TODA PRUEBA DE NAVEGADOR MIRA LA PANTALLA DE ENTRAR
   * ═════════════════════════════════════════════════════════════════════════
   * Desde que existe la puerta —el 2026-08-16—, `/flota`, `/robot/NN` y las
   * demas contestan **307 a `/entrar`** a un navegador sin cookie. Las dos
   * pruebas que usan esta clase abren paginas sin sesion, asi que sin este
   * metodo dejarian de comprobar lo que dicen comprobar.
   *
   * 🔴 Y NO FALLARIAN: se saltan solas cuando falta su variable de entorno, asi
   *    que **«saltada» se lee como «pasada»** en la salida de vitest. Es el modo
   *    de fallo que este proyecto lleva doce veces pagando en su verificador —
   *    una comprobacion que se salta en silencio— y por eso esto se escribio en
   *    la MISMA fase que la puerta, no como arreglo posterior.
   *
   * 🔴 La cookie se FIRMA con el mismo secreto que el servidor, no se falsifica.
   *    Una cookie inventada pasaria el `middleware` —que solo mira que exista— y
   *    moriria en el layout de `(privado)`, que si comprueba la firma: la prueba
   *    acabaria mirando `/entrar` igualmente y sin decir por que.
   *
   * ⚠️ `httpOnly: true` a proposito, para que la cookie sea **la misma que emite
   *    `conSesion()`**. CDP la pone desde fuera del documento, asi que no
   *    estorba; ponerla legible seria probar contra una cookie que en
   *    produccion no existe.
   *
   * @throws si no encuentra el secreto (ver `secretoDePruebas`). Falla RUIDOSO
   *         a proposito: un `return` silencioso aqui es exactamente el
   *         «saltada = pasada» que esto viene a cerrar.
   */
  async entrarComo(usuario: string): Promise<void> {
    const s = secretoDePruebas()
    const url = new URL(this.base)
    await this.cmd('Network.enable')
    await this.cmd('Network.setCookie', {
      name: COOKIE,
      value: firmar({ usuario, exp: Date.now() + DURACION_SESION_MS }, s),
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    })
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

  async mirar(ruta: string, esperaMs: number = ESPERA_MS): Promise<Informe> {
    await this.cmd('Page.navigate', { url: this.base + ruta })
    await dormir(esperaMs)   // 🔴 en tiempo real. Ver la nota de ESPERA_MS.

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
      const estados = [...document.querySelectorAll('[role="status"]')]
        .map(e => e.innerText || '')
        .map(s => s.trim())
        .filter(s => s !== '')
      return {
        html: document.documentElement.outerHTML,
        hojas,
        texto: document.body.innerText,
        estados,
        url: location.pathname + location.search,
      }
    })()`
    const r = await this.cmd('Runtime.evaluate',
      { expression: expr, returnByValue: true }) as
      { result?: { value?: Informe }; exceptionDetails?: unknown }
    const valor = r.result?.value
    if (valor === undefined) throw new Error(`no pude leer ${ruta}: ${JSON.stringify(r)}`)

    /*
     * 🔴 EL CONTROL QUE IMPIDE COMPROBAR LA PANTALLA EQUIVOCADA.
     *
     * Si la puerta redirige, `mirar('/robot/1')` devuelve el HTML de `/entrar`
     * — una pagina perfectamente valida, con su texto, que hace fallar las
     * comprobaciones por el motivo equivocado («no encuentro APROXIMACION») o,
     * peor, las hace PASAR si lo que se busca es la ausencia de algo. Una
     * prueba de ausencia sobre la pantalla equivocada pasa siempre.
     *
     * Lo mismo que la regla del proyecto para `tf2_echo`: **comprueba el
     * transform que pide el consumidor, con sus frames exactos.** Que resuelva
     * algo no prueba que resolviera lo tuyo.
     */
    const pedida = new URL(this.base + ruta).pathname
    if (valor.url !== pedida && valor.url.startsWith('/entrar')) {
      throw new Error(
        `pedi ${pedida} y el navegador acabo en ${valor.url}: la puerta de sesion lo echo. `
        + 'Llama a `entrarComo(...)` antes de `mirar(...)`.',
      )
    }
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
