/**
 * EL DOBLE DEL AGENTE, PROBADO DE VERDAD.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE EXISTE ESTE FICHERO
 * ═══════════════════════════════════════════════════════════════════════════
 * `agente_de_mentira.mjs` es lo unico que deja recorrer el Taller sin robot, y
 * hasta hoy **sus tres rechazos se habian ejercitado a mano, una vez**. Lo marco
 * la auditoria del robot (evidencia 117 §6): «el doble sin pruebas
 * automatizadas».
 *
 * Y el aviso no es teorico en este repositorio: **el doble de rosbridge se quedo
 * atras de los nombres de `/encoders` y durante un rato parecio que la web
 * estaba rota**. Un doble que miente es peor que no tener doble, porque manda a
 * buscar el fallo al sitio equivocado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL CONTROL POSITIVO ES LA MITAD DE CADA PRUEBA
 * ═══════════════════════════════════════════════════════════════════════════
 * Comprobar solo que rechaza no distingue **«rechaza lo malo»** de **«rechaza
 * siempre»** — un doble roto que cierra todas las conexiones pasaria los cuatro
 * rechazos con nota. Por eso el primer caso de este fichero es un testigo BUENO
 * que ABRE, y los rechazos se leen contra el.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LO QUE ESTO **NO** PRUEBA, y hay que leerlo antes de fiarse
 * ═══════════════════════════════════════════════════════════════════════════
 * Nada del robot. Ni PTY, ni señales, ni `input()` de verdad. Prueba **el
 * doble**, que es un instrumento — y la regla de este proyecto es que antes de
 * creerte un instrumento lo pongas en un estado que conozcas y compruebes que lo
 * ve. Eso es exactamente lo que hay aqui.
 *
 * Se firma con `firmarTestigoRobot`, o sea con **el firmador de verdad del
 * servidor**: si el doble y la web dejaran de entenderse, esto se pone rojo.
 */

import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { connect, type Socket } from 'node:net'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE, clavePrivadaDe, firmarTestigoRobot,
} from '@/lib/sesion/testigo_robot'

const AQUI = dirname(fileURLToPath(import.meta.url))
const DOBLE = join(AQUI, '..', '..', '..', '..', 'herramientas', 'agente_de_mentira.mjs')
const ESTUDIANTES = join(AQUI, '..', '..', '..', '..', '..', 'Atriz_rvr', 'scripts', 'estudiantes')

/*
 * ═════════════════════════════════════════════════════════════════════════
 * La clave: EFIMERA, generada aqui, y nunca escrita al disco
 * ═════════════════════════════════════════════════════════════════════════
 * 🔴 Antes el doble solo leia `frontend/.env.local`, asi que probarlo obligaba a
 *    tener un secreto en el disco — y en una maquina sin el, la prueba se
 *    saltaria. «Saltada» no es «pasada»: una prueba que se salta sola en la
 *    maquina donde importa no protege nada.
 *
 *    Por eso el doble acepta ahora `ATRIZ_CLAVE` del ENTORNO, igual que el
 *    servidor de Next. Esta clave vive tres segundos y muere con el proceso.
 */
const { privateKey, publicKey: _sinUsar } = generateKeyPairSync('ed25519')
void _sinUsar
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const CLAVE = clavePrivadaDe(PEM)!

/** Otra clave distinta, para el caso «firma que no es de este servidor». */
const PEM_INTRUSO = generateKeyPairSync('ed25519')
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const CLAVE_INTRUSO = clavePrivadaDe(PEM_INTRUSO)!

const AHORA = Date.parse('2026-08-15T10:00:00Z')
const testigoPara = (robot: number, clave = CLAVE, usuario = 'ana') =>
  firmarTestigoRobot(clave, { usuario, robot, ahoraMs: AHORA })

/*
 * ═════════════════════════════════════════════════════════════════════════
 * Un cliente WebSocket a pelo, de treinta lineas
 * ═════════════════════════════════════════════════════════════════════════
 * 🔴 NO se usa el `WebSocket` global de Node, y no es purismo: con ese no se
 *    puede conectar SIN ofrecer subprotocolo (la biblioteca aborta el apreton
 *    por su cuenta antes de que llegue el cierre del servidor), asi que el caso
 *    4401 —el que mas se parece a un cliente viejo o a `wscat`— seria
 *    inalcanzable. Y tampoco deja mirar las CABECERAS de la respuesta, que es
 *    justo lo que hay que comprobar en el rechazo.
 */
