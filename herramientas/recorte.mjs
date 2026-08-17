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
import zlib from 'node:zlib'
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
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * `--almacen` y `--clic`: LAS DOS PANTALLAS QUE NO SE PODIAN MIRAR
 * ═══════════════════════════════════════════════════════════════════════════
 * Sin esto, un recorte solo alcanza lo que se pinta al cargar una ruta en frio.
 * Quedaban fuera, entre otras:
 *
 *   · el mapa de `/navegar`, que exige apuntar el robot a otra direccion
 *     —`localStorage`— para poder hablar con el doble de rosbridge;
 *   · el desenlace de un objetivo, que **solo existe despues de pulsar**.
 *
 * 📌 Y ese desenlace es justo la pieza que se rediseño el 2026-08-16 para dejar
 *    de ser un parrafo de 400 caracteres. Se estuvo a punto de darla por buena
 *    sin verla, que es lo que este repositorio persigue en todas partes.
 *
 *     --almacen '{"atriz.direcciones.v1":"{\"1\":\"localhost\"}"}'
 *     --clic canvas --espera-clic 6000
 *
 * 🔴 `--almacen` se siembra con `addScriptToEvaluateOnNewDocument`, NO con un
 *    `Runtime.evaluate` despues de navegar: la aplicacion lee `localStorage` en
 *    su primer efecto, asi que escribirlo despues llega tarde y el recorte
 *    saldria del estado por defecto **con aspecto de haber funcionado**.
 */
const ALMACEN = arg('--almacen', '')
const CLIC = arg('--clic', '')
const ESPERA_CLIC = Number(arg('--espera-clic', '4000'))
/*
 * `--teclear`: escribe en lo que acabe de recibir el foco con `--clic`.
 *
 * 🔴 HACE FALTA PARA UNA PANTALLA ENTERA. El editor del Taller arranca VACIO —lo
 *    que se ve es su marcador de posicion— asi que los colores de sintaxis **no
 *    existen hasta que alguien escribe**. Sin esto, una captura del editor
 *    enseña un placeholder gris y se lee como «el resaltado no funciona»: me
 *    paso, y estuve mirando el CSS servido buscando un fallo que no habia.
 *
 * Un salto de linea se escribe con la secuencia de dos caracteres barra-ene.
 *
 * Se usa `Input.insertText`, que entrega el texto al elemento con el foco de una
 * vez. No simula pulsaciones: para eso haria falta `dispatchKeyEvent` tecla a
 * tecla, y lo que aqui interesa es el CONTENIDO, no el camino del teclado.
 */
