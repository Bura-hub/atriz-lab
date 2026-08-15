/**
 * LAS TARJETAS QUE SOLO EXISTEN DESPUES DE RECIBIR POR WEBSOCKET.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE EXISTE, Y EL ERROR QUE LA TRAJO
 * ═══════════════════════════════════════════════════════════════════════════
 * El 2026-08-09 se reescribio lo que la web dice de `APROXIMACION` —hasta ese
 * dia lo llamaba «va mas despacio» sobre un robot que da 0,0 cm en las tres
 * direcciones— y se anadio a la tarjeta del mapa que una fecha RECIENTE tampoco
 * es buena noticia.
 *
 * Y se escribio, en el CHANGELOG, en el README y en el canal del robot, que
 * **esos dos textos no se podian verificar aqui**: «son de cliente, no estan en
 * el HTML del servidor, y ninguna prueba los mira».
 *
 * 🔴 **Lo segundo era cierto. Lo primero, falso.** El conductor de navegador ya
 *    estaba en el repositorio —dentro de `pantallas_reales.test.ts`— y se habia
 *    usado esa misma noche sin reparar en lo que permitia. «No se puede
 *    verificar» es una afirmacion, y necesita la misma comprobacion que
 *    cualquier otra; la mia se apoyaba en no haber mirado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMO SE CORRE. **No hace falta el robot**, y esa es la gracia
 * ═══════════════════════════════════════════════════════════════════════════
 * Esta prueba arranca ella misma el rosbridge de mentira —una vez por caso, con
 * banderas distintas— y necesita el servidor de Next ya levantado:
 *
 *     cd frontend && npm run dev              # en otra terminal
 *     ATRIZ_VIVAS=1 npx vitest run src/lib/interfaz/tarjetas_vivas.test.ts
 *
 * Sin `ATRIZ_VIVAS=1` se salta, y vitest lo reporta como `skipped`.
 *
 * 🔴 `ATRIZ_HOST` VALE `127.0.0.1` POR DEFECTO, Y NO ES UN DETALLE. Esta prueba
 *    levanta su propio rosbridge de mentira en `localhost`, asi que la
 *    aplicacion tiene que apuntar ahi — y a un robot se le apunta poniendo la
 *    **IP como id** (`/robot/127.0.0.1/...`). Con un numero (`/robot/1`) la
 *    aplicacion resolveria `rvr-01.local`, o sea el robot DE VERDAD, y el doble
 *    se quedaria hablando solo.
 *
 *    Antes el defecto era `'1'`, heredado de `pantallas_reales.test.ts`, que si
 *    quiere el robot real. Correr el comando de arriba tal cual daba **6 fallos
 *    de 8, todos con la misma espera agotada de ~11 s** — que se leen como una
 *    regresion y no lo son. Paso el 2026-08-15. Y la primera prueba del fichero
 *    exige literalmente el texto «direccion IP», asi que con un numero **no
 *    puede pasar**: el defecto estaba peleado con su propio contenido.
 *
 * ⚠️ NO es una prueba visual: no mira color, ni tamano, ni jerarquia. Mira el
 *    TEXTO que el navegador acaba pintando. Que la tarjeta roja se vea como
 *    urgente sigue exigiendo una persona.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Navegador, dormir } from './navegador_cdp'

const CORRER = process.env.ATRIZ_VIVAS === '1'
const WEB = process.env.ATRIZ_WEB ?? 'http://localhost:3000'
const HOST = process.env.ATRIZ_HOST ?? '127.0.0.1'   // ver la cabecera: NO un numero
const PUERTO_CDP = Number(process.env.ATRIZ_CDP_PUERTO ?? 9334)
const RAIZ = resolve(__dirname, '../../../..')

/**
 * Levanta el doble con unas banderas y espera a que escuche.
 *
 * 🔴 Se arranca UNO POR CASO a proposito: el doble lee sus banderas al arrancar,
 *    asi que cambiar de modo exige un proceso nuevo. Reutilizarlo daria el mismo
 *    escenario dos veces y las dos pasarian — que es exactamente el control que
 *    esta prueba existe para tener.
 */
async function conDoble(banderas: string[]): Promise<ChildProcess> {
  const p = spawn('node', ['herramientas/rosbridge_de_mentira.mjs', ...banderas],
    { cwd: RAIZ, stdio: 'ignore' })
  await dormir(1200)
  return p
}

let doble: ChildProcess | null = null
let nav: Navegador | null = null

afterEach(() => {
  try { nav?.cerrar() } catch { /* da igual */ }
  try { doble?.kill() } catch { /* da igual */ }
  nav = null
  doble = null
})