interface Apreton {
  estado: number
  cabeceras: Record<string, string>
  socket: Socket
  sobra: Buffer
}

function apretonDeManos(puerto: number, protocolos: string[]): Promise<Apreton> {
  return new Promise((resolver, rechazar) => {
    const s = connect(puerto, '127.0.0.1', () => {
      s.write(
        'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
        + `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\n`
        + 'Sec-WebSocket-Version: 13\r\n'
        + (protocolos.length > 0 ? `Sec-WebSocket-Protocol: ${protocolos.join(', ')}\r\n` : '')
        + '\r\n',
      )
    })
    let buf = Buffer.alloc(0)
    const alLlegar = (b: Buffer) => {
      buf = Buffer.concat([buf, b])
      const corte = buf.indexOf('\r\n\r\n')
      if (corte === -1) return
      s.off('data', alLlegar)
      const lineas = buf.subarray(0, corte).toString('utf8').split('\r\n')
      const cabeceras: Record<string, string> = {}
      for (const l of lineas.slice(1)) {
        const i = l.indexOf(':')
        if (i > 0) cabeceras[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim()
      }
      resolver({
        estado: Number(lineas[0]?.split(' ')[1] ?? 0),
        cabeceras,
        socket: s,
        sobra: buf.subarray(corte + 4),
      })
    }
    s.on('data', alLlegar)
    s.on('error', rechazar)
  })
}

/** Marco del CLIENTE: va enmascarado, que es obligatorio en esa dirección. */
function marcoCliente(texto: string): Buffer {
  const carga = Buffer.from(texto, 'utf8')
  const mask = randomBytes(4)
  const n = carga.length
  const cab = n < 126
    ? Buffer.from([0x81, 0x80 | n])
    : (() => { const c = Buffer.alloc(4); c[0] = 0x81; c[1] = 0x80 | 126; c.writeUInt16BE(n, 2); return c })()
  const cifrada = Buffer.from(carga)
  for (let i = 0; i < cifrada.length; i += 1) cifrada[i]! ^= mask[i % 4]!
  return Buffer.concat([cab, mask, cifrada])
}

interface Cosecha { mensajes: Record<string, unknown>[]; cierre: { codigo: number; motivo: string } | null }

/** Escucha `ms` milisegundos y devuelve lo que llegó, ya desmarcado. */
function cosechar(a: Apreton, ms: number): Promise<Cosecha> {
  return new Promise((resolver) => {
    let buf = a.sobra
    const mensajes: Record<string, unknown>[] = []
    let cierre: { codigo: number; motivo: string } | null = null
    const alLlegar = (b: Buffer) => { buf = Buffer.concat([buf, b]) }
    a.socket.on('data', alLlegar)
    setTimeout(() => {
      a.socket.off('data', alLlegar)
      let i = 0
      while (i + 2 <= buf.length) {
        const codigoOp = buf[i]! & 0x0f
        let n = buf[i + 1]! & 0x7f
        let j = i + 2
        if (n === 126) { n = buf.readUInt16BE(j); j += 2 }
        else if (n === 127) { n = Number(buf.readBigUInt64BE(j)); j += 8 }
        const carga = buf.subarray(j, j + n)
        if (carga.length < n) break
        if (codigoOp === 0x01) {
          try { mensajes.push(JSON.parse(carga.toString('utf8')) as Record<string, unknown>) } catch { /* ruido */ }
        } else if (codigoOp === 0x08 && n >= 2) {
          cierre = { codigo: carga.readUInt16BE(0), motivo: carga.subarray(2).toString('utf8') }
        }
        i = j + n
      }
      a.socket.destroy()
      resolver({ mensajes, cierre })
    }, ms)
  })
}

/*
 * ═════════════════════════════════════════════════════════════════════════
 * Levantar el doble
 * ═════════════════════════════════════════════════════════════════════════
 * `--puerto 0` deja que el sistema elija uno libre, y el doble imprime el que le
 * tocó. Sin eso, dos ficheros de prueba corriendo a la vez chocarían por un
 * número fijo — y el sintoma seria «falla a veces», que es lo peor de depurar.
 */
interface Doble { proceso: ChildProcessWithoutNullStreams; puerto: number }

function arrancar(...banderas: string[]): Promise<Doble> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(process.execPath, [DOBLE, '--puerto', '0', ...banderas], {
      env: { ...process.env, ATRIZ_CLAVE: PEM },
    })
    let salida = ''
    const plazo = setTimeout(() => {
      proceso.kill()
      rechazar(new Error(`el doble no dijo LISTO en 10 s. Dijo:\n${salida}`))
    }, 10_000)
    proceso.stdout.on('data', (b: Buffer) => {
      salida += b.toString('utf8')
      const m = /LISTO (\d+)/.exec(salida)
      if (m !== null) { clearTimeout(plazo); resolver({ proceso, puerto: Number(m[1]) }) }
    })
    proceso.stderr.on('data', (b: Buffer) => { salida += b.toString('utf8') })
    proceso.on('error', rechazar)
  })
}

