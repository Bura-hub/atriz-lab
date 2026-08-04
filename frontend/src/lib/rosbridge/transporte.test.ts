import { describe, expect, it, vi } from 'vitest'
import { esperaReconexion, urlDeRobot, Transporte } from './transporte'

describe('espera de reconexion', () => {
  // El driver tiene el ANTIPATRON medido: 123 reintentos, uno cada 4 s, sin
  // espera creciente. No se repite aqui.
  it('duplica desde 1 s y topa en 30 s', () => {
    const sinRuido = () => 0.5   // 0.8 + 0.4*0.5 = 1.0 exacto
    expect(esperaReconexion(0, sinRuido)).toBe(1000)
    expect(esperaReconexion(1, sinRuido)).toBe(2000)
    expect(esperaReconexion(5, sinRuido)).toBe(30000)
    expect(esperaReconexion(50, sinRuido)).toBe(30000)
  })

  // Para que 16 navegadores no reintenten a la vez.
  it('mete ruido de +-20 %', () => {
    expect(esperaReconexion(0, () => 0)).toBe(800)
    expect(esperaReconexion(0, () => 1)).toBe(1200)
  })
})

describe('direccion del robot', () => {
  it('convierte un numero de robot en su nombre mDNS', () => {
    expect(urlDeRobot(1)).toBe('ws://rvr-01.local:9090')
    expect(urlDeRobot(16)).toBe('ws://rvr-16.local:9090')
  })

  it('acepta una IP u host como override', () => {
    expect(urlDeRobot('192.168.1.58')).toBe('ws://192.168.1.58:9090')
  })
})

/** WebSocket de mentira, para probar sin navegador ni robot. */
class WSFalso {
  static ultimo: WSFalso
  enviados: string[] = []
  onopen?: () => void
  onmessage?: (e: { data: string }) => void
  onclose?: () => void
  readyState = 1
  constructor(public url: string) { WSFalso.ultimo = this }
  send(d: string) { this.enviados.push(d) }
  close() { this.onclose?.() }
  abrir() { this.onopen?.() }
  recibir(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

describe('Transporte', () => {
  it('al suscribirse manda la op y entrega los mensajes', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const recibidos: unknown[] = []
    t.suscribir('/odom', (m) => recibidos.push(m))

    expect(JSON.parse(WSFalso.ultimo.enviados[0])).toMatchObject({ op: 'subscribe', topic: '/odom' })

    WSFalso.ultimo.recibir({ op: 'publish', topic: '/odom', msg: { twist: 1 } })
    expect(recibidos).toEqual([{ twist: 1 }])
  })

  it('anota cuando llego el ultimo mensaje de cada topic', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    t.suscribir('/odom', () => {})

    expect(t.msDesdeUltimo('/odom')).toBeNull()   // todavia no llego ninguno
    WSFalso.ultimo.recibir({ op: 'publish', topic: '/odom', msg: {} })
    expect(t.msDesdeUltimo('/odom')).toBeGreaterThanOrEqual(0)
  })

  it('al reconectar vuelve a suscribirse a todo', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    t.suscribir('/odom', () => {})
    t.suscribir('/scan', () => {})

    const anterior = WSFalso.ultimo
    anterior.onclose?.()
    t.conectar()
    WSFalso.ultimo.abrir()

    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.filter((o) => o.op === 'subscribe').map((o) => o.topic).sort()).toEqual(['/odom', '/scan'])
  })

  // Sin esto, esperaReconexion seria codigo muerto: el transporte solo se
  // reconectaria si alguien llamara a conectar() a mano.
  it('se reconecta solo, esperando lo que dice esperaReconexion', () => {
    vi.useFakeTimers()
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket, {
      reconectar: true, aleatorio: () => 0.5,
    })
    t.conectar()
    WSFalso.ultimo.abrir()
    const primero = WSFalso.ultimo

    primero.onclose?.()
    expect(WSFalso.ultimo).toBe(primero)          // todavia no
    vi.advanceTimersByTime(1000)                  // esperaReconexion(0) = 1000
    expect(WSFalso.ultimo).not.toBe(primero)      // ya hay socket nuevo
    vi.useRealTimers()
  })

  it('avisa a quien escuche cuando se cae el enlace', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    let caidas = 0
    t.alCerrarse(() => caidas++)
    t.conectar()
    WSFalso.ultimo.abrir()
    WSFalso.ultimo.onclose?.()
    expect(caidas).toBe(1)
  })
})