/**
 * Abre la pantalla con el doble en un modo y devuelve lo pintado.
 *
 * 🔴 Devuelve DOS cosas, y la distincion costo dos falsos positivos: `texto` es
 * la pagina entera —vale para «¿aparece esto?»— y `avisos` son solo los
 * `[role="status"]`, o sea las TARJETAS VIVAS. Una comprobacion de AUSENCIA
 * sobre la pagina entera acusa a bloques legitimos que estan mas abajo.
 */
async function pintado(banderas: string[], ruta: string):
Promise<{ texto: string; avisos: string }> {
  doble = await conDoble(banderas)
  nav = new Navegador(PUERTO_CDP, WEB)
  await nav.arrancar()
  const informe = await nav.mirar(ruta)
  return { texto: informe.texto, avisos: informe.estados.join('\n') }
}

describe.skipIf(!CORRER)('🆕 EL TALLER por dirección IP: el caso que no puede funcionar', () => {
  it('🔴 lo DICE, en vez de intentarlo y fallar con un código', async () => {
    /*
     * El testigo que abre el agente lleva dentro el NÚMERO del robot, y el
     * agente lo compara con el suyo. Una dirección IP no tiene número que
     * comparar: firmar uno inventado daría un cierre 4404 —«esa credencial es
     * para otro robot»— que parece un fallo de permisos y manda a buscar a un
     * profesor.
     *
     * ⚠️ Y esta prueba es lo MÁS que se puede comprobar del taller desde este
     *    PC sin un robot: `/robot/7` resolvería `rvr-07.local`, que aquí no
     *    existe, así que el camino CONECTADO solo se verifica con el robot
     *    delante (o con una entrada en el fichero hosts). Está escrito en
     *    VALIDAR_CON_EL_ROBOT.md y no se da por probado.
     */
    const { texto } = await pintado([], `/robot/${HOST}`)
    expect(texto).toMatch(/dirección IP/i)
    expect(texto).toMatch(/de 1 a 16/)
    // Y no finge un editor utilizable sobre un enlace que no puede abrir… pero
    // tampoco esconde el chasis: el editor se ve, y lo que falla se explica.
    expect(texto).toMatch(/agente/i)
  }, 120000)
})

describe.skipIf(!CORRER)('🆕 INFRARROJOS: el robot que se mueve solo', () => {
  it('🔴 lo dice en pantalla, y estrena el camino de pintado POSIBLE', async () => {
    /*
     * `following` y `evading` son modos del FIRMWARE: no pasan por `cmd_vel`, asi
     * que sin `/estado_ir.conduciendo_por_ir` esta pantalla razonaria sobre un
     * robot «quieto» que esta cruzando el aula.
     *
     * 🔴 Y hay una razon para mirarlo en el navegador de verdad y no solo con
     *    `diagnosticar()`: `POSIBLE` estaba DECLARADO en el tipo y pintado en el
     *    componente desde siempre, pero NINGUNA causa lo producia. Este es el
     *    primer render de ese camino, y un camino que nunca se ha ejecutado no
     *    esta probado por estar escrito.
     */
    const { texto } = await pintado(['--conduciendo-ir'], `/robot/${HOST}/no-obedece`)
    expect(texto).toContain('El robot se está moviendo SOLO, por infrarrojos')
    /*
     * La etiqueta de POSIBLE, **tal como se VE**: el componente la declara
     * `'puede ser'` y la pinta en MAYUSCULAS. Esta prueba fallo primero
     * comprobando la minuscula —o sea comprobando el codigo fuente y no la
     * pantalla—, que es justo lo que estas pruebas existen para no hacer.
     */
    expect(texto).toContain('PUEDE SER')
    // 🔴 Y NO promete un boton: los servicios que quitan el modo estan cerrados.
    expect(texto).toContain('no desde aquí')
    /*
     * 🔴 EL TITULAR, que es lo que se lee ANTES que la tarjeta. Esta linea la
     * puso el volcado de esta misma prueba: decia «Ninguna de las causas
     * conocidas encaja» justo encima del aviso de que el robot se mueve solo.
     */
    expect(texto).toContain('Ninguna confirmada, pero hay una que mirar')
    expect(texto).not.toContain('Ninguna de las causas conocidas encaja')
  }, 120000)

  it('🔴 EL CONTROL: sin infrarrojos la tarjeta NO aparece', async () => {
    /*
     * Sin este caso, una pantalla que pintara la tarjeta SIEMPRE pasaria el de
     * arriba sin despeinarse. Es la mitad negativa, que es la que separa «lo
     * detecta» de «lo dice siempre».
     */
    const { texto } = await pintado([], `/robot/${HOST}/no-obedece`)
    expect(texto).not.toContain('por infrarrojos')
    // Y el titular vuelve al de siempre: el control tambien lo cubre.
    expect(texto).toContain('Ninguna de las causas conocidas encaja')
  }, 120000)
})

