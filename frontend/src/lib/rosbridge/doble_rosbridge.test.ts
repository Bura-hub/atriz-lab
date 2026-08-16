/**
 * EL DOBLE DE rosbridge APRENDE EL APRETON DEL TESTIGO — Fase B (A7).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 PARA QUE SIRVE, Y SOBRE TODO PARA QUE **NO**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sirve para ejercitar el lado del CLIENTE sin robot: que no reintente un 4403,
 * que enseñe el motivo, que el 1013 si reintente. Y para que las pruebas de
 * pantalla sigan funcionando cuando la web empiece a mandar el testigo.
 *
 * **NO prueba que el robot acepte o rechace nada.** Este doble:
 *   · NO verifica ninguna firma —mira si el subprotocolo empieza por
 *     `atriz.token.` y ya—, asi que su «aceptado» no dice nada de la credencial;
 *   · escribe el apreton A MANO, asi que no ejecuta el
 *     `assert self.selected_subprotocol in subprotocols` de tornado.
 *
 * Esa segunda diferencia es exactamente la que el 2026-08-15 dejo EN VERDE una
 * prueba del Taller sobre un camino que en el robot devolvia HTTP 500
 * (evidencia 120). Lo que se afirme aqui sobre el apreton hay que confirmarlo
 * contra rvr-01: `testigo_real.test.ts`.
 */

import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE } from '@/lib/sesion/enlace_agente'

/*
 * 🔴 `fileURLToPath`, NO `.pathname`. La ruta de este proyecto lleva espacios
 *    («MaIE - UDENAR»), y `.pathname` los deja PERCENT-CODIFICADOS: `%20`.
 *    `spawn` recibia una ruta que no existe, el proceso moria al instante, y el
 *    unico sintoma era que mi propio plazo vencia a los 5 s — o sea «el doble no
 *    dijo su puerto», que manda a mirar el doble, donde no estaba el problema.
 */
const DOBLE = fileURLToPath(new URL('../../../../herramientas/rosbridge_de_mentira.mjs', import.meta.url))

// El tipo REAL de `stdio: ['ignore','pipe','pipe']`: sin stdin, con los dos de
// salida. Forzarlo a `ChildProcessWithoutNullStreams` era una conversion que tsc
// rechaza con razon — prometia un stdin que no existe.
type Proceso = ChildProcessByStdio<null, Readable, Readable>

interface Doble { proceso: Proceso; puerto: number }

/** `--puerto 0`: el sistema elige uno libre y el doble imprime cual. */
function arrancar(...banderas: string[]): Promise<Doble> {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(process.execPath, [DOBLE, '--puerto', '0', ...banderas], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    /*
     * 🔴 Se escuchan `error` y `stderr`. Sin esto, un fallo al lanzar —una ruta
     *    mal formada, por ejemplo— se veia SOLO como «no dijo su puerto en 5 s»,
     *    que apunta al doble en vez de a quien lo lanza. Costo un rato.
     */
    let ruido = ''
    const plazo = setTimeout(() => {
      proceso.kill()
      rechazar(new Error(`el doble no dijo su puerto en 5 s.
  ruta: ${DOBLE}
  dijo: ${ruido || '(nada)'}`))
    }, 5000)
    proceso.on('error', (e) => { clearTimeout(plazo); rechazar(new Error(`no pude lanzar ${DOBLE}: ${e.message}`)) })
    proceso.stderr.on('data', (b: Buffer) => { ruido += b.toString() })
    proceso.stdout.on('data', (b: Buffer) => {
      const m = /ws:\/\/localhost:(\d+)/.exec(b.toString())
      if (m !== null) { clearTimeout(plazo); resolver({ proceso, puerto: Number(m[1]) }) }
    })
  })
}

interface Desenlace { abrio: boolean; codigo: number; subprotocolo: string }

function tocar(puerto: number, protocolos: string[]): Promise<Desenlace> {
  return new Promise((resolver, rechazar) => {
    const url = `ws://127.0.0.1:${puerto}`
    const ws = protocolos.length > 0 ? new WebSocket(url, protocolos) : new WebSocket(url)
    let abrio = false
    const plazo = setTimeout(() => { ws.close(); rechazar(new Error('ni abrio ni cerro')) }, 5000)
    ws.onopen = () => { abrio = true; setTimeout(() => ws.close(1000, 'fin'), 80) }
    ws.onclose = (e) => {
      clearTimeout(plazo)
      resolver({ abrio, codigo: e.code, subprotocolo: ws.protocol })
    }
  })
}

let vivo: Doble | null = null
afterEach(() => { vivo?.proceso.kill(); vivo = null })

describe('el doble de rosbridge y el testigo', () => {
  it('🔴 con --exige-testigo y SIN testigo, cierra con 4401', async () => {
    vivo = await arrancar('--exige-testigo')
    const d = await tocar(vivo.puerto, [SUBPROTOCOLO_AGENTE])
    expect(d.codigo).toBe(4401)
  })

  it('✅ EL CONTROL: el mismo doble CON testigo deja entrar', async () => {
    // Sin esto, «rechaza» pasaria igual con un doble que rechazara siempre.
    vivo = await arrancar('--exige-testigo')
    const d = await tocar(vivo.puerto, [`${PREFIJO_TESTIGO}loquesea`, SUBPROTOCOLO_AGENTE])
    expect(d.abrio).toBe(true)
    expect(d.codigo).toBe(1000)
  })

  it('🔴 --rechazar 4404 cierra con 4404 aunque el testigo venga', async () => {
    // Es como se ejercita «credencial de otro robot» en el cliente sin robot.
    vivo = await arrancar('--rechazar', '4404')
    const d = await tocar(vivo.puerto, [`${PREFIJO_TESTIGO}loquesea`, SUBPROTOCOLO_AGENTE])
    expect(d.codigo).toBe(4404)
  })

  it('✅ sin banderas se comporta como siempre: abre', async () => {
    // El doble se usa a diario para mirar pantallas; esto impide que la Fase B
    // le rompa ese uso.
    vivo = await arrancar()
    const d = await tocar(vivo.puerto, [])
    expect(d.abrio).toBe(true)
  })

  describe('el subprotocolo que devuelve', () => {
    it('devuelve `atriz.v1` cuando el cliente lo ofrece', async () => {
      vivo = await arrancar()
      const d = await tocar(vivo.puerto, [`${PREFIJO_TESTIGO}x`, SUBPROTOCOLO_AGENTE])
      expect(d.subprotocolo).toBe(SUBPROTOCOLO_AGENTE)
    })

    it('🔴 NUNCA devuelve uno que el cliente no haya ofrecido', async () => {
      // La regla del servidor real. Aqui no hay `assert` que la imponga, asi que
      // esta prueba es lo unico que impide que el doble se desvie de lo que el
      // robot hara — y acostumbre al cliente a algo que luego falla.
      vivo = await arrancar()
      const d = await tocar(vivo.puerto, ['solo.esto'])
      expect(d.subprotocolo).toBe('solo.esto')
    })

    it('y sin ofrecer ninguno, no devuelve ninguno', async () => {
      vivo = await arrancar()
      const d = await tocar(vivo.puerto, [])
      expect(d.subprotocolo).toBe('')
    })
  })
})
