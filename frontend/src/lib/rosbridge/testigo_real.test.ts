/**
 * EL TESTIGO CONTRA EL ROSBRIDGE PARCHEADO DE VERDAD — Fase B (A7).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTO NO PUEDE PROBARSE CONTRA UN DOBLE
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se comprueba aqui es el APRETON de tornado, y tornado es una biblioteca
 * que el doble no tiene. El 2026-08-15 (evidencia 120) esa diferencia exacta
 * dejo en verde una prueba del Taller sobre un camino que en el robot devolvia
 * **HTTP 500**: el doble escribe la cabecera del apreton a mano y no ejecuta el
 * `assert self.selected_subprotocol in subprotocols` del original.
 *
 * La regla que salio de ahi, y por la que existe este fichero: *lo que un doble
 * no puede reproducir es su manejo de errores, porque el error lo produce la
 * BIBLIOTECA del original.*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Como se corre
 * ═══════════════════════════════════════════════════════════════════════════
 *   ATRIZ_ROBOT=1 ATRIZ_URL_TESTIGO=ws://192.168.1.200:9091 \
 *     npx vitest run src/lib/rosbridge/testigo_real.test.ts
 *
 * Sin `ATRIZ_ROBOT=1` se salta. ⚠️ Y `skipped` NO es `passed`.
 *
 * 🔑 Firma con `firmarTestigoRobot`, que es **el mismo codigo que usa la web**.
 *    Reimplementar la firma aqui probaria mi reimplementacion, no el contrato —
 *    que es justo el fallo que `emitir_testigo_ejemplo.mjs` existe para evitar
 *    en el otro sentido.
 *
 * ⚠️ NO MUEVE EL ROBOT: solo abre conexiones y se suscribe a `/odom`.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { clavePrivadaDe, firmarTestigoRobot } from '@/lib/sesion/testigo_robot'
import { PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE } from '@/lib/sesion/enlace_agente'

const CON_ROBOT = process.env.ATRIZ_ROBOT === '1'
//: Se llama URL_PRUEBA y no URL porque `URL` es el global que usa `new URL(...)`
//: mas abajo para leer .env.local: llamarla igual la TAPA, y tsc lo caza con un
//: «This expression is not constructable» que no menciona el sombreado.
const URL_PRUEBA = process.env.ATRIZ_URL_TESTIGO ?? 'ws://rvr-01.local:9091'
const ROBOT = Number(process.env.ATRIZ_ROBOT_NUM ?? 1)

/** Los codigos que `rosbridge_nucleo.py` y `atriz_testigo.py` comparten. */
const CIERRE = { SIN_TESTIGO: 4401, TESTIGO_MALO: 4403, OTRO_ROBOT: 4404 } as const

/**
 * La clave privada. vitest no carga `.env.local`, asi que se lee a mano.
 *
 * 🔴 Si falta, esto FALLA en vez de saltar: un fichero que se salta cuando no
 *    encuentra la clave es indistinguible de uno que pasa, y esa confusion ya
 *    costo cara hoy.
 */
function clave() {
  let pem = process.env.ATRIZ_CLAVE
  if (pem === undefined || pem.trim() === '') {
    const env = readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8')
    pem = env.split('\n').find((l) => l.startsWith('ATRIZ_CLAVE='))?.slice('ATRIZ_CLAVE='.length)
    if (pem?.startsWith('"') && pem.endsWith('"')) pem = pem.slice(1, -1)
  }
  const k = clavePrivadaDe(pem)
  if (k === null) throw new Error('no hay ATRIZ_CLAVE utilizable: ni en el entorno ni en .env.local')
  return k
}

function testigoPara(robot: number, usuario = 'prueba-a7') {
  return firmarTestigoRobot(clave(), { usuario, robot, ahoraMs: Date.now() })
}

interface Desenlace {
  abrio: boolean
  codigo: number
  motivo: string
  subprotocolo: string
}

/** Abre, espera desenlace, y devuelve QUE paso. Nunca lanza por un cierre. */
function conectar(protocolos: string[], msEspera = 8000): Promise<Desenlace> {
  return new Promise((resolver, rechazar) => {
    const ws = protocolos.length > 0 ? new WebSocket(URL_PRUEBA, protocolos) : new WebSocket(URL_PRUEBA)
    let abrio = false
    const plazo = setTimeout(() => {
      ws.close()
      rechazar(new Error(`ni abrio ni cerro en ${msEspera} ms: ${URL_PRUEBA}`))
    }, msEspera)

    ws.onopen = () => {
      abrio = true
      // Se cierra en cuanto abre: lo que se mide es el APRETON.
      setTimeout(() => ws.close(1000, 'fin de la prueba'), 60)
    }
    ws.onclose = (e) => {
      clearTimeout(plazo)
      resolver({ abrio, codigo: e.code, motivo: e.reason, subprotocolo: ws.protocol })
    }
  })
}