describe.skipIf(!CORRER)('🔴 APROXIMACION: la tarjeta que decia lo contrario', () => {
  it('con el robot QUIETO, afirma el bloqueo y dice que no puede salir solo', async () => {
    /*
     * Medido en rvr-01 con 24 estaciones a mano en las cuatro direcciones
     * (evidencias 93-95): con algo dentro del circulo de 15 cm, `approach`
     * multiplica el mando ENTERO por cero.
     *   AVANZAR alejandose 0,0 cm · GIRAR 0,0° · RETROCEDER 0,0 cm
     */
    const { avisos } = await pintado(['--aproximacion'], `/robot/${HOST}/conducir`)

    expect(avisos).toMatch(/BLOQUEADO/)
    expect(avisos).toMatch(/no puede salir solo/i)
    // Las tres cifras, para que quien lo lea pueda comprobarlo:
    expect(avisos).toMatch(/0,0 cm/)
    expect(avisos).toMatch(/0,0°/)
    // Y el remedio que si funciona:
    expect(avisos).toMatch(/con la mano/i)
  }, 120000)

  it('🔴 y NO lo llama «va mas despacio» ni manda a probar marcha atras', async () => {
    /*
     * 🔴 SOBRE `avisos`, NO SOBRE LA PAGINA. Escrito primero contra la pagina
     *    entera, saltó — y era un FALSO POSITIVO mio: mas abajo hay un bloque
     *    permanente que explica el 40 % del poligono `Precaucion`, y es correcto
     *    que este ahi. Lo prohibido es que lo diga LA TARJETA de la accion 3.
     */
    const { avisos } = await pintado(['--aproximacion'], `/robot/${HOST}/conducir`)

    expect(avisos).not.toMatch(/te est[aá] frenando ahora mismo/i)
    expect(avisos).not.toMatch(/al 40 ?%/)
    expect(avisos).toMatch(/No insistas ni pruebes marcha atr[aá]s/i)
  }, 120000)

  it('🔴🔴 EL CONTROL: con el robot MOVIENDOSE, el mensaje CAMBIA', async () => {
    /*
     * Misma accion 3, pero `/odom` a 0,100 m/s. Si dijera lo mismo en los dos
     * casos, la pantalla estaria AFIRMANDO un congelamiento que no ha visto —
     * el error simetrico del que se corrigio, y igual de malo.
     *
     * `approach` cubre desde «un poco mas lento» hasta cero CON EL MISMO
     * action_type, asi que sin mirar el efecto no se puede elegir.
     */
    const { avisos } = await pintado(['--aproximacion', '--moviendose'], `/robot/${HOST}/conducir`)

    expect(avisos).toMatch(/puede quedar bloqueado/i)
    expect(avisos).not.toMatch(/El robot est[aá] BLOQUEADO y no puede salir solo/i)
  }, 120000)
})

describe.skipIf(!CORRER)('la tarjeta del mapa: los tres avisos, y ningun semaforo', () => {
  it('trae los TRES, no dos', async () => {
    const { texto: t } = await pintado([], `/robot/${HOST}/navegar`)

    // 1 · el fallo de los 41 cm: ¿es de este sitio?
    expect(t).toMatch(/de este sitio|41 cm/i)
    // 2 · el mtime rejuvenece un mapa copiado
    expect(t).toMatch(/copiar un mapa viejo/i)
    // 3 · anadido el 2026-08-09: una fecha reciente tampoco basta
    expect(t).toMatch(/metros recorridos/i)
    expect(t).toMatch(/160 cm/)
    expect(t).toMatch(/781 cm/)
  }, 120000)

  it('🔴 y NO pinta ningun veredicto sobre la edad', async () => {
    /*
     * Ni por arriba ni por abajo. La web no puede medir la calidad —el robot
     * publica nombre y edad, y ni nodos ni cobertura viajan— y un umbral de
     * «demasiado nuevo» seria falso: un mapa de 8 m puede tener dos minutos y
     * estar perfecto. Se ensena el dato y decide quien conduce.
     */
    const { texto: t } = await pintado([], `/robot/${HOST}/navegar`)

    /*
     * 🔴 SE BUSCAN VEREDICTOS, NO LA PALABRA «viejo». La primera version puso
     *    `/mapa (viejo|...)/` y salto sobre el aviso «copiar un mapa viejo lo
     *    rejuvenece» — que es un HECHO y que OTRA prueba de este fichero exige.
     *    Un detector que prohibe la palabra en vez del juicio deja sin poder
     *    explicar el fenomeno.
     */
    expect(t).not.toMatch(/mapa (caducado|obsoleto|vencido|vigente|al d[ií]a)/i)
    expect(t).not.toMatch(/(demasiado (viejo|nuevo|reciente)|hay que remapear ya)/i)
  }, 120000)
})
