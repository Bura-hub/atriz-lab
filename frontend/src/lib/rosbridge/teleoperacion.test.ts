import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERIODO_MS, PLAZO_ARRANQUE_SCAN_MS, RITMO_HZ, Teleoperacion, twist } from './teleoperacion'
import { Transporte } from './transporte'

/**
 * WebSocket de mentira, propio de este fichero (no se toca el de
 * transporte.test.ts). Aviso 2 de la Tarea 6: el doble de esa tarea arranca
 * con `readyState = 1` desde el constructor, y un WebSocket real empieza en
 * CONNECTING (0). Aqui se ajusta EL DOBLE, no la implementacion: arranca en
 * CONNECTING y solo pasa a OPEN (1) cuando se llama a `abrir()`. Ademas
 * expone `cerrando()`, que mueve `readyState` a CLOSING (2) SIN disparar
 * `onclose` todavia — es la simulacion del hueco que describe el punto (a)
 * del encargo: el enlace ya no sirve (`conectado` da false) pero
 * `alCerrarse` aun no ha avisado a nadie.
 */
class WSFalso {
  static ultimo: WSFalso
  enviados: string[] = []
  onopen?: () => void
  onmessage?: (e: { data: string }) => void
  onclose?: () => void
  readyState = 0
  constructor(public url: string) { WSFalso.ultimo = this }
  send(d: string) { this.enviados.push(d) }
  // 🔴 C3: ASINCRONO, como el `close()` de un WebSocket real -si no, la
  //    prueba no puede distinguir el arreglo de C3 (el onclose de un socket
  //    VIEJO anulando el NUEVO tras cerrar()+conectar()).
  close() {
    this.readyState = 2
    queueMicrotask(() => { this.readyState = 3; this.onclose?.() })
  }
  abrir() { this.readyState = 1; this.onopen?.() }
  cerrando() { this.readyState = 2 }
  recibir(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }) }
}

const fabrica = (u: string) => new WSFalso(u) as unknown as WebSocket

/** Sube un Transporte conectado y abierto, listo para publicar. */
function transporteConectado(): { t: Transporte; ws: WSFalso } {
  const t = new Transporte('ws://x:9090', fabrica)
  t.conectar()
  const ws = WSFalso.ultimo
  ws.abrir()
  return { t, ws }
}

const publicaciones = (ws: WSFalso, topic: string) =>
  ws.enviados.map((s) => JSON.parse(s)).filter((o) => o.op === 'publish' && o.topic === topic)

describe('twist(v, w)', () => {
  it('rellena los seis campos de geometry_msgs/Twist', () => {
    expect(twist(0.2, -0.5)).toEqual({
      linear: { x: 0.2, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: -0.5 },
    })
  })
})