const TECLEAR = arg('--teclear', '')
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

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 `captureBeyondViewport` PIERDE EL FONDO DE LA PAGINA — Y LA CAPTURA SALE
 *      OSCURA SIN QUE NADA LO DIGA
 * ═══════════════════════════════════════════════════════════════════════════
 * Aislado el 2026-08-16 con control, sobre la MISMA pagina y en el mismo
 * instante, cambiando una sola cosa:
 *
 *     captureScreenshot a secas ............ esquina [255, 255, 255]   papel ✅
 *     + captureBeyondViewport: true ........ esquina [ 24,  26,  27]   🔴
 *     + captureBeyondViewport + clip ....... esquina [ 24,  26,  27]   🔴
 *
 * Y a la vez, en esa misma pagina:
 *     getComputedStyle(document.body).backgroundColor -> rgb(246, 245, 243)
 *
 * O sea: **el CSS estaba bien y la foto estaba mal.** Chromium compone lo que
 * cae fuera del viewport sobre su lienzo por defecto, que en una maquina que
 * prefiere el tema oscuro es `#1a1a1b`. El contenido si se dibuja, asi que la
 * captura sale ENTERA, legible y con aspecto de estar bien — solo que es otra
 * pantalla.
 *
 * 🔴 SE JUZGO JERARQUIA Y CONTRASTE SOBRE ESAS CAPTURAS. Es la octava vez que
 *    en este proyecto miente el instrumento y no lo medido, y la primera en la
 *    que el instrumento es el que existe para MIRAR.
 *
 * 🔴 Y DOS ATRIBUCIONES MIAS FUERON FALSAS antes de aislar la variable: culpe a
 *    `prefers-color-scheme` (lo emule a `light` y la captura salio IDENTICA) y
 *    al modo oscuro automatico de Chromium (puse
 *    `--disable-features=WebContentsForceDark` y salio IDENTICA). Lo cerro un
 *    control de tres capturas, no una teoria.
 *
 * → El arreglo: fijar el lienzo por defecto **al color que la pagina dice estar
 *   pintando**, leido de ella y no escrito a mano aqui. Si el papel cambia, la
 *   captura lo sigue sola.
 */
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const PUERTO = 9761
const perfil = mkdtempSync(join(tmpdir(), 'atriz-rec-'))
const proc = spawn(NAVEGADOR, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  /*
   * ===========================================================================
   * AQUI IBA `--hide-scrollbars`, Y OSCURECIA LA CAPTURA ENTERA
   * ===========================================================================
   * Aislado el 2026-08-16 con control, misma pagina y mismo instante, mirando el
   * pixel del PNG que sale:
   *
   *                              viewport   beyondViewport   beyond+clip
   *     sin --hide-scrollbars      255            255             24   MAL
   *     con --hide-scrollbars      255             24             24   MAL
   *
   * Son DOS causas independientes y las dos hacen lo mismo: el navegador compone
   * sobre su lienzo por defecto -en una maquina que prefiere el tema oscuro,
   * #1a1a1b- en vez de sobre el fondo que la pagina esta pintando. A la vez, en
   * esa misma pagina, `getComputedStyle(document.body).backgroundColor` seguia
   * diciendo `rgb(246, 245, 243)`.
   *
   * EL MODO DE FALLO ES EL PEOR DE ESTE PROYECTO: la captura sale entera, nitida
   * y legible; solo que es OTRA pantalla. Se juzgo jerarquia y peso visual sobre
   * una composicion que nadie en el aula va a ver, y nada avisaba. Van OCHO veces
   * que miente el instrumento y no lo medido, y esta es la primera en la que el
   * instrumento es el que existe para MIRAR.
   *
   * Y TRES ATRIBUCIONES MIAS FUERON FALSAS antes de aislar: `prefers-color-scheme`
   * (emulado a `light`: captura IDENTICA), el modo oscuro automatico de Chromium
   * (`--disable-features=WebContentsForceDark`: IDENTICA) y el fondo del `body`
   * (estaba bien pintado). Lo cerro una tabla de seis capturas, no una teoria.
   *
   * La barra de desplazamiento vuelve a verse. Es un precio pequeño, y en
   * `recorte.mjs` ni se nota: el recorte se hace sobre el PNG.
   */
  '--no-first-run', '--no-default-browser-check', 'about:blank',
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
const ANCHO = Number(arg('--ancho', '1440'))
await cmd('Emulation.setDeviceMetricsOverride',
  { width: ANCHO, height: 1100, deviceScaleFactor: 2, mobile: ANCHO < 500 })
if (COOKIE !== '') {
  await cmd('Network.setCookie', {
    name: 'atriz_sesion', value: COOKIE, domain: new URL(WEB).hostname,
    path: '/', httpOnly: true, secure: false, sameSite: 'Lax',
  })
}
if (ALMACEN !== '') {
  // Se valida aqui para que un JSON mal escrito falle con su motivo, y no como
  // un recorte vacio veinte segundos despues.
  const pares = JSON.parse(ALMACEN)
  await cmd('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { const p = ${JSON.stringify(pares)}
      for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v) } catch {}`,
  })
}
await cmd('Page.navigate', { url: WEB + RUTA })
await dormir(ESPERA)

/*
 * ===========================================================================
 * EL VIEWPORT CRECE HASTA LA PAGINA ENTERA. NADA SE DESPLAZA NUNCA. AQUI EL PORQUE.
 * ===========================================================================
 * Las capturas de esta herramienta salian OSCURAS -el lienzo del navegador en vez
 * del papel de la aplicacion- y nada lo decia. Aislado el 2026-08-16 con control,
 * misma pagina y mismo instante, leyendo el PIXEL del PNG que sale:
 *
 *                                    viewport   beyondViewport   beyond+clip
 *     tal cual                          255           255             24
 *     con --hide-scrollbars             255            24             24
 *     tras DESPLAZAR la pagina           24            24             24
 *
 * O sea TRES caminos que rompen -y el tercero, el scroll, **envenena hasta la
 * captura simple**: una vez desplazada la pagina, ya no hay forma de sacar una
 * foto con el fondo bueno, ni volviendo arriba del todo.
 *
 * Y a la vez, en esa misma pagina:
 *     getComputedStyle(document.body).backgroundColor -> rgb(246, 245, 243)
 *
 * EL MODO DE FALLO ES EL PEOR DE ESTE PROYECTO: la captura sale entera, nitida y
 * legible. Solo que es OTRA pantalla. Se juzgo jerarquia, contraste y peso visual
 * sobre una composicion que nadie en el aula va a ver. Van OCHO veces que miente
 * el instrumento y no lo medido, y es la primera en la que el instrumento es el
 * que existe para MIRAR.
 *
 * Y CUATRO ATRIBUCIONES MIAS FUERON FALSAS antes de aislar la variable:
 * `prefers-color-scheme` (emulado a `light`: IDENTICA), el modo oscuro automatico
 * de Chromium (`--disable-features=WebContentsForceDark`: IDENTICA), el fondo del
 * `body` (estaba bien pintado) y `Emulation.setDefaultBackgroundColorOverride`
 * (sin efecto ninguno). Ir por parecido costo cuatro intentos; lo cerro una tabla
 * de nueve capturas cambiando UNA cosa cada vez.
 *
 * Y una cuarta forma de romperlo, encontrada al intentar arreglarlo: **agrandar
 * el viewport** hasta la pagina entera tambien lo oscurece. O sea que el unico
 * camino sano es el de siempre -viewport de 1440x1100- pidiendo la foto con
 * `captureBeyondViewport` y SIN `clip`.
 *
 * -> El arreglo: **no desplazar nada, no redimensionar nada, no pedirle al
 *    navegador que recorte**. Se pide la pagina entera por el unico camino
 *    medido correcto y se recorta aqui, sobre el PNG, con `zlib` -sin
 *    dependencias, que es un valor de este repositorio.
 */

if (CLIC !== '') {
  /*
   * SE SINTETIZA EL GESTO EN JS, no con `Input.dispatchMouseEvent`.
   *
   * `Input.*` usa coordenadas de VIEWPORT, asi que para pulsar algo que cae bajo
   * la linea de flotacion habria que desplazar la pagina — y desplazar la pagina
   * deja OSCURAS todas las capturas posteriores (ver el bloque de arriba). Este
   * camino no toca el scroll.
   *
   * SE MANDAN LOS TRES EVENTOS, en orden: `mousedown`, `mouseup` y `click`. No es
   * un detalle: en esta aplicacion hay una pantalla cuya correccion depende de
   * ese orden exacto — el gesto que una vez puso el robot a conducir cuando
   * alguien queria corregir su pose. Un `element.click()` a secas sintetiza SOLO
   * el tercero y no podria juzgar el arreglo.
   *
   * LIMITE, y se dice: estos eventos llevan `isTrusted: false`. React y los
   * manejadores propios no lo miran, pero nada que dependa de un gesto de verdad
   * -abrir una ventana, entrar a pantalla completa- se puede probar asi.
   */
  const hecho = await cmd('Runtime.evaluate', {
    expression: `(() => {
      const e = document.querySelector(${JSON.stringify(CLIC)})
      if (e === null) return 'null'
      const r = e.getBoundingClientRect()
      const x = r.x + r.width / 2, y = r.y + r.height / 2
      /* El foco se pide a mano: un clic sintetizado NO lo mueve -eso solo lo
         hace el raton de verdad-, asi que insertar texto escribia en el vacio y
         el editor seguia enseñando su marcador de posicion. */
      if (typeof e.focus === 'function') e.focus()
      for (const tipo of ['mousedown', 'mouseup', 'click']) {
        e.dispatchEvent(new MouseEvent(tipo, {
          bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0,
        }))
      }
      return JSON.stringify({ x: Math.round(x), y: Math.round(y) })
    })()`,
    returnByValue: true,
  })
  if (hecho.result.value === 'null') {
    console.error(`ERROR: no encuentro «${CLIC}» para pulsar. Nada que recortar.`)
    ws.close(); proc.kill(); process.exit(1)
  }
  const donde = JSON.parse(hecho.result.value)
  console.log(`  pulsado «${CLIC}» en ${donde.x},${donde.y}`)
  if (TECLEAR !== '') {
    // Un `\n` escrito en la linea de ordenes llega como dos caracteres; se
    // convierte en salto de verdad, porque un Python de una sola linea no
    // ejercita casi nada del resaltado.
    const texto = TECLEAR.split(String.raw`\n`).join('\n')
    await cmd('Input.insertText', { text: texto })
    console.log('  tecleados ' + texto.length + ' caracteres')
  }
  await dormir(ESPERA_CLIC)
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SE DESPLAZA HASTA EL ELEMENTO Y SE MIDE EN COORDENADAS DE VIEWPORT
 * ═══════════════════════════════════════════════════════════════════════════
 * Antes se medía en coordenadas de DOCUMENTO (`r.y + scrollY`) y se capturaba
 * con `captureBeyondViewport: true`. Eso funciona para el recorte… y **pierde el
 * fondo pintado de la página**: ver el bloque de arriba. Una tarjeta que cae a
 * 1400 px de una página salía sobre el lienzo oscuro del navegador.
 *
 * Con el elemento desplazado a la vista, la caja ya está DENTRO del viewport y
 * se puede capturar por el camino simple, que es el único de los tres que se
 * midió correcto. `--clic` ya desplazaba por su cuenta; ahora lo hacen los dos.
 *
 * ⚠️ LÍMITE, y se dice en vez de esconderlo: un elemento MÁS ALTO que el
 *    viewport no cabe en una captura simple. En ese caso se vuelve a
 *    `captureBeyondViewport` —con su fondo dudoso— y **se avisa por consola**,
 *    porque una captura con el fondo mal no se puede usar para juzgar contraste
 *    y hay que saberlo antes de mirarla, no después.
 */
const caja = await cmd('Runtime.evaluate', {
  expression: `(() => {
    const e = document.querySelector(${JSON.stringify(SEL)})
    if (e === null) return 'null'
    /* Coordenadas de DOCUMENTO: la foto es de la pagina entera. Aqui nunca se
       desplaza nada, asi que el scroll vale 0 — se suma por si algun dia
       alguien mete un desplazamiento y esto deja de cuadrar en silencio. */
    const r = e.getBoundingClientRect()
    return JSON.stringify({ x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height })
  })()`,
  returnByValue: true,
})
if (caja.result.value === 'null') {
  console.error(`ERROR: ningun elemento casa «${SEL}» en ${RUTA}.`)
  console.error('   Y esto NO significa que el estilo este mal: puede que la pieza')
  console.error('   solo exista con datos, o que el selector sea de otra pantalla.')
  ws.close(); proc.kill(); process.exit(1)
}
const c = JSON.parse(caja.result.value)

/*
 * ===========================================================================
 * SE CAPTURA LA PAGINA ENTERA Y SE RECORTA AQUI. `clip` ESTABA MINTIENDO.
 * ===========================================================================
 * Aislado el 2026-08-16 con control, sobre la misma pagina y el mismo instante:
 *
 *     captureScreenshot a secas ................. fondo [255,255,255]  OK
 *     + captureBeyondViewport, SIN clip ......... fondo [255,255,255]  OK
 *     + captureBeyondViewport, CON clip ......... fondo [ 24, 26, 27]  MAL
 *     + clip SIN captureBeyondViewport .......... rectangulo VACIO     MAL
 *
 * O sea: es `clip` lo que rompe, en las dos direcciones. Con el, el navegador
 * compone sobre su lienzo por defecto -que en una maquina que prefiere el tema
 * oscuro es #1a1a1b- en vez de sobre el fondo que la pagina esta pintando. Y a
 * la vez, en esa misma pagina:
 *
 *     getComputedStyle(document.body).backgroundColor -> rgb(246, 245, 243)
 *
 * EL MODO DE FALLO ES EL PEOR DE ESTE PROYECTO: la captura sale entera, nitida
 * y legible. Solo que es OTRA pantalla. Se juzgo jerarquia y peso visual sobre
 * una composicion que ningun usuario del aula va a ver, y nada avisaba. Van
 * OCHO veces que miente el instrumento y no lo medido, y esta es la primera en
 * la que el instrumento es el que existe para MIRAR.
 *
 * Y TRES ATRIBUCIONES MIAS FUERON FALSAS antes de aislar la variable:
 * `prefers-color-scheme` (emulado a `light`: captura IDENTICA), el modo oscuro
 * automatico de Chromium (`--disable-features=WebContentsForceDark`: IDENTICA)
 * y el fondo del `body` (resultaba estar bien pintado). Lo cerro una tabla de
 * cuatro capturas, no una teoria.
 *
 * El arreglo: pedir la pagina ENTERA -el unico camino medido correcto- y
 * recortar el PNG con `zlib`, que node ya trae. Sin dependencias, que es un
 * valor de este repositorio.
 */
/*
 * ===========================================================================
 * SE CAPTURA HASTA QUE LA FOTO CUADRE CON LO QUE LA PAGINA DICE PINTAR
 * ===========================================================================
 * El navegador compone la captura POR BANDAS, y algunas bandas salen sobre su
 * lienzo por defecto -en una maquina que prefiere el tema oscuro, #1a1a1b- en
 * vez de sobre el fondo de la pagina. Medido el 2026-08-16 en UNA sola captura:
 *
 *     arriba [24,26,27]   medio [246,245,243]   abajo [24,26,27]
 *
 * ...con `getComputedStyle(document.body).backgroundColor` diciendo, a la vez,
 * `rgb(246, 245, 243)` — o sea el valor del medio. La franja del medio es la
 * buena y las otras dos son el lienzo del navegador.
 *
 * Es INTERMITENTE: la misma orden, repetida, da a veces una foto entera buena.
 *
 * EL MODO DE FALLO ES EL PEOR DE ESTE PROYECTO: la captura sale nitida, entera y
 * legible. Solo que es OTRA pantalla. Se juzgo jerarquia, contraste y peso
 * visual sobre composiciones asi, y nada avisaba. Van OCHO veces que miente el
 * instrumento y no lo medido — y es la primera en la que el instrumento es el
 * que existe para MIRAR.
 *
 * Y CUATRO ATRIBUCIONES MIAS FUERON FALSAS antes de aislarlo: el modo oscuro
 * automatico de Chromium, `prefers-color-scheme`, el fondo del `body` y
 * `setDefaultBackgroundColorOverride`. Ninguna cambio nada. Lo que si esta
 * medido es que EMPEORAN la probabilidad: `clip` y `--hide-scrollbars` la
 * ponen en 1, y desplazar la pagina tambien. Los tres estan fuera.
 *
 * -> Como no se puede garantizar, se COMPRUEBA: se muestrea el fondo del recorte
 *    y se compara con lo que dice el navegador. Si no cuadra, se repite. Y si
 *    tras varios intentos sigue sin cuadrar, **se dice a gritos** en vez de
 *    entregar una imagen con la que alguien juzgaria color.
 */
/*
 * SE COMPARA CONTRA EL TOKEN `--background`, NO CONTRA `getComputedStyle(body)`.
 *
 * La primera version usaba el color calculado del `body`, y no sirve: en el
 * navegador que oscurece, **ese valor tambien sale oscurecido** —medido:
 * `--background` daba `246 245 243` y `backgroundColor` daba `rgb(24, 26, 27)`
 * en la MISMA pagina y el mismo instante—. Comparar la foto con un valor que ya
 * viene contaminado es un control que no puede fallar nunca, que es exactamente
 * la clase de comprobacion muerta que este proyecto persigue.
 *
 * El token es lo que la aplicacion DECIDIO pintar, y no lo toca nadie.
 */
const fondoDicho = (await cmd('Runtime.evaluate', {
  expression: "getComputedStyle(document.documentElement).getPropertyValue('--background')",
  returnByValue: true,
})).result.value
const mDicho = /(\d+)\s+(\d+)\s+(\d+)/.exec(String(fondoDicho ?? ''))
const dicho = mDicho === null ? null : [Number(mDicho[1]), Number(mDicho[2]), Number(mDicho[3])]
if (process.env.ATRIZ_DIAG === '1') {
  const extra = (await cmd('Runtime.evaluate', {
    expression: `JSON.stringify({ hojas: document.styleSheets.length,
      token: getComputedStyle(document.documentElement).getPropertyValue('--background'),
      clases: document.documentElement.className, url: location.href })`,
    returnByValue: true,
  })).result.value
  console.log(`  [diag] la pagina dice pintar ${fondoDicho} · ${extra}`)
}
/* El lienzo por defecto del navegador cuando el sistema prefiere el tema
   oscuro. Es el color que NO tiene que aparecer donde deberia haber papel. */
const LIENZO_OSCURO = [24, 26, 27]
const cerca = (a, b, tol) => a.every((v, k) => Math.abs(v - b[k]) <= tol)

const INTENTOS = 4
let png = null
let entera = null
let malas = 0
for (let intento = 1; intento <= INTENTOS; intento++) {
  png = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  entera = decodificar(Buffer.from(png.data, 'base64'))
  if (dicho === null) break
  // Tres puntos del ALTO del recorte, en un margen donde solo hay fondo.
  const esc = entera.w / (await cmd('Runtime.evaluate', {
    expression: 'document.documentElement.scrollWidth', returnByValue: true,
  })).result.value
  const px = (x, y) => {
    const i = Math.min(entera.h - 1, Math.max(0, y)) * entera.w * entera.bpp
      + Math.min(entera.w - 1, Math.max(0, x)) * entera.bpp
    return [entera.img[i], entera.img[i + 1], entera.img[i + 2]]
  }
  const x0 = Math.round((c.x + 2) * esc)
  const arriba = Math.round((c.y - MARGEN / 2) * esc)
  const medio = Math.round((c.y + c.h / 2) * esc)
  const abajo = Math.round((c.y + c.h + MARGEN / 2) * esc)
  malas = [arriba, medio, abajo].filter((y) => cerca(px(x0, y), LIENZO_OSCURO, 8)).length
  // El lienzo solo cuenta como fallo si la pagina dice estar pintando OTRA cosa.
  if (malas === 0 || cerca(dicho, LIENZO_OSCURO, 8)) break
  if (intento < INTENTOS) {
    console.warn(`  la foto no cuadra con el fondo de la pagina; repito (${intento}/${INTENTOS - 1})`)
    await dormir(700)
  }
}
if (malas > 0 && dicho !== null && !cerca(dicho, LIENZO_OSCURO, 8)) {
  console.warn('')
  console.warn('ATENCION: ESTA CAPTURA NO SIRVE PARA JUZGAR COLOR NI CONTRASTE.')
  console.warn(`   la pagina dice pintar rgb(${dicho.join(', ')}) y en la foto hay franjas`)
  console.warn(`   con el lienzo del navegador rgb(${LIENZO_OSCURO.join(', ')}).`)
  console.warn('   El contenido y la maquetacion SI se pueden mirar; el color NO.')
  console.warn('')
}

/* -- PNG: decodificar, recortar, volver a codificar --------------------- */
const tablaCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = tablaCrc[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function decodificar(buf) {
  let o = 8, w = 0, h = 0, prof = 0, tipo = 0
  const idat = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    const t = buf.toString('ascii', o + 4, o + 8)
    if (t === 'IHDR') {
      w = buf.readUInt32BE(o + 8); h = buf.readUInt32BE(o + 12)
      prof = buf[o + 16]; tipo = buf[o + 17]
    }
    if (t === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len))
    o += 12 + len
  }
  // Solo 8 bits sin paleta ni entrelazado: es lo que emite CDP. Si algun dia
  // emitiera otra cosa, hay que ENTERARSE, no recortar basura en silencio.
  if (prof !== 8 || (tipo !== 2 && tipo !== 6)) {
    throw new Error(`PNG inesperado (profundidad ${prof}, tipo ${tipo}): no lo recorto a ciegas`)
  }
  const bpp = tipo === 6 ? 4 : 3
  const stride = w * bpp
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const img = Buffer.alloc(h * stride)
  let q = 0
  for (let y = 0; y < h; y++) {
    const f = raw[q++]
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? img[y * stride + x - bpp] : 0
      const b = y > 0 ? img[(y - 1) * stride + x] : 0
      const c2 = y > 0 && x >= bpp ? img[(y - 1) * stride + x - bpp] : 0
      let v = raw[q++]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const pa = Math.abs(b - c2), pb = Math.abs(a - c2), pc = Math.abs(a + b - 2 * c2)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c2
      }
      img[y * stride + x] = v & 255
    }
  }
  return { w, h, bpp, img }
}

function codificar({ w, h, bpp, img }) {
  const stride = w * bpp
  const conFiltro = Buffer.alloc(h * (stride + 1))
  for (let y = 0; y < h; y++) {
    conFiltro[y * (stride + 1)] = 0   // filtro «ninguno»: comprime peor, y da igual
    img.copy(conFiltro, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const trozo = (tipo, datos) => {
    const c = Buffer.alloc(8 + datos.length + 4)
    c.writeUInt32BE(datos.length, 0)
    c.write(tipo, 4, 'ascii')
    datos.copy(c, 8)
    c.writeUInt32BE(crc32(c.subarray(4, 8 + datos.length)), 8 + datos.length)
    return c
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = bpp === 4 ? 6 : 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(conFiltro, { level: 6 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

if (process.env.ATRIZ_DIAG === '1') {
  const i0 = 4 * entera.w * entera.bpp + 4 * entera.bpp
  console.log(`  [diag] foto cruda ${entera.w}x${entera.h} esquina=[${entera.img[i0]},${entera.img[i0 + 1]},${entera.img[i0 + 2]}]`)
  writeFileSync('capturas/diag-cruda.png', Buffer.from(png.data, 'base64'))
}
// La captura sale a `deviceScaleFactor`; la caja viene en pixeles de CSS.
const anchoCss = (await cmd('Runtime.evaluate', {
  // Del DOCUMENTO: la foto es de la pagina entera, no del viewport.
  expression: 'document.documentElement.scrollWidth', returnByValue: true,
})).result.value
const escala = entera.w / anchoCss
// Coordenadas de VIEWPORT: la foto es del viewport, no del documento.
const rx = Math.max(0, Math.round((c.x - MARGEN) * escala))
const ry = Math.max(0, Math.round((c.y - MARGEN) * escala))
const rw = Math.min(entera.w - rx, Math.round((c.w + MARGEN * 2) * escala))
const rh = Math.min(entera.h - ry, Math.round((c.h + MARGEN * 2) * escala))
if (rw <= 0 || rh <= 0) {
  console.error(`ERROR: el recorte cae fuera de la imagen (${entera.w}x${entera.h}).`)
  ws.close(); proc.kill(); process.exit(1)
}
const corte = Buffer.alloc(rh * rw * entera.bpp)
for (let y = 0; y < rh; y++) {
  entera.img.copy(
    corte, y * rw * entera.bpp,
    (ry + y) * entera.w * entera.bpp + rx * entera.bpp,
    (ry + y) * entera.w * entera.bpp + (rx + rw) * entera.bpp,
  )
}

mkdirSync(SALIDA, { recursive: true })
const nombre = `${RUTA.replace(/\//g, '-').replace(/^-/, '')}__${SEL.replace(/[^\w-]/g, '')}.png`
const destino = join(SALIDA, nombre)
writeFileSync(destino, codificar({ w: rw, h: rh, bpp: entera.bpp, img: corte }))
console.log(`OK ${destino}  (${Math.round(c.w)}x${Math.round(c.h)} css px, x${escala.toFixed(0)})`)

ws.close(); proc.kill()
try { rmSync(perfil, { recursive: true, force: true }) } catch { /* da igual */ }
