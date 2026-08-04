import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entradaSalud, mismaSalud, montarVigilanciaSalud } from './useSalud'
import { montarTransporte } from './useTransporte'
import { Transporte } from '../lib/rosbridge/transporte'
import { Salud, UMBRAL_SILENCIO_MS, evaluarSalud } from '../lib/rosbridge/salud'
import { WSFalso, fabricaFalsa } from '../pruebas/dobles'

const nada = { alCerrarse: () => {}, alAviso: () => {} }

/** Un transporte conectado, con la vigilancia de salud ya montada. */
function robotVivo() {
  const t = new Transporte('ws://x:9090', fabricaFalsa)
  const limpiarTransporte = montarTransporte(t, nada)
  WSFalso.ultimo.abrir()
  const limpiarVigilancia = montarVigilanciaSalud(t)
  return {
    t,
    socket: WSFalso.ultimo,
    limpiar: () => { limpiarVigilancia(); limpiarTransporte() },
  }
}

beforeEach(() => {
  WSFalso.reiniciar()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('montarVigilanciaSalud — de que se suscribe y de que NO', () => {
  it('se suscribe a /odom, que es lo que alimenta msDesdeUltimo()', () => {
    const { socket, limpiar } = robotVivo()
    expect(socket.ops().some((o) => o.op === 'subscribe' && o.topic === '/odom')).toBe(true)
    limpiar()
  })

  it('🔴 NO se suscribe a /scan, aunque evaluarSalud() lo mire', () => {
    // /scan es el 83 % del trafico de un robot. `entradaSalud` aprovecha lo que
    // el Transporte ya sepa de el, y no paga una suscripcion permanente para
    // afinar un diagnostico.
    const { socket, limpiar } = robotVivo()
    expect(socket.ops().some((o) => o.op === 'subscribe' && o.topic === '/scan')).toBe(false)
    limpiar()
  })

  it('la limpieza da de baja: manda unsubscribe de /odom', () => {
    const { socket, limpiar } = robotVivo()
    limpiar()
    expect(socket.ops().some((o) => o.op === 'unsubscribe' && o.topic === '/odom')).toBe(true)
  })
})

describe('entradaSalud — se decide por LLEGADAS, no por Hz', () => {
  it('sin conexion, y sin ningun mensaje, la antiguedad es null (no cero)', () => {
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    const e = entradaSalud(t, false)
    expect(e.conectado).toBe(false)
    expect(e.msDesdeUltimoOdom).toBeNull()   // null = «no llego ninguno», no «hace 0 ms»
    expect(evaluarSalud(e).estado).toBe('SIN_CONEXION')
  })

  it('con un /odom recien llegado, EN_LINEA', () => {
    const { t, socket, limpiar } = robotVivo()
    socket.recibir({ op: 'publish', topic: '/odom', msg: {} })
    const e = entradaSalud(t, false)
    expect(e.msDesdeUltimoOdom).toBeGreaterThanOrEqual(0)
    expect(evaluarSalud(e).estado).toBe('EN_LINEA')
    limpiar()
  })

  it('🔴 diez mensajes seguidos y luego silencio: lo que decide es el ULTIMO, no la frecuencia', () => {
    // Una comprobacion «> 10 Hz» de este proyecto PASABA midiendo 11,3 Hz sobre
    // un robot que iba a 16,5. Diez mensajes en el mismo instante dan una
    // frecuencia altisima y no dicen NADA sobre si el robot sigue vivo.
    vi.useFakeTimers()
    const { t, socket, limpiar } = robotVivo()
    for (let i = 0; i < 10; i++) socket.recibir({ op: 'publish', topic: '/odom', msg: { i } })

    expect(evaluarSalud(entradaSalud(t, false)).estado).toBe('EN_LINEA')
    vi.advanceTimersByTime(UMBRAL_SILENCIO_MS + 1000)
    expect(evaluarSalud(entradaSalud(t, false)).estado).toBe('SIN_DATOS')
    limpiar()
  })

  it('la frontera del silencio es la de salud.ts, no otra', () => {
    vi.useFakeTimers()
    const { t, socket, limpiar } = robotVivo()
    socket.recibir({ op: 'publish', topic: '/odom', msg: {} })

    vi.advanceTimersByTime(UMBRAL_SILENCIO_MS)
    expect(evaluarSalud(entradaSalud(t, false)).estado).toBe('EN_LINEA')
    vi.advanceTimersByTime(1)
    expect(evaluarSalud(entradaSalud(t, false)).estado).toBe('SIN_DATOS')
    limpiar()
  })

  it('🔴 SIN_DATOS nunca es averia, y trae las tres causas sin elegir entre ellas', () => {
    vi.useFakeTimers()
    const { t, socket, limpiar } = robotVivo()
    socket.recibir({ op: 'publish', topic: '/odom', msg: {} })
    vi.advanceTimersByTime(10000)

    const s = evaluarSalud(entradaSalud(t, false))
    expect(s.esAveria).toBe(false)
    expect(s.causasPosibles).toHaveLength(3)
    expect(s.causasPosibles.some((c) => c.includes('cargando'))).toBe(true)
    limpiar()
  })

  it('`frenando` se pasa tal cual: este hook no se lo inventa', () => {
    const { t, limpiar } = robotVivo()
    expect(entradaSalud(t, true).frenando).toBe(true)
    expect(entradaSalud(t, false).frenando).toBe(false)
    limpiar()
  })
})

describe('mismaSalud — para no re-renderizar 16 baldosas sin motivo', () => {
  const base: Salud = { estado: 'EN_LINEA', frenando: false, causasPosibles: [], esAveria: false }

  it('dos evaluaciones identicas son la misma cosa aunque sean objetos distintos', () => {
    expect(mismaSalud(base, { ...base, causasPosibles: [] })).toBe(true)
  })

  it('un cambio de estado NO se traga', () => {
    expect(mismaSalud(base, { ...base, estado: 'SIN_DATOS' })).toBe(false)
  })

  it('un cambio de frenando NO se traga', () => {
    expect(mismaSalud(base, { ...base, frenando: true })).toBe(false)
  })

  it('un cambio en las causas -mismo numero, distinto texto- NO se traga', () => {
    const a: Salud = { ...base, estado: 'SIN_DATOS', causasPosibles: ['el RVR se durmio'] }
    const b: Salud = { ...base, estado: 'SIN_DATOS', causasPosibles: ['una excepcion en un manejador'] }
    expect(mismaSalud(a, b)).toBe(false)
  })

  it('un cambio en el NUMERO de causas tampoco', () => {
    const a: Salud = { ...base, causasPosibles: ['x'] }
    const b: Salud = { ...base, causasPosibles: ['x', 'y'] }
    expect(mismaSalud(a, b)).toBe(false)
  })
})