describe('Teleoperacion.arrancarBarrido()', () => {
  // Prueba central del punto 2: NO se da por terminado con solo la
  // respuesta de /start_scan, hace falta un /scan real.
  it('no se resuelve hasta que llega un /scan real, aunque /start_scan ya haya respondido', async () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    let resuelto = false
    const p = tel.arrancarBarrido().then(() => { resuelto = true })

    // Responde /start_scan (buscamos la llamada real por su id, como hace rosbridge)
    const llamada = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    expect(llamada?.service).toBe('/start_scan')
    ws.recibir({ op: 'service_response', id: llamada.id, values: {} })

    // /start_scan ya respondio: microtask flush y comprobar que SIGUE pendiente.
    await Promise.resolve()
    await Promise.resolve()
    expect(resuelto).toBe(false)

    // Ahora llega el /scan real.
    ws.recibir({ op: 'publish', topic: '/scan', msg: { ranges: [1, 2, 3] } })
    await p
    expect(resuelto).toBe(true)
  })

  it('se suscribe a /scan y se da de baja al resolver (no deja el topic pidiendose para siempre)', async () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    const p = tel.arrancarBarrido()
    const llamada = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    ws.recibir({ op: 'service_response', id: llamada.id, values: {} })

    expect(
      ws.enviados.map((s) => JSON.parse(s)).some((o) => o.op === 'subscribe' && o.topic === '/scan'),
    ).toBe(true)

    ws.recibir({ op: 'publish', topic: '/scan', msg: {} })
    await p

    const ops = ws.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'unsubscribe' && o.topic === '/scan')).toBe(true)
  })

  it('si /start_scan falla (p.ej. sin conexion), arrancarBarrido() rechaza', async () => {
    const t = new Transporte('ws://x:9090', fabrica)   // sin conectar
    const tel = new Teleoperacion(t)
    await expect(tel.arrancarBarrido()).rejects.toThrow(/start_scan/)
  })

  // Arreglo transversal, y es la prueba que mas importa de las cuatro del
  // encargo: de extremo a extremo. Antes de este arreglo, un
  // service_response con result:false se RESOLVIA igual que un exito, asi
  // que este catch() nunca se disparaba: el alumno esperaba los 8 s enteros
  // del plazo y leia la CONJETURA generica ("puede que el LIDAR no haya
  // arrancado") en vez del motivo real que el robot ya habia mandado. Esta
  // prueba fija que /start_scan que falla de VERDAD (result:false) rechaza
  // YA -sin avanzar ningun temporizador ni esperar el plazo- con el motivo
  // real, y que ese motivo NO es la conjetura generica.
  it('si /start_scan responde result:false, RECHAZA con el motivo real, sin esperar el plazo y sin la conjetura del LIDAR', async () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    const p = tel.arrancarBarrido()   // plazo por defecto: 8 s. No debe hacer falta.
    const llamada = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    ws.recibir({
      op: 'service_response', id: llamada.id, result: false,
      values: 'el servicio start_scan lanzo una excepcion: puerto serie /dev/ydlidar no disponible',
    })

    // Rechaza YA (sin vi.advanceTimersByTime ni fake timers en este describe)
    // con el motivo real del robot.
    await expect(p).rejects.toThrow(/puerto serie \/dev\/ydlidar no disponible/)
    // Y NO con la conjetura generica que antes sustituia al motivo real.
    await expect(p).rejects.not.toThrow(/no tiene por que estar averiado|puede que el LIDAR/i)
  })
})

describe('Teleoperacion.arrancarBarrido() — plazo cuando /scan nunca llega', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('usa PLAZO_ARRANQUE_SCAN_MS por defecto (8 s, como atriz.py)', () => {
    expect(PLAZO_ARRANQUE_SCAN_MS).toBe(8000)
  })

  // Ronda de arreglo 1: la revision midio una fuga real. Si /start_scan
  // responde bien pero el /scan real nunca llega, y quien llamo deja de
  // esperar la promesa (lo que hara la interfaz en produccion), la
  // suscripcion a /scan -83 % del trafico de un robot- quedaba registrada
  // para siempre, sin unsubscribe y sin ningun metodo publico para
  // cancelarla. Las DOS mitades se comprueban por separado, siguiendo el
  // patron ya usado en protocolo.test.ts para plazos con temporizadores
  // falsos: las aserciones de rechazo se preparan ANTES de avanzar el
  // reloj, enganchadas a la misma promesa.
  it('al vencer el plazo, RECHAZA con un mensaje util Y se da de baja de /scan', async () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    const p = tel.arrancarBarrido(50)   // plazo corto y parametrizable, para la prueba
    const esperaMenciona_startScan = expect(p).rejects.toThrow(/start_scan/)
    const esperaMenciona_collisionMonitor = expect(p).rejects.toThrow(/collision_monitor/i)

    // /start_scan responde BIEN. El /scan real nunca llega.
    const llamada = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    ws.recibir({ op: 'service_response', id: llamada.id, values: {} })

    vi.advanceTimersByTime(50)
    await esperaMenciona_startScan
    await esperaMenciona_collisionMonitor

    // Mitad 2, la que se olvida sola: unsubscribe de /scan por el socket.
    const ops = ws.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'unsubscribe' && o.topic === '/scan')).toBe(true)
  })

  it('el mensaje deja claro que el robot no tiene por que estar averiado', async () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    const p = tel.arrancarBarrido(50)
    const espera = expect(p).rejects.toThrow(/no tiene por que estar averiado|LIDAR/i)
    const llamada = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    ws.recibir({ op: 'service_response', id: llamada.id, values: {} })
    vi.advanceTimersByTime(50)
    await espera
  })

  it('si el /scan real llega ANTES del plazo, resuelve y no queda un temporizador pendiente', async () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    const p = tel.arrancarBarrido(50)
    const llamada = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    ws.recibir({ op: 'service_response', id: llamada.id, values: {} })
    ws.recibir({ op: 'publish', topic: '/scan', msg: {} })
    await p   // resuelve sin necesidad de avanzar el reloj

    // Avanzar mucho mas alla del plazo no debe lanzar ni volver a tocar nada.
    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
  })
})