let sano: Doble
let sinReloj: Doble
let ocupado: Doble

beforeAll(async () => {
  ;[sano, sinReloj, ocupado] = await Promise.all([
    arrancar('--robot', '7'),
    arrancar('--robot', '7', '--sin-reloj'),
    arrancar('--robot', '7', '--ocupado', 'luis'),
  ])
}, 30_000)

afterAll(() => { [sano, sinReloj, ocupado].forEach((d) => d?.proceso.kill()) })

const conTestigo = (t: string) => [`${PREFIJO_TESTIGO}${t}`, SUBPROTOCOLO_AGENTE]

describe('🔴 el control positivo: un testigo bueno ABRE', () => {
  it('101, subprotocolo devuelto, bienvenida, y NINGUN cierre', async () => {
    const a = await apretonDeManos(sano.puerto, conTestigo(testigoPara(7)))
    expect(a.estado).toBe(101)
    expect(a.cabeceras['sec-websocket-protocol']).toBe(SUBPROTOCOLO_AGENTE)

    const c = await cosechar(a, 400)
    expect(c.cierre).toBeNull()          // <- la mitad que hace validos los rechazos
    const bienvenida = c.mensajes.find((m) => m.op === 'atriz_bienvenida')
    expect(bienvenida).toBeDefined()
    expect(bienvenida?.robot).toBe(7)
    expect(bienvenida?.sujeto).toBe('ana')
  })
})

describe('los cuatro rechazos, cada uno con su codigo', () => {
  it('sin testigo → 4401, y el motivo NO va vacio', async () => {
    const a = await apretonDeManos(sano.puerto, [])
    const c = await cosechar(a, 300)
    expect(c.cierre?.codigo).toBe(4401)
    expect(c.cierre?.motivo.length).toBeGreaterThan(0)
    /*
     * 🔴🔴 Y AQUI NO PUEDE VENIR SUBPROTOCOLO, aunque el resto de casos SI lo
     *    exijan. Este cliente **no ofreció ninguno**, y el agente de verdad no
     *    puede inventarse uno: tornado hace
     *    `assert self.selected_subprotocol in subprotocols` y lo convierte en
     *    un `AssertionError` + **HTTP 500**, no en este cierre.
     *
     *    Se descubrió al revés de lo cómodo: esta prueba estaba en VERDE y el
     *    robot daba 500 en el journal (2026-08-15). El doble escribía la
     *    cabecera a mano y era **más permisivo que el robot**, así que la
     *    prueba certificaba un camino que en producción reventaba.
     *    📌 Un doble que miente sobre el MANEJO DE ERRORES es el peor: los
     *       datos se acaban comparando contra el robot; los errores, no.
     */
    expect(a.cabeceras['sec-websocket-protocol']).toBeUndefined()
  })

  it('firma de otra clave → 4403', async () => {
    // El testigo esta bien formado y dice lo correcto: lo unico malo es QUIEN lo
    // firmo. Es el caso que un `JSON.parse` antes de verificar dejaria pasar.
    const a = await apretonDeManos(sano.puerto, conTestigo(testigoPara(7, CLAVE_INTRUSO)))
    const c = await cosechar(a, 300)
    expect(c.cierre?.codigo).toBe(4403)
  })

  it('testigo de OTRO robot → 4404, y dice de cual', async () => {
    const a = await apretonDeManos(sano.puerto, conTestigo(testigoPara(3)))
    const c = await cosechar(a, 300)
    expect(c.cierre?.codigo).toBe(4404)
    expect(c.cierre?.motivo).toContain('3')
    expect(c.cierre?.motivo).toContain('7')
  })

  it('la Pi sin hora → 1013, con el testigo BUENO', async () => {
    // Con un testigo malo este caso no probaria nada: hay que llegar al reloj.
    const a = await apretonDeManos(sinReloj.puerto, conTestigo(testigoPara(7)))
    const c = await cosechar(a, 300)
    expect(c.cierre?.codigo).toBe(1013)
  })

  it('🔴 y el subprotocolo se devuelve TAMBIEN al rechazar', async () => {
    /*
     * Es el detalle que produce el peor sintoma posible si se rompe: sin
     * subprotocolo en la respuesta, el navegador cierra por su cuenta con **1006
     * y sin motivo**, asi que el alumno ve «la conexion se corto» en vez de «esa
     * credencial es de otro robot», y se busca en el robot.
     *
     * Se comprueba en los CUATRO, porque el bug natural es acordarse en el
     * camino feliz y olvidarlo en uno de los de error.
     */
    /*
     * 🔴 Los tres casos que SI ofrecieron `atriz.v1`. El de «sin testigo» no
     *    esta aqui a proposito: ese cliente no ofrecio ninguno, y devolverle uno
     *    revienta el agente de verdad con `AssertionError` + HTTP 500 (tornado
     *    lo comprueba). Su comprobacion —que NO venga— vive en su propia prueba,
     *    arriba. Meterlo aqui era lo que dejaba pasar la divergencia.
     */
    const casos: [number, string[]][] = [
      [sano.puerto, conTestigo(testigoPara(7, CLAVE_INTRUSO))],
      [sano.puerto, conTestigo(testigoPara(3))],
      [sinReloj.puerto, conTestigo(testigoPara(7))],
    ]
    for (const [puerto, protocolos] of casos) {
      const a = await apretonDeManos(puerto, protocolos)
      expect(a.estado).toBe(101)
      expect(a.cabeceras['sec-websocket-protocol']).toBe(SUBPROTOCOLO_AGENTE)
      a.socket.destroy()
    }
  })
})

