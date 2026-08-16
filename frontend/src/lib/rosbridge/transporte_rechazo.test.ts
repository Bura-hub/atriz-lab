/**
 * EL TRANSPORTE ANTE UN CIERRE **CON CODIGO** — Fase B (A7).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTE FICHERO TIENE SU PROPIO DOBLE
 * ═══════════════════════════════════════════════════════════════════════════
 * Los dobles de `transporte.test.ts` y `teleoperacion.test.ts` declaran
 * `onclose?: () => void` y lo llaman **sin argumentos**, porque hasta la Fase B
 * a nadie le importaba el codigo de cierre. El WebSocket real SIEMPRE pasa un
 * `CloseEvent`.
 *
 * Si el camino nuevo solo se ejercitara con esos dobles, `evento` seria siempre
 * `undefined`, se caeria siempre en «reintentar y en silencio», y **la rama que
 * corta el bucle no la recorreria nadie** — estaria escrita y sin cubrir, que es
 * peor que no tenerla porque parece cubierta.
 *
 * Asi que aqui el doble dispara cierres CON codigo y motivo, como el de verdad.
 */

import { describe, expect, it, vi } from 'vitest'
import { Transporte } from './transporte'

class WSConCodigo {
  static OPEN = 1
  readyState = 0
  onopen: (() => void) | null = null
  onclose: ((e?: { code?: number; reason?: string }) => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  enviados: string[] = []

  constructor(public url: string, public protocolos?: string[]) {}

  send(d: string) { this.enviados.push(d) }
  close() { /* lo dispara la prueba a mano, con su codigo */ }

  abrir() { this.readyState = 1; this.onopen?.() }
  /** Lo que hace el robot al rechazar: cierra CON codigo y motivo. */
  cerrarCon(code: number, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }) }
}

function montar(opciones: Record<string, unknown> = {}) {
  let ultimo: WSConCodigo | null = null
  const programar = vi.fn(() => 0 as unknown as ReturnType<typeof setTimeout>)  // sin parametros: TS acepta una funcion de menos aridad, y eslint no se queja
  const t = new Transporte(
    'ws://robot:9090',
    (u, p) => { ultimo = new WSConCodigo(u, p); return ultimo as unknown as WebSocket },
    { reconectar: true, programar, plazoConexion: 0, ...opciones },
  )
  const avisos: string[] = []
  t.alAviso((a) => avisos.push(a.mensaje))
  t.conectar()
  return { t, programar, avisos, ws: () => ultimo! }
}

describe('el transporte ante un cierre CON codigo', () => {
  describe('🔴 rechazo de credencial: NO se reintenta, y se DICE por que', () => {
    it.each([
      [4401, 'sin credencial'],
      [4403, 'firma que el robot no acepta'],
      [4404, 'credencial de otro robot'],
    ])('%i (%s) no programa reconexion', (codigo) => {
      const { programar, ws } = montar()
      ws().abrir()
      ws().cerrarCon(codigo, 'lo que diga el robot')
      expect(programar).not.toHaveBeenCalled()
    })

    it('y el motivo del robot llega hasta el aviso, con su detalle exacto', () => {
      const { avisos, ws } = montar()
      ws().abrir()
      ws().cerrarCon(4404, 'este testigo es para el robot 2, y este es el 1')
      expect(avisos.join(' ')).toContain('robot 2')
    })
  })

  describe('✅ EL CONTROL: lo que SI se reintenta', () => {
    it('un corte de red (1006) programa reconexion, como siempre', () => {
      // Sin este control, «no reintenta» pasaria igual con un transporte que
      // hubiera dejado de reintentar del todo.
      const { programar, ws } = montar()
      ws().abrir()
      ws().cerrarCon(1006, '')
      expect(programar).toHaveBeenCalledTimes(1)
    })

    it('🔴 el 1013 (la Pi sin hora) SI reintenta, aunque venga del testigo', () => {
      // Se arregla solo en ~18 s. Tratarlo como rechazo dejaria los 16 robots
      // recien encendidos inalcanzables hasta que alguien recargue la pagina.
      const { programar, avisos, ws } = montar()
      ws().abrir()
      ws().cerrarCon(1013, '')
      expect(programar).toHaveBeenCalledTimes(1)
      // Y se explica igualmente, para que la espera no parezca un cuelgue.
      expect(avisos.length).toBeGreaterThan(0)
    })

    it('un cierre SIN evento (los dobles viejos) se comporta como antes', () => {
      const { programar, avisos, ws } = montar()
      ws().abrir()
      ws().onclose?.()
      expect(programar).toHaveBeenCalledTimes(1)
      expect(avisos).toEqual([])
    })
  })

  it('🔴 y con reconectar:false un 1006 tampoco programa nada', () => {
    // Control de que la condicion nueva se AÑADE a la vieja, no la sustituye.
    const { programar, ws } = montar({ reconectar: false })
    ws().abrir()
    ws().cerrarCon(1006, '')
    expect(programar).not.toHaveBeenCalled()
  })
})