describe('Teleoperacion — bucle de mando a 10 Hz', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('RITMO_HZ y PERIODO_MS son 10 y 100', () => {
    expect(RITMO_HZ).toBe(10)
    expect(PERIODO_MS).toBe(100)
  })

  it('republica el mismo Twist a ~10 Hz mientras dure la orden', () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    tel.mover(0.2, -0.1)
    vi.advanceTimersByTime(500)   // 5 periodos completos tras el mando inicial

    const pubs = publicaciones(ws, '/cmd_vel_raw')
    // mando inicial (en el acto) + 5 ciclos de 100 ms = 6
    expect(pubs.length).toBe(6)
    for (const p of pubs) {
      expect(p.msg).toEqual(twist(0.2, -0.1))
    }

    tel.detener()
  })

  it('mover() de nuevo con otro valor no reinicia el temporizador ni publica dos veces por tick', () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    tel.mover(0.1, 0)              // arranca: 1 publish inmediato
    vi.advanceTimersByTime(50)
    tel.mover(0.3, 0)              // cambia el valor a mitad de periodo: NO debe publicar de mas
    vi.advanceTimersByTime(50)     // completa el primer periodo de 100 ms

    const pubs = publicaciones(ws, '/cmd_vel_raw')
    expect(pubs.length).toBe(2)   // el mando inicial + el primer tick del temporizador
    expect(pubs[1].msg).toEqual(twist(0.3, 0))   // el tick ya recogio el valor nuevo

    tel.detener()
  })
})

describe('Teleoperacion.parar()', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('manda un Twist cero y corta el bucle: nada mas se publica despues', () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    tel.mover(0.4, 0.2)
    vi.advanceTimersByTime(250)
    const antes = publicaciones(ws, '/cmd_vel_raw').length
    expect(antes).toBeGreaterThan(0)

    tel.parar()
    const trasParar = publicaciones(ws, '/cmd_vel_raw')
    expect(trasParar[trasParar.length - 1].msg).toEqual(twist(0, 0))

    vi.advanceTimersByTime(1000)   // mucho mas que un periodo
    expect(publicaciones(ws, '/cmd_vel_raw').length).toBe(trasParar.length)   // nada nuevo
  })

  // Menor de la ronda de arreglo 1: parar() sigue la misma regla que
  // paradaEmergencia() (propagar, no capturar) por lectura del codigo, pero
  // el punto 9 del encargo solo cubria paradaEmergencia(). Prueba simetrica.
  it('sin conexion PROPAGA la excepcion al llamante (misma regla que paradaEmergencia())', () => {
    const t = new Transporte('ws://x:9090', fabrica)   // nunca conectado
    const tel = new Teleoperacion(t)
    expect(() => tel.parar()).toThrowError(/cmd_vel_raw/)
  })
})