describe('🔴 las practicas que lista son las de VERDAD', () => {
  it('cada nombre que da existe en el disco del repo del robot', async () => {
    /*
     * Este es el fallo concreto que este trabajo encontro: `espacio.ts` listaba
     * CINCO ficheros que no existen en el robot. Un doble que rellene la lista
     * con nombres plausibles haria creer que la cadena funciona, y el boton
     * fallaria en el aula.
     */
    const a = await apretonDeManos(sano.puerto, conTestigo(testigoPara(7)))
    a.socket.write(marcoCliente(JSON.stringify({ op: 'atriz_listar' })))
    const c = await cosechar(a, 500)
    const listado = c.mensajes.find((m) => m.op === 'atriz_listado')
    expect(listado).toBeDefined()
    const ficheros = listado?.ficheros as { nombre: string }[]

    if (!existsSync(ESTUDIANTES)) {
      // 🔴 Sin el repo del robot al lado, lo correcto es VACIA, no inventada.
      //    Y esto es una asercion, no un salto: comprueba la otra rama.
      expect(ficheros).toEqual([])
      return
    }
    const enDisco = new Set(readdirSync(ESTUDIANTES).filter((n) => n.endsWith('.py')))
    expect(ficheros.length).toBeGreaterThan(0)
    for (const f of ficheros) expect(enDisco.has(f.nombre)).toBe(true)
    // Y `atriz.py` NO es una practica: es la biblioteca.
    expect(ficheros.some((f) => f.nombre === 'atriz.py')).toBe(false)
  })
})

describe('🔴 ocupado: se dice QUIEN, y NO se cierra la conexion', () => {
  it('el segundo alumno ve el nombre del primero y sigue conectado', async () => {
    /*
     * Cerrarle el socket al segundo seria lo facil y lo peor: veria «se cortó la
     * conexion» y se pondria a reintentar, cuando lo que necesita saber es que
     * el robot lo tiene Luis. La conexion se queda ABIERTA a proposito.
     */
    const a = await apretonDeManos(ocupado.puerto, conTestigo(testigoPara(7)))
    a.socket.write(marcoCliente(JSON.stringify({
      op: 'atriz_exec', codigo: 'print(1)', nombre: 'mi_programa.py',
    })))
    const c = await cosechar(a, 600)
    const rechazo = c.mensajes.find((m) => m.op === 'atriz_rechazo')
    expect(rechazo?.codigo).toBe('OCUPADO')
    expect(String(rechazo?.motivo)).toContain('luis')
    expect(c.cierre).toBeNull()
    // Y la bienvenida ya traia la ranura, para que se vea ANTES de intentarlo.
    const bienvenida = c.mensajes.find((m) => m.op === 'atriz_bienvenida')
    expect((bienvenida?.sesion as { sujeto: string } | null)?.sujeto).toBe('luis')
  })
})
