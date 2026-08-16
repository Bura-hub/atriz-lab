/**
 * EL TRANSPORTE PIDIENDO EL TESTIGO — Fase B (A7), y su carrera.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE DE VERDAD HAY QUE PROBAR AQUI ES LA CARRERA
 * ═══════════════════════════════════════════════════════════════════════════
 * Que el testigo viaje en el subprotocolo es mecanico. Lo peligroso es que
 * pedirlo es **asincrono** y abrir el socket no lo era: entre «lo pido» y
 * «abro» cabe un `cerrar()` del usuario. Sin la marca de generacion, ese
 * testigo en vuelo abre un socket **despues** de que alguien cerro — telemetria
 * viva a espaldas del usuario, y `/scan` es el 83 % del trafico.
 *
 * Es la misma familia que C3 y R1, las dos ya pagadas en esta clase. Por eso
 * cada prueba de la carrera lleva su control en la otra direccion: sin el, «no
 * se abrio» pasaria igual con un transporte que no abriera nunca.
 */

import { describe, expect, it, vi } from 'vitest'
import { Transporte } from './transporte'
import { PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE } from '@/lib/sesion/enlace_agente'

class WSEspia {
  readyState = 0
  onopen: (() => void) | null = null
  onclose: ((e?: { code?: number; reason?: string }) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  constructor(public url: string, public protocolos?: string[]) {}
  send() { /* nada */ }
  close() { /* nada */ }
}

/** Una promesa que resuelvo yo, para controlar CUANDO llega el testigo. */
function diferida<T>() {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((res, rec) => { resolver = res; rechazar = rec })
  return { promesa, resolver, rechazar }
}

function montar(pedirTestigo: () => Promise<string | null>, opciones: Record<string, unknown> = {}) {
  const creados: WSEspia[] = []
  const programar = vi.fn((_fn: () => void, _ms: number) => 0 as unknown as ReturnType<typeof setTimeout>)
  const t = new Transporte(
    'ws://robot:9090',
    (u, p) => { const w = new WSEspia(u, p); creados.push(w); return w as unknown as WebSocket },
    { reconectar: true, programar, plazoConexion: 0, testigo: pedirTestigo, ...opciones },
  )
  const avisos: string[] = []
  t.alAviso((a) => avisos.push(a.mensaje))
  return { t, creados, programar, avisos }
}

describe('el transporte pidiendo el testigo', () => {
  it('lo manda en el subprotocolo, junto al del robot', async () => {
    const { t, creados } = montar(async () => 'unjwt.de.mentira')
    t.conectar()
    await Promise.resolve(); await Promise.resolve()

    expect(creados).toHaveLength(1)
    expect(creados[0].protocolos).toEqual([
      `${PREFIJO_TESTIGO}unjwt.de.mentira`,
      SUBPROTOCOLO_AGENTE,
    ])
  })

  it('🔴 EL CONTROL: sin proveedor NO manda subprotocolo (el camino de siempre)', async () => {
    const creados: WSEspia[] = []
    const t = new Transporte(
      'ws://robot:9090',
      (u, p) => { const w = new WSEspia(u, p); creados.push(w); return w as unknown as WebSocket },
      { plazoConexion: 0 },
    )
    t.conectar()
    expect(creados[0].protocolos).toBeUndefined()
  })

  describe('🔴 LA CARRERA: un testigo que llega TARDE', () => {
    it('tras `cerrar()`, el testigo que llega NO abre ningun socket', async () => {
      const d = diferida<string | null>()
      const { t, creados } = montar(() => d.promesa)

      t.conectar()          // pide el testigo…
      t.cerrar()            // …y el usuario cierra antes de que llegue
      d.resolver('unjwt.de.mentira')
      await Promise.resolve(); await Promise.resolve()

      expect(creados).toHaveLength(0)
    })

    it('✅ EL CONTROL: sin el `cerrar()`, ese mismo testigo SI abre', async () => {
      // Sin esto, la prueba de arriba pasaria igual con un transporte roto que
      // no abriera nunca.
      const d = diferida<string | null>()
      const { t, creados } = montar(() => d.promesa)

      t.conectar()
      d.resolver('unjwt.de.mentira')
      await Promise.resolve(); await Promise.resolve()

      expect(creados).toHaveLength(1)
      expect(t.conectado).toBe(false)   // sigue en CONNECTING, que es correcto
    })

    it('un segundo `conectar()` invalida el testigo del primero: UN solo socket', async () => {
      const primero = diferida<string | null>()
      const segundo = diferida<string | null>()
      let n = 0
      const { t, creados } = montar(() => (++n === 1 ? primero.promesa : segundo.promesa))

      t.conectar()
      t.cerrar()
      t.conectar()
      segundo.resolver('el.bueno')
      primero.resolver('el.viejo')      // llega DESPUES, y ya no vale
      await Promise.resolve(); await Promise.resolve()

      expect(creados).toHaveLength(1)
      expect(creados[0].protocolos?.[0]).toBe(`${PREFIJO_TESTIGO}el.bueno`)
    })
  })

  describe('cuando no hay testigo que dar', () => {
    it('si el servidor devuelve null: no abre, avisa, y REINTENTA', async () => {
      // No es «tu credencial no vale»: es que no se ha podido pedir. Un servidor
      // reiniciando es transitorio, y rendirse dejaria la pagina muerta.
      const { t, creados, programar, avisos } = montar(async () => null)
      t.conectar()
      await Promise.resolve(); await Promise.resolve()

      expect(creados).toHaveLength(0)
      expect(programar).toHaveBeenCalledTimes(1)
      expect(avisos.join(' ')).toContain('sesión')
    })

    it('si la peticion FALLA, el error del servidor llega al aviso', async () => {
      const { t, programar, avisos } = montar(async () => { throw new Error('502 del proxy') })
      t.conectar()
      await Promise.resolve(); await Promise.resolve()

      expect(avisos.join(' ')).toContain('502 del proxy')
      expect(programar).toHaveBeenCalledTimes(1)
    })

    it('🔴 y con reconectar:false NO programa nada, ni siquiera aqui', async () => {
      const { t, programar } = montar(async () => null, { reconectar: false })
      t.conectar()
      await Promise.resolve(); await Promise.resolve()
      expect(programar).not.toHaveBeenCalled()
    })
  })
})