describe('Teleoperacion.paradaEmergencia()', () => {
  it('publica en /emergency_stop y corta el bucle', () => {
    vi.useFakeTimers()
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    tel.mover(0.3, 0)
    tel.paradaEmergencia()

    const pubs = publicaciones(ws, '/emergency_stop')
    expect(pubs).toHaveLength(1)

    const antes = publicaciones(ws, '/cmd_vel_raw').length
    vi.advanceTimersByTime(1000)
    expect(publicaciones(ws, '/cmd_vel_raw').length).toBe(antes)   // el bucle no siguio
    vi.useRealTimers()
  })

  // Punto 9 del encargo, y es la propiedad CONTRARIA a la del tick a proposito.
  it('sin conexion PROPAGA la excepcion al llamante (no la captura)', () => {
    const t = new Transporte('ws://x:9090', fabrica)   // nunca conectado
    const tel = new Teleoperacion(t)
    expect(() => tel.paradaEmergencia()).toThrowError(/emergency_stop/)
  })

  it('no existe ningun metodo para liberar la parada', () => {
    const metodos = Object.getOwnPropertyNames(Teleoperacion.prototype)
      .filter((m) => m !== 'constructor')
      .sort()
    // I2 añadio `alAviso` (mismo patron que Transporte.alAviso()) a la
    // superficie publica exacta: se actualiza la lista, no se relaja la prueba.
    expect(metodos).toEqual(
      ['alAviso', 'arrancarBarrido', 'desmontar', 'detener', 'mover', 'parar', 'paradaEmergencia'].sort(),
    )
    expect(metodos.some((m) => /liberar/i.test(m))).toBe(false)
  })
})

describe('Teleoperacion — el bucle se corta solo si se cae el enlace', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('al llamar onclose (se cae el WebSocket), el bucle se detiene sin que nadie llame a detener()', () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)

    tel.mover(0.2, 0)
    vi.advanceTimersByTime(300)
    const antes = publicaciones(ws, '/cmd_vel_raw').length
    expect(antes).toBeGreaterThan(1)

    ws.onclose?.()   // se cae el enlace de verdad (dispara alCerrarse)
    vi.advanceTimersByTime(1000)   // mucho mas que un periodo
    expect(publicaciones(ws, '/cmd_vel_raw').length).toBe(antes)   // nada nuevo: el bucle ya no corre
  })

  // Aviso 1 de la Tarea 6: el oyente de alCerrarse de Teleoperacion NO debe
  // reconectar. Esta prueba fija esa propiedad: un oyente ajeno que SI
  // reconecta de forma sincrona no debe dejar el bucle de Teleoperacion
  // corriendo sobre un socket viejo. Comprobamos el efecto que a
  // Teleoperacion le importa: tras la caida, no publica mas sobre el
  // socket original.
  it('el oyente de Teleoperacion no reconecta por si mismo', () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)
    tel.mover(0.1, 0)

    let reconecto = false
    t.alCerrarse(() => { reconecto = true })   // testigo: si ALGUIEN reconectara aqui, lo veriamos
    ws.onclose?.()

    expect(reconecto).toBe(true)      // el testigo si se entero de la caida
    expect(WSFalso.ultimo).toBe(ws)   // pero Teleoperacion no genero un socket nuevo
  })
})