describe.skipIf(!CON_ROBOT)('el testigo contra el rosbridge parcheado', () => {
  it('🔴 SIN TESTIGO se rechaza con 4401, y CON MOTIVO', async () => {
    const d = await conectar([SUBPROTOCOLO_AGENTE])
    expect(d.codigo).toBe(CIERRE.SIN_TESTIGO)
    // Un cierre mudo manda al alumno a buscar al profesor. Este proyecto lo
    // tiene medido, y por eso el motivo se comprueba.
    expect(d.motivo.length).toBeGreaterThan(10)
  })

  it('🔴 SIN OFRECER NINGUN SUBPROTOCOLO cierra limpio, no da HTTP 500', async () => {
    // Es el caso exacto que en el agente del Taller reventaba con AssertionError
    // porque `select_subprotocol` devolvia un valor fijo (evidencia 120).
    const d = await conectar([])
    expect(d.codigo).toBe(CIERRE.SIN_TESTIGO)
  })

  it('🔴 con un testigo INVENTADO se rechaza con 4403', async () => {
    const d = await conectar([`${PREFIJO_TESTIGO}esto.no.esunjwt`])
    expect(d.codigo).toBe(CIERRE.TESTIGO_MALO)
  })

  it('🔴 con un testigo BIEN FIRMADO pero de OTRO robot se rechaza con 4404', async () => {
    // La firma es valida: lo unico malo es el numero. Distingue «no te creo» de
    // «no eres de aqui», que es el requisito 1 entero.
    const otro = ROBOT === 1 ? 2 : 1
    const d = await conectar([`${PREFIJO_TESTIGO}${testigoPara(otro)}`, SUBPROTOCOLO_AGENTE])
    expect(d.codigo).toBe(CIERRE.OTRO_ROBOT)
    expect(d.motivo).toContain(String(otro))
  })

  it('🔴🔴 `onopen` SE DISPARA AUNQUE EL TESTIGO SEA MALO — el cliente no puede fiarse', async () => {
    // Un rechazo CON MOTIVO solo se puede mandar DESPUES del apreton: tornado ya
    // acepto la conexion cuando `open()` llama a `close(4401, ...)`. Asi que el
    // navegador dispara `onopen` y **luego** `onclose`.
    //
    // 🔴 Consecuencia para el cliente (F2): pintar «conectado» en `onopen` es
    //    FALSO. Hay que esperar al cierre inmediato, o el alumno vera «conectado»
    //    sobre un robot que le acaba de cerrar la puerta — y este proyecto ya
    //    tiene medido lo que cuesta un estado que afirma de mas.
    //
    // 📝 Y esto estuvo escondido: en la primera tanda contra el robot esta
    //    expectativa «pasaba» con `abrio === false`, pero solo porque el servidor
    //    reventaba y abortaba la conexion (1006). Al arreglar el servidor
    //    aparecio el comportamiento de verdad. Un fallo tapaba un malentendido.
    const d = await conectar([SUBPROTOCOLO_AGENTE])
    expect(d.abrio).toBe(true)
    expect(d.codigo).toBe(CIERRE.SIN_TESTIGO)
  })

  it('✅ EL CONTROL POSITIVO: con el testigo bueno ABRE', async () => {
    // Sin esto, los cuatro rechazos de arriba pasarian igual con un rosbridge
    // que rechazara a TODO EL MUNDO — que es el fallo mas facil de cometer aqui.
    const d = await conectar([`${PREFIJO_TESTIGO}${testigoPara(ROBOT)}`, SUBPROTOCOLO_AGENTE])
    expect(d.abrio).toBe(true)
    expect(d.codigo).toBe(1000)
  })

  it('✅ y el subprotocolo devuelto es uno de los OFRECIDOS', async () => {
    const ofrecidos = [`${PREFIJO_TESTIGO}${testigoPara(ROBOT)}`, SUBPROTOCOLO_AGENTE]
    const d = await conectar(ofrecidos)
    expect(d.abrio).toBe(true)
    expect(ofrecidos).toContain(d.subprotocolo)
  })

  it('✅ y una vez dentro rosbridge SIGUE SIENDO rosbridge: llegan datos de /odom', async () => {
    // El parche podria dejar pasar el apreton y romper el nodo. Esto lo separa:
    // no basta con entrar, hay que poder trabajar.
    const ws = new WebSocket(URL_PRUEBA, [`${PREFIJO_TESTIGO}${testigoPara(ROBOT)}`, SUBPROTOCOLO_AGENTE])
    const mensajes: unknown[] = []
    await new Promise<void>((resolver, rechazar) => {
      const plazo = setTimeout(() => { ws.close(); rechazar(new Error('sin /odom en 10 s')) }, 10000)
      ws.onopen = () => ws.send(JSON.stringify({ op: 'subscribe', topic: '/odom' }))
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data))
        if (m.op === 'publish' && m.topic === '/odom') {
          mensajes.push(m)
          if (mensajes.length >= 3) { clearTimeout(plazo); ws.close(1000, 'ya'); resolver() }
        }
      }
    })
    expect(mensajes.length).toBeGreaterThanOrEqual(3)
  }, 15000)
})
