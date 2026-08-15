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
 * administrador tiene ese criterio escrito en `CLAUDE.md`. Lo que esto cubre es lo
 * comprobable por maquina: texto que se repite, huecos afirmados como datos, y
 * frases que este proyecto tiene prohibidas por haber costado algo.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
/*
 * 🔴 EL CONDUCTOR DE NAVEGADOR SE EXTRAJO EL 2026-08-09 a `navegador_cdp.ts`.
 *    Vivia aqui dentro y era privado; hizo falta para una segunda prueba —la de
 *    las tarjetas que solo existen tras recibir por WebSocket— y la alternativa
 *    era copiarlo. Esta prueba no cambia: usa el mismo cliente, importado.
 */
import { ESPERA_MS, type Informe, Navegador } from './navegador_cdp'
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


const RUTAS: readonly [string, string][] = [
  ['portada', '/'],
  ['flota', '/flota'],
  ['cuaderno', '/cuaderno'],
  ['taller', `/robot/${HOST}`],
  ['telemetría', `/robot/${HOST}/telemetria`],
  ['conducir', `/robot/${HOST}/conducir`],
  ['LIDAR', `/robot/${HOST}/lidar`],
  ['no obedece', `/robot/${HOST}/no-obedece`],
  // Añadida el 2026-08-06 con la pantalla. Una pantalla nueva que esta prueba no
  // recorre es un hueco: sus comprobaciones son de AUSENCIA, asi que lo que no
  // se visita no se vigila.
  ['navegar', `/robot/${HOST}/navegar`],
  ['diagnóstico', `/robot/${HOST}/diagnostico`],
]


describe.skipIf(!CON_ROBOT)('las pantallas, renderizadas y con datos reales', () => {
  const nav = new Navegador(PUERTO, WEB)
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

  it.each(RUTAS.map(([n]) => n))('%s: ninguna marca de markdown SIN RENDERIZAR', (nombre) => {
    /*
     * 🔴 ESTO PASO EL 2026-08-07, Y SOLO SE VE MIRANDO LA PANTALLA.
     *
     * `ControlNavegacion` escribia el remedio del estado bloqueado asi:
     *
     *     'hace falta `systemctl reset-failed` desde el robot'
     *
     * Ese texto se pinta como TEXTO PLANO —no es markdown, no es JSX—, asi que
     * los backticks salieron como caracteres en la captura. `tsc`, `eslint` y
     * las 538 pruebas estaban las tres en verde: ninguna mira lo que se ve.
     *
     * Es la misma familia que el `--estado-bien` inventado del mismo dia: el
     * codigo es valido y la pantalla esta mal. Por eso la guardia va AQUI, en
     * la prueba que abre el navegador de verdad, y no en un `grep` del fuente
     * —donde un backtick es sintaxis legitima de plantilla y no se distingue—.
     *
     * ⚠️ Se mira SOLO el texto visible, nunca el HTML: el payload de
     *    hidratacion de Next.js lleva backticks propios, y mirarlo produciria
     *    el falso positivo que ya mordio a `repeticionesEn`.
     */
    const inf = informes.get(nombre)!
    const sospechosas = inf.hojas.filter((h) => (
      h.includes('`')
      // `**negrita**` y `_cursiva_` sin renderizar, que es el mismo descuido.
      || /\*\*\S/.test(h)
    ))
    expect(sospechosas, JSON.stringify(sospechosas, null, 2)).toEqual([])
  })

  it('🔴 el taller NO finge: ni codigo ni salida inventados', () => {
    /*
     * ⚠️ ESTA PRUEBA CAMBIO EL 2026-08-14, Y SE SUSTITUYO EN VEZ DE BORRARSE.
     *
     * Exigia `/no construido/i` y un `<input disabled>`: era la guardia del
     * CHASIS, cuando el terminal no existia. Ahora existe, asi que esa
     * afirmacion es falsa — pero quitarla a secas dejaria el taller **sin
     * ninguna guardia**, y este proyecto midio que 18 de 19 comprobaciones de
     * AUSENCIA pasan sobre una pagina de error.
     *
     * El criterio no se relaja: **se invierte**. Antes era «¿alguien podria
     * creer que esto ya funciona?»; ahora es «¿alguien podria creer que esto
     * hace algo que no hace?».
     */
    const t = informes.get('taller')!

    // 1 · El editor existe y SE PUEDE ESCRIBIR. Antes se exigia lo contrario.
    expect(t.html).toMatch(/<textarea/)
    expect(t.html).not.toMatch(/<textarea[^>]*disabled/)

    // 2 · Y la salida sigue SIN INVENTAR NADA. Es lo unico que sobrevive intacto
    //     del criterio viejo, y es lo que mas importa: ni prompt de shell, ni
    //     cursor simulado, ni una linea de salida que nadie imprimio.
    for (const hoja of t.hojas) {
      expect(hoja, `hoja del taller: ${hoja}`).not.toMatch(/^\s*[$>#]\s|^Traceback|^>>> /)
    }

    // 3 · La linea de entrada sigue DESACTIVADA mientras no corra nada, y su
    //     motivo ya no miente: decia «no hay nada al otro lado» —cierto cuando
    //     el agente no existia— y ahora dice que no hay programa corriendo.
    expect(t.html).toMatch(/<input[^>]*disabled/)
    expect(t.texto).toMatch(/ningún programa corriendo/i)
    expect(t.texto).not.toMatch(/no hay nada al otro lado/i)

    // 4 · 🔴 LA COMPROBACION DE PRESENCIA QUE FALTABA. Sin agente detras, la
    //     pantalla tiene que DECIRLO — y distinguirlo del enlace de rosbridge,
    //     que es otro puerto y otro proceso. Son dos enlaces y se puede tener
    //     uno vivo y el otro muerto.
    expect(t.texto).toMatch(/agente/i)
    expect(t.texto).toMatch(/9443|otro enlace/i)

    // 5 · Y el aviso de lo que este terminal ABRE, que es real: el programa del
    //     alumno alcanza caminos que la lista blanca cierra al navegador.
    expect(t.texto).toMatch(/saltándose la capa de seguridad/i)
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