describe('Teleoperacion — el tick captura el fallo de publicar()', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // Punto 8 del encargo. Simula el hueco descrito en el brief: el socket ya
  // esta CLOSING (conectado === false, publicar() lanza) pero onclose/
  // alCerrarse TODAVIA no ha disparado, asi que el temporizador de
  // Teleoperacion sigue vivo y el siguiente tick intenta publicar.
  it('si el tick lanza porque no hay conexion, el bucle se detiene, queda constancia, y NO se propaga', () => {
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    // I2: console.error es mudo para quien teleopera. alAviso() es la via
    // que SI puede llegar a la interfaz.
    const avisos: { nivel: string; mensaje: string }[] = []
    tel.alAviso((a) => avisos.push(a))

    tel.mover(0.2, 0)
    const antes = publicaciones(ws, '/cmd_vel_raw').length
    expect(antes).toBe(1)

    ws.cerrando()   // readyState -> CLOSING; conectado() ya da false; onclose NO se ha llamado

    // La propiedad central: avanzar el reloj (que ejecuta el tick) NO lanza
    // hacia fuera de la prueba.
    expect(() => vi.advanceTimersByTime(PERIODO_MS)).not.toThrow()

    // Y queda constancia: no se traga en silencio.
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0]).toMatch(/cmd_vel_raw|conexion/i)

    // Y AHORA TAMBIEN por alAviso(), no solo por la consola.
    expect(avisos).toHaveLength(1)
    expect(avisos[0].nivel).toBe('error')
    expect(avisos[0].mensaje).toMatch(/cmd_vel_raw|conexion/i)

    // Y el bucle quedo cortado: nada mas se publica aunque siga avanzando el reloj.
    vi.advanceTimersByTime(1000)
    expect(publicaciones(ws, '/cmd_vel_raw').length).toBe(antes)   // ningun tick nuevo

    error.mockRestore()
  })
})

describe('Teleoperacion.desmontar()', () => {
  it('corta el bucle y suelta el oyente de alCerrarse (no queda enganchado al transporte)', () => {
    vi.useFakeTimers()
    const { t, ws } = transporteConectado()
    const tel = new Teleoperacion(t)
    tel.mover(0.2, 0)

    tel.desmontar()
    const antes = publicaciones(ws, '/cmd_vel_raw').length
    vi.advanceTimersByTime(1000)
    expect(publicaciones(ws, '/cmd_vel_raw').length).toBe(antes)   // el bucle no sigue

    // Y el oyente ya no esta: una caida posterior no deberia hacer nada raro
    // (no hay forma de observar una excepcion aqui, pero al menos no lanza).
    expect(() => ws.onclose?.()).not.toThrow()
    vi.useRealTimers()
  })
})

// C3 desde el lado de Teleoperacion: es la consecuencia concreta que el
// encargo pide comprobar. `Teleoperacion` corta su bucle cuando `Transporte`
// avisa por `alCerrarse()`. Antes del arreglo de C3, el `onclose` asincrono
// de un socket VIEJO (tras un patron "Reconectar" = cerrar()+conectar())
// disparaba `oyentesCierre` igualmente, aunque el socket NUEVO siguiera vivo
// y sano -asi que `alCerrarse` cortaba el bucle de mando sobre un enlace que
// funcionaba. "Telemetria viva mas parada muerta" con los papeles invertidos.
describe('Teleoperacion — C3: no se corta por un onclose diferido del socket VIEJO tras cerrar()+conectar()', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('el bucle sigue publicando sobre el socket NUEVO aunque el onclose asincrono del viejo llegue despues', async () => {
    const { t } = transporteConectado()
    const tel = new Teleoperacion(t)
    tel.mover(0.2, 0)   // arranca el temporizador de 10 Hz (publica una vez, en el socket VIEJO)

    // Patron "Reconectar": cerrar() + conectar() en el acto.
    t.cerrar()
    t.conectar()
    const nuevo = WSFalso.ultimo
    nuevo.abrir()

    // Aqui, mas tarde, llega el onclose asincrono del socket VIEJO. Sin el
    // arreglo de C3, esto dispara `oyentesCierre` -> `Teleoperacion.detener()`
    // -> `clearInterval()`, y el temporizador de 10 Hz muere para siempre.
    await Promise.resolve()
    await Promise.resolve()

    // La propiedad central: el temporizador SIGUE vivo. mover() no reinicia
    // el timer si ya existe, asi que la unica forma de ver mas publicaciones
    // es que el setInterval original (creado ANTES de cerrar()+conectar())
    // siga corriendo y publique sobre el socket vigente (nuevo).
    vi.advanceTimersByTime(300)
    const pubs = publicaciones(nuevo, '/cmd_vel_raw')
    expect(pubs.length).toBeGreaterThan(0)
  })
})
