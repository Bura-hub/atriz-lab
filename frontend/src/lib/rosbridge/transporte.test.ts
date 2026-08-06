import { describe, expect, it, vi } from 'vitest'
import {
  esperaReconexion, urlDeRobot, Transporte, MARGEN_PLAZO_LOCAL_MS, PLAZO_CONEXION_MS,
} from './transporte'
import { RegistroPendientes } from './protocolo'

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
  // 🔴 C3: arranca en CONNECTING (0), como un WebSocket real -antes arrancaba
  //    directamente en OPEN (1), una deriva de este doble respecto al real.
  readyState = 0
  constructor(public url: string) { WSFalso.ultimo = this }
  send(d: string) { this.enviados.push(d) }
  // 🔴 C3: ASINCRONO, como el `close()` de un WebSocket real. Antes disparaba
  //    `onclose` en el MISMO tick, y con eso ninguna prueba podia distinguir
  //    el arreglo de C3 (el onclose de un socket VIEJO anulando el NUEVO):
  //    `cerrar(); conectar()` nunca dejaba una ventana en la que el viejo
  //    pudiera pisar al nuevo, porque el viejo ya habia terminado de cerrarse
  //    antes de que `conectar()` volviera a ejecutarse.
  close() {
    this.readyState = 2   // CLOSING
    queueMicrotask(() => {
      this.readyState = 3   // CLOSED
      this.onclose?.()
    })
  }
  abrir() { this.readyState = 1; this.onopen?.() }
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

// Ronda de arreglo 1: cuatro criticos medidos contra el codigo que el brief
// original mandaba transcribir verbatim, y dos importantes que salieron con
// ellos. Cada prueba se rompio contra su arreglo y se comprobo que fallaba
// (ver task-6-report.md, seccion de la ronda de arreglo).
describe('Transporte — arreglos criticos', () => {
  // Critico 1: `onclose` no podia distinguir «lo pidio el usuario» de «se
  // cayo el enlace», asi que cerrar() con reconectar:true levantaba OTRO
  // socket un rato despues. Avanzamos mucho mas alla del tope de 30 s: si
  // hay CUALQUIER reconexion pendiente, este avance la dispara.
  it('cerrar() con reconectar:true no levanta otro socket', () => {
    vi.useFakeTimers()
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket, {
      reconectar: true, aleatorio: () => 0.5,
    })
    t.conectar()
    WSFalso.ultimo.abrir()
    const unico = WSFalso.ultimo

    t.cerrar()
    vi.advanceTimersByTime(60000)   // muy por encima del tope de 30 s
    expect(WSFalso.ultimo).toBe(unico)   // sigue siendo el mismo: no hay socket nuevo
    vi.useRealTimers()
  })

  // Critico 2: sin guarda de reentrada, una segunda llamada a conectar()
  // creaba un socket nuevo sin cerrar ni desenganchar el viejo. La igualdad
  // de referencia ya delata el segundo socket; el publish confirma que,
  // con un solo socket, un mensaje solo se entrega una vez.
  it('conectar() dos veces seguidas deja un solo socket, y un publish se entrega una vez', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    const primero = WSFalso.ultimo
    t.conectar()
    expect(WSFalso.ultimo).toBe(primero)   // no se creo un segundo socket

    primero.abrir()
    const recibidos: unknown[] = []
    t.suscribir('/odom', (m) => recibidos.push(m))
    primero.recibir({ op: 'publish', topic: '/odom', msg: { n: 1 } })
    expect(recibidos).toHaveLength(1)
  })

  // Critico 3: cancelar la suscripcion solo borraba el callback local.
  // opUnsubscribe existia y no se llamaba nunca: /scan (83 % del trafico)
  // seguia llegando para siempre, y la reconexion volvia a pedirlo.
  it('cancelar el ultimo oyente de un topic manda unsubscribe, y no se resuscribe al reconectar', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    const cancelar = t.suscribir('/scan', () => {})

    cancelar()
    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'unsubscribe' && o.topic === '/scan')).toBe(true)

    // Reconectar: NO debe volver a pedir /scan, porque ya nadie lo escucha.
    WSFalso.ultimo.onclose?.()
    t.conectar()
    WSFalso.ultimo.abrir()
    const opsTrasReconectar = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(opsTrasReconectar.some((o) => o.op === 'subscribe' && o.topic === '/scan')).toBe(false)
  })

  it('cancelar uno de dos oyentes no manda unsubscribe, y el otro sigue escuchando', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const recibidosA: unknown[] = []
    const recibidosB: unknown[] = []
    const cancelarA = t.suscribir('/odom', (m) => recibidosA.push(m))
    t.suscribir('/odom', (m) => recibidosB.push(m))

    cancelarA()
    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'unsubscribe')).toBe(false)

    WSFalso.ultimo.recibir({ op: 'publish', topic: '/odom', msg: { n: 1 } })
    expect(recibidosA).toEqual([])
    expect(recibidosB).toEqual([{ n: 1 }])
  })

  // Critico 4: `this.ws?.send()` no-opeaba en silencio sin conexion, y por
  // publicar() pasa /emergency_stop. Una parada perdida sin aviso es el
  // fallo mas caro y mas repetido de este proyecto.
  it('publicar() sin conexion lanza, y el mensaje nombra el topic', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    expect(() => t.publicar('/emergency_stop', {})).toThrowError(/emergency_stop/)
  })

  it('llamar() sin conexion rechaza sin esperar al plazo', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    await expect(t.llamar('/stop_scan')).rejects.toThrow(/stop_scan/)
  })

  // Importante 5, y es la correccion de fondo: que el socket ABRA no prueba
  // que el enlace SIRVA. `intentos` se reinicia al recibir un mensaje, no al
  // abrir, asi que un socket que abre y cierra en bucle sin decir nada NO
  // reinicia la espera creciente — y un mensaje real si la reinicia.
  it('la espera crece en ciclos abrir-cerrar seguidos, y un mensaje recibido la reinicia', () => {
    const esperas: number[] = []
    // No ejecuta la reconexion: solo anota el ms pedido. Disparamos el
    // siguiente ciclo a mano, como ya hacen las pruebas de reconexion de
    // arriba, para poder inspeccionar cada espera por separado.
    const programarFalso = (_fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
      esperas.push(ms)
      return 0 as unknown as ReturnType<typeof setTimeout>
    }
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket, {
      reconectar: true,
      aleatorio: () => 0.5,
      programar: programarFalso,
      // 🔴 El plazo de conexion usa el MISMO `programar`, asi que sin esto sus
      //    5000 ms se cuelan en `esperas` y la mezcla queda
      //    [5000, 1000, 5000, 2000, 5000, 4000]. Esta prueba mide el
      //    crecimiento de la espera de RECONEXION; el plazo es otra cosa y
      //    tiene sus propias pruebas al final del fichero.
      plazoConexion: 0,
    })

    t.conectar(); WSFalso.ultimo.abrir(); WSFalso.ultimo.onclose?.()   // ciclo 1: sin mensaje
    t.conectar(); WSFalso.ultimo.abrir(); WSFalso.ultimo.onclose?.()   // ciclo 2: sin mensaje
    t.conectar(); WSFalso.ultimo.abrir(); WSFalso.ultimo.onclose?.()   // ciclo 3: sin mensaje

    expect(esperas).toHaveLength(3)
    expect(esperas[2]).toBeGreaterThan(esperas[0])   // crecio: 1000 -> 2000 -> 4000

    // Ciclo 4: esta vez SI llega un mensaje antes de cerrarse.
    t.conectar()
    WSFalso.ultimo.abrir()
    WSFalso.ultimo.recibir({ op: 'publish', topic: '/odom', msg: {} })
    WSFalso.ultimo.onclose?.()

    expect(esperas).toHaveLength(4)
    expect(esperas[3]).toBe(esperas[0])   // se reinicio: misma espera que el primer intento
  })

  // 🔴 Importante 6, CORREGIDO en el arreglo transversal: esta prueba
  // inyectaba por WSFalso un `{op:'status', ...}` que rosbridge 2.7.0 NO
  // MANDA NUNCA — verificado en el fuente (`Protocol.log()` escribe en el
  // logger del NODO y ahi acaba; "status" tiene 0 apariciones en
  // `protocol.py` ni en `rosbridge_server`). Era una prueba verde sobre una
  // ficcion. Se borro la rama `status` de `entrante()` (codigo muerto que
  // prometia algo falso) y esta prueba se redujo al unico aviso que SI es
  // real: el JSON ilegible, que es local al cliente.
  it('un JSON invalido no lanza, y llega a alAviso()', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const avisos: { nivel: string; mensaje: string }[] = []
    t.alAviso((a) => avisos.push(a))

    expect(() => WSFalso.ultimo.onmessage?.({ data: '{ esto no es json' })).not.toThrow()
    expect(avisos).toHaveLength(1)
    expect(avisos[0].nivel).toBe('error')
  })
})

// Ronda de arreglo 2: lo que la re-revision encontro al buscar que pudiera
// haber roto el arreglo de la ronda 1. Cada prueba se rompio contra su
// arreglo y se comprobo que fallaba (ver task-6-report.md).
describe('Transporte — ronda de arreglo 2', () => {
  // Importante: `conectar()` no cancelaba ni adoptaba una reconexion YA
  // programada. Si algo llama a conectar() a mano mientras hay un
  // temporizador de reconexion pendiente, ese temporizador queda huerfano
  // —solo se sobrescribia la referencia— y dispara mas tarde, incluso
  // DESPUES de un cerrar(). Medido por el revisor: 3 sockets contra 1 en
  // el control.
  it('conectar() manual durante una reconexion programada no deja un temporizador huerfano que sobreviva a cerrar()', () => {
    vi.useFakeTimers()
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket, {
      reconectar: true, aleatorio: () => 0.5,
    })
    t.conectar()
    WSFalso.ultimo.abrir()
    const primero = WSFalso.ultimo

    primero.onclose?.()          // se cae: queda programada una reconexion (1000 ms)
    t.conectar()                 // alguien llama a mano ANTES de que dispare
    const segundo = WSFalso.ultimo
    expect(segundo).not.toBe(primero)

    segundo.abrir()
    segundo.onclose?.()          // se cae otra vez: se programa OTRA reconexion (2000 ms)

    t.cerrar()
    vi.advanceTimersByTime(60000)   // muy por encima de cualquier espera pendiente
    expect(WSFalso.ultimo).toBe(segundo)   // ningun socket extra: el temporizador
                                            // huerfano de la primera caida no disparo
    vi.useRealTimers()
  })

  // Menor-que-resultaba-real: `onclose` limpiaba `anunciados`, asi que el
  // bucle de reanuncio de `onopen` siempre recorria un conjunto vacio.
  // Funcionaba igual porque publicar() reanuncia perezosamente, pero se
  // perdia el reanuncio ANTICIPADO: con /emergency_stop ya anunciado tras
  // reconectar, pulsar la parada es UN mensaje en vez de un advertise + un
  // publish.
  it('al reconectar se reanuncia lo que ya estaba anunciado, sin volver a llamar a publicar()', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    t.publicar('/emergency_stop', {})   // anuncia y publica en el primer socket

    WSFalso.ultimo.onclose?.()
    t.conectar()
    WSFalso.ultimo.abrir()   // aqui debe salir el advertise, SIN llamar a publicar() de nuevo

    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'advertise' && o.topic === '/emergency_stop')).toBe(true)
  })
})

// Arreglo transversal: revision contra el fuente real de rosbridge en la
// Raspberry Pi, confirmada despues contra el upstream de
// RobotWebTools/rosbridge_suite rama ros2. `call_service.py` tiene
// exactamente dos apariciones de "result" (True y False) y en el fallo
// manda `{op:'service_response', values: str(exc), result: false}`.
// Resolverlo pase-lo-que-pase tiraba el motivo real (ver arreglo-transversal-report.md).
describe('Transporte — result:false de un service_response', () => {
  it('un service_response con result:false RECHAZA la llamada con el motivo real (no un mensaje generico)', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const p = t.llamar('/start_scan')
    const llamada = WSFalso.ultimo.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    WSFalso.ultimo.recibir({
      op: 'service_response', id: llamada.id, result: false,
      values: 'el YDLIDAR no respondio en el puerto serie',
    })

    await expect(p).rejects.toThrow(/YDLIDAR no respondio en el puerto serie/)
  })

  // Camino bueno: el arreglo no debe romper nada que ya funcionaba. Cubre
  // las dos formas en que llega un exito real: sin `result` (como mandaban
  // las pruebas anteriores a este arreglo) y con `result:true` explicito.
  it('un service_response normal (sin result, o con result:true) sigue resolviendo', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const p1 = t.llamar('/start_scan')
    const llamada1 = WSFalso.ultimo.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    WSFalso.ultimo.recibir({ op: 'service_response', id: llamada1.id, values: { ok: true } })   // sin result
    await expect(p1).resolves.toEqual({ ok: true })

    const p2 = t.llamar('/stop_scan')
    const llamadas = WSFalso.ultimo.enviados.map((s) => JSON.parse(s)).filter((o) => o.op === 'call_service')
    const llamada2 = llamadas[llamadas.length - 1]
    WSFalso.ultimo.recibir({ op: 'service_response', id: llamada2.id, values: { ok: true }, result: true })
    await expect(p2).resolves.toEqual({ ok: true })
  })
})

// Revision final de rama: los cuatro criticos que cruzan modulos, y por eso
// sobrevivieron a siete revisiones por tarea. Ninguno tenia consumidor
// todavia: son trampas armadas, no fallos ya observados.
describe('Transporte — I1: llamar() a un servicio no autorizado', () => {
  it('lanza EN EL ACTO sin registrar una promesa pendiente (antes quedaba huerfana 5 s)', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    // Antes, `registrar()` se llamaba ANTES de construir la op: si
    // `opCallService` lanzaba, la promesa ya creada (con su temporizador de
    // 5 s ya vivo) quedaba huerfana -nadie la recibe, porque el throw corta
    // `llamar()` antes de `return p`- y rechazaba SOLA mas tarde con un «sin
    // respuesta» generico que culpaba al robot. La propiedad que importa:
    // `RegistroPendientes.registrar()` no debe siquiera haberse llamado.
    const registrar = vi.spyOn(RegistroPendientes.prototype, 'registrar')
    expect(() => t.llamar('/raw_motors')).toThrowError(/lista blanca/)
    expect(registrar).not.toHaveBeenCalled()
    registrar.mockRestore()

    // Y, por supuesto, no se manda nada al robot.
    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'call_service')).toBe(false)
  })
})

describe('Transporte — C2: suscribir() a un topic no autorizado', () => {
  it('lanza en el acto SIN CONEXION (antes no lanzaba aqui: el fallo aparecia mas tarde, dentro de onopen)', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    // Ni conectado siquiera: antes esto no lanzaba, y la suscripcion mala
    // quedaba en el Map esperando a envenenar el primer onopen.
    expect(() => t.suscribir('/ambient_light', () => {})).toThrowError(/lista blanca/)

    // Y no deja un zombie: conectar despues no debe intentar suscribirse al
    // topic malo, y una suscripcion valida debe funcionar con normalidad.
    t.conectar()
    WSFalso.ultimo.abrir()
    t.suscribir('/odom', () => {})
    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'subscribe' && o.topic === '/ambient_light')).toBe(false)
    expect(ops.some((o) => o.op === 'subscribe' && o.topic === '/odom')).toBe(true)
  })

  it('lanza en el acto ESTANDO CONECTADO, sin dejar una entrada zombie que corte la resuscripcion de los demas al reconectar', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    t.suscribir('/odom', () => {})

    // Antes: lanzaba, pero DESPUES de mutar el Map y ANTES de devolver la
    // funcion de baja -la entrada quedaba dentro sin ninguna forma publica
    // de quitarla.
    expect(() => t.suscribir('/ambient_light', () => {})).toThrowError(/lista blanca/)

    // Si hubiera quedado zombie, el bucle de resuscripcion de onopen se
    // habria cortado a medias al reconectar (sin el arreglo del bucle
    // envuelto) y /odom no se habria vuelto a pedir.
    WSFalso.ultimo.onclose?.()
    t.conectar()
    WSFalso.ultimo.abrir()
    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'subscribe' && o.topic === '/odom')).toBe(true)
  })

  // Defensa en profundidad del bucle de onopen: la via publica ya impide que
  // entre un topic invalido en el Map desde el arreglo de arriba, pero el
  // encargo pide ademas envolver los DOS bucles para que un topic malo (por
  // la razon que sea) no arrastre a los demas. Se pone a prueba tocando el
  // Map privado directamente, simulando el escenario que el arreglo defiende
  // aunque hoy ya no sea alcanzable por la API publica.
  it('un topic invalido en suscripciones no corta el reanuncio de /emergency_stop tras reconectar (defensa del bucle de onopen)', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    t.publicar('/emergency_stop', {})   // queda anunciado

    ;(t as unknown as { suscripciones: Map<string, Set<() => void>> }).suscripciones
      .set('/topic-invalido', new Set([() => {}]))

    WSFalso.ultimo.onclose?.()
    t.conectar()
    WSFalso.ultimo.abrir()

    const ops = WSFalso.ultimo.enviados.map((s) => JSON.parse(s))
    // El bucle de suscripcion lanza en la entrada invalida, pero SIN el
    // arreglo eso corta tambien el bucle de reanuncio de mas abajo -este es
    // el efecto que de verdad importa: /emergency_stop reanunciado.
    expect(ops.some((o) => o.op === 'advertise' && o.topic === '/emergency_stop')).toBe(true)
  })
})

// C3, el critico mas grave de la ronda: el `close()` de un WebSocket real es
// ASINCRONO, y `ws.onclose` no comprobaba que el socket que se cerro fuera el
// vigente. Solo se puede reproducir con un doble que se comporte como el
// real -por eso hubo que arreglar WSFalso primero (arriba).
describe('Transporte — C3: cerrar() seguido de conectar() (el boton "Reconectar")', () => {
  it('el onclose asincrono del socket VIEJO no anula el socket NUEVO: conectado sigue en true y publicar() funciona', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    const viejo = WSFalso.ultimo

    // Patron tipico de un boton "Reconectar": cerrar() y conectar() en el
    // acto. close() es asincrono: el onclose del viejo NO ha disparado
    // todavia en este punto.
    t.cerrar()
    t.conectar()
    const nuevo = WSFalso.ultimo
    expect(nuevo).not.toBe(viejo)
    nuevo.abrir()
    expect(t.conectado).toBe(true)

    // Ahora, mas tarde (microtask), dispara el onclose diferido del VIEJO.
    await Promise.resolve()
    await Promise.resolve()

    // Medido en el brief SIN el arreglo: conectado pasaba a false con el
    // socket nuevo en OPEN, y publicar('/emergency_stop') lanzaba para
    // siempre. Con el arreglo, el onclose del viejo es un no-op.
    expect(t.conectado).toBe(true)
    expect(() => t.publicar('/emergency_stop', {})).not.toThrow()
    const ops = nuevo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'publish' && o.topic === '/emergency_stop')).toBe(true)
  })

  it('la re-suscripcion y el reanuncio ocurren en el socket NUEVO, y el onclose tardio del viejo no los deshace', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    t.suscribir('/odom', () => {})
    t.publicar('/emergency_stop', {})

    t.cerrar()
    t.conectar()
    const nuevo = WSFalso.ultimo
    nuevo.abrir()

    await Promise.resolve()
    await Promise.resolve()   // el onclose diferido del viejo llega aqui

    const ops = nuevo.enviados.map((s) => JSON.parse(s))
    expect(ops.some((o) => o.op === 'subscribe' && o.topic === '/odom')).toBe(true)
    expect(ops.some((o) => o.op === 'advertise' && o.topic === '/emergency_stop')).toBe(true)
    expect(t.conectado).toBe(true)
  })

  it('con reconectar:true, el onclose tardio del viejo (tras cerrar()+conectar() manual) no programa una reconexion extra', async () => {
    vi.useFakeTimers()
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket, {
      reconectar: true, aleatorio: () => 0.5,
    })
    t.conectar()
    WSFalso.ultimo.abrir()

    t.cerrar()
    t.conectar()
    const nuevo = WSFalso.ultimo
    nuevo.abrir()

    await Promise.resolve()
    await Promise.resolve()   // el onclose tardio del viejo llega aqui

    vi.advanceTimersByTime(60000)   // muy por encima de cualquier espera pendiente
    expect(WSFalso.ultimo).toBe(nuevo)   // ningun socket extra
    vi.useRealTimers()
  })

  // 🔴 R3: esta prueba PASABA con la guarda de `onmessage` quitada -solo
  // afirmaba `not.toThrow()` y `conectado === true`, y ninguna de las dos
  // cambia si el mensaje tardio SI se procesa. Lo que de verdad importa:
  // el suscriptor no tiene que recibir un mensaje FANTASMA (de un socket que
  // ya no existe), y `ultimaLlegada` no se puede tocar con el, porque eso
  // reinicia `intentos` (rompe la espera creciente) y puede poner
  // `salud.ts` en EN_LINEA con datos de un socket muerto.
  it('un mensaje entregado tarde por el socket VIEJO no se procesa: el suscriptor no recibe nada y ultimaLlegada no se toca', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()
    const viejo = WSFalso.ultimo

    const recibidos: unknown[] = []
    t.suscribir('/odom', (m) => recibidos.push(m))

    t.cerrar()
    t.conectar()
    const nuevo = WSFalso.ultimo
    nuevo.abrir()

    // El socket viejo, todavia con referencias validas a sus handlers,
    // entrega un mensaje tardio -no debe lanzar, no debe llegar al
    // suscriptor, y no debe marcar ultimaLlegada.
    expect(() => viejo.recibir({ op: 'publish', topic: '/odom', msg: { n: 99 } })).not.toThrow()

    expect(recibidos).toEqual([])
    expect(t.msDesdeUltimo('/odom')).toBeNull()

    await Promise.resolve()
    await Promise.resolve()
    expect(t.conectado).toBe(true)
  })

  // 🔴 R2: la guarda de `onopen` (misma familia que la de `onmessage` de
  // arriba) tampoco la protegia ninguna prueba: romperla sola dejaba las 84
  // pruebas en verde. `enviar()` usa SIEMPRE `this.ws` -el socket VIGENTE-,
  // asi que un `onopen` tardio del socket VIEJO, sin guarda, reenviaria el
  // bucle de resuscripcion/reanuncio y duplicaria trafico sobre el socket
  // NUEVO, aunque quien disparo el evento fuera el viejo.
  it('el onopen tardio de un socket VIEJO no reenvia suscripciones ni anuncios sobre el socket NUEVO', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    const viejo = WSFalso.ultimo
    viejo.abrir()
    t.suscribir('/odom', () => {})
    t.publicar('/emergency_stop', {})   // queda anunciado

    t.cerrar()
    t.conectar()
    const nuevo = WSFalso.ultimo
    nuevo.abrir()
    const enviadosTrasAbrirNuevo = nuevo.enviados.length

    // onopen TARDIO del socket viejo: `this.ws` ya es `nuevo`.
    viejo.abrir()

    expect(nuevo.enviados.length).toBe(enviadosTrasAbrirNuevo)
  })
})

// R1: la regresion que abrio la ronda anterior de arreglos. La guarda de C3
// en `onclose` (`if (this.ws !== ws) return`) se evalua DESPUES de que
// `cerrar()` haga `this.ws = null`, y con un `close()` ASINCRONO (como el de
// WSFalso, que imita al real) ese `onclose` diferido SIEMPRE sale por la
// guarda. Sin desmontaje explicito en `cerrar()`, un cierre a secas dejaba de
// cancelar las llamadas en vuelo y de avisar a `oyentesCierre` -la misma
// atribucion falsa de I1 (una llamada que vence su plazo y culpa al robot),
// reintroducida por otra puerta. Medido contra el codigo anterior (c81072d)
// en r1-r3-report.md.
describe('Transporte — R1: cerrar() hace su desmontaje sin esperar el onclose asincrono', () => {
  it('cerrar() a secas cancela YA una llamada en vuelo (con el motivo del cierre, no la conjetura del plazo) y avisa a oyentesCierre UNA sola vez, en el acto', async () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    let caidas = 0
    t.alCerrarse(() => { caidas++ })

    const p = t.llamar('/start_scan')   // llamada en vuelo, plazo por defecto 5 s

    t.cerrar()

    // En el ACTO, sin avanzar ni un microtask ni un timer: `oyentesCierre` ya
    // disparo y la llamada ya esta rechazada con el motivo del cierre -no con
    // la conjetura generica de "sin respuesta... denegado... o caido" que
    // solo aparece si se deja vencer el plazo de 5 s.
    expect(caidas).toBe(1)
    await expect(p).rejects.toThrow(/se cerro el WebSocket/)
    await expect(p).rejects.not.toThrow(/denegado|robot puede estar caido/)

    // Y el onclose asincrono del socket que se acaba de cerrar, si llega,
    // sale por la guarda de C3 (`this.ws` ya es `null`) y no vuelve a avisar.
    await Promise.resolve()
    await Promise.resolve()
    expect(caidas).toBe(1)
  })

  // La caida ESPONTANEA (el robot se apaga, se pierde el WiFi...) no debe
  // cambiar: sigue siendo el `onclose` real el que hace el desmontaje, no
  // `cerrar()` -que aqui nunca se llama.
  it('una caida espontanea (sin cerrar()) sigue cancelando y avisando igual que antes', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    let caidas = 0
    t.alCerrarse(() => { caidas++ })

    WSFalso.ultimo.onclose?.()   // se cae de verdad, nadie llamo a cerrar()

    expect(caidas).toBe(1)
  })
})

// Punto 7 del encargo: HAY DOS PAREDES DE PLAZO y antes solo se movia una.
// rosbridge fija la suya con el `timeout` del propio op (call_service.py);
// `llamar()` arma ademas una LOCAL en JS. Medido: un servicio que falla de
// verdad responde con el motivo real a los ~6 s, y un local de exactamente
// 5 s ganaba la carrera y lo sustituia por el generico "denegado o caido".
describe('Transporte — llamar(): dos paredes de plazo, y el local va POR ENCIMA', () => {
  it('manda el timeout en SEGUNDOS a rosbridge, calculado a partir de ms', () => {
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    t.llamar('/start_scan', {}, 5000)
    const llamada = WSFalso.ultimo.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')
    expect(llamada.timeout).toBe(5)   // segundos, no milisegundos
  })

  it('el temporizador LOCAL es mayor que el que se le pide a rosbridge: a los 5 s (su plazo) todavia no rechaza', async () => {
    vi.useFakeTimers()
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const p = t.llamar('/start_scan')   // ms por defecto: 5000 -> timeout a rosbridge: 5 s
    let rechazado = false
    p.catch(() => { rechazado = true })

    vi.advanceTimersByTime(5000)   // exactamente el plazo que le pedimos a rosbridge
    await Promise.resolve()
    await Promise.resolve()
    // Si el local venciera aqui, ganaria la carrera casi siempre al motivo
    // real que rosbridge manda alrededor de este mismo instante -medido.
    expect(rechazado).toBe(false)

    vi.advanceTimersByTime(MARGEN_PLAZO_LOCAL_MS)   // el margen: rosbridge nunca contesto nada
    await Promise.resolve()
    expect(rechazado).toBe(true)

    vi.useRealTimers()
  })

  // Camino bueno: si rosbridge SI contesta dentro del margen (con el motivo
  // real, `result:false`), esa respuesta gana y el generico local nunca
  // aparece -es justo lo que el margen existe para permitir.
  it('si rosbridge contesta con el motivo real DENTRO del margen, ese motivo gana (no el generico)', async () => {
    vi.useFakeTimers()
    const t = new Transporte('ws://x:9090', (u) => new WSFalso(u) as unknown as WebSocket)
    t.conectar()
    WSFalso.ultimo.abrir()

    const p = t.llamar('/start_scan')
    const llamada = WSFalso.ultimo.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'call_service')

    vi.advanceTimersByTime(6000)   // el "~6 s" medido: dentro de 5000 + MARGEN (2000)
    WSFalso.ultimo.recibir({
      op: 'service_response', id: llamada.id, result: false, values: 'el YDLIDAR no respondio',
    })

    await expect(p).rejects.toThrow(/YDLIDAR no respondio/)
    await expect(p).rejects.not.toThrow(/denegado|robot puede estar caido/)
    vi.useRealTimers()
  })
})

describe('🔴 plazo de conexion — un socket colgado NO da error nunca', () => {
  /*
   * Medido en el navegador el 2026-08-04, con el robot encendido y sano:
   *
   *   ws://rvr-01.local:9090   🔴 12 s sin onopen, sin onerror, sin onclose
   *   ws://10.14.7.7:9090      🔴 12 s igual — MISMA FIRMA
   *   ws://192.168.1.58:9090   ✅ abre
   *
   * `rvr-NN.local` resuelve a cuatro direcciones y las dos primeras que el
   * sistema devuelve son inservibles desde esta red. No fallan: se cuelgan.
   *
   * Sin plazo, el muro dejaba 16 conexiones colgadas para siempre Y la
   * reconexion con espera creciente no llegaba a arrancar, porque `onclose`
   * nunca disparaba.
   */
  const conPlazo = (opciones = {}) => {
    const disparos: (() => void)[] = []
    const t = new Transporte(
      'ws://rvr-01.local:9090',
      (u) => new WSFalso(u) as unknown as WebSocket,
      { programar: ((fn: () => void) => { disparos.push(fn); return 0 as never }), ...opciones },
    )
    const avisos: string[] = []
    t.alAviso((a) => avisos.push(a.mensaje))
    return { t, disparos, avisos }
  }

  it('si el socket sigue en CONNECTING al vencer, lo cierra y AVISA', () => {
    const { t, disparos, avisos } = conPlazo()
    t.conectar()
    expect(WSFalso.ultimo.readyState).toBe(0)   // CONNECTING

    disparos[0]()                                // vence el plazo

    expect(WSFalso.ultimo.readyState).toBe(2)   // CLOSING: se le mando cerrar
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatch(/no se abrio el WebSocket/)
    // 🔴 El aviso tiene que nombrar la causa REAL y no culpar al robot: la
    //    direccion puede ser inalcanzable desde esta red.
    expect(avisos[0]).toMatch(/inalcanzable desde esta red/)
    expect(avisos[0]).not.toMatch(/robot.*(caido|apagado|averiad)/i)
  })

  it('si ya abrio, el plazo NO cierra nada ni avisa', () => {
    const { t, disparos, avisos } = conPlazo()
    t.conectar()
    WSFalso.ultimo.abrir()
    expect(t.conectado).toBe(true)

    disparos[0]()   // el temporizador existe pero llega tarde

    expect(t.conectado).toBe(true)
    expect(WSFalso.ultimo.readyState).toBe(1)
    expect(avisos).toEqual([])
  })

  it('🔴 `cerrar()` desarma el plazo: no avisa de lo que el usuario cerro', () => {
    // Un temporizador huerfano ya costo «3 sockets contra 1» en este fichero
    // con `reconexionProgramada`. No se repite.
    const { t, disparos, avisos } = conPlazo()
    t.conectar()
    t.cerrar()

    if (disparos[0] !== undefined) disparos[0]()

    expect(avisos).toEqual([])
  })

  it('`plazoConexion: 0` lo desactiva: no llega a programarse', () => {
    const { t, disparos } = conPlazo({ plazoConexion: 0 })
    t.conectar()
    expect(disparos).toHaveLength(0)
  })

  it('🔴 el plazo por defecto deja holgura sobre lo PEOR medido, no sobre lo tipico', () => {
    /*
     * Medido en el navegador con el muro entero intentandolo a la vez:
     *   ws://rvr-01.local:9090    4339 ms (cache fria) · 2331 ms (caliente)
     *   ws://192.168.1.200:9090   4623 ms
     *   una toma suelta por nombre               7293 ms
     *
     * La primera version puso 5000 y dejaba 400 ms de margen sobre lo tipico —
     * y la toma de 7,3 s lo habria pasado. Un plazo demasiado corto no da un
     * fallo: da un «no llego» INTERMITENTE sobre un robot sano, que es el peor
     * modo de fallo para depurar y el que este proyecto lleva persiguiendo.
     *
     * Subirlo no cuesta nada en pantalla: la baldosa ya dice «no llego» desde
     * el primer instante. El plazo solo decide cuando se REINTENTA.
     */
    expect(PLAZO_CONEXION_MS).toBeGreaterThanOrEqual(7300)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   ACCIONES — lo medido contra rvr-01 el 2026-08-06, fijado aqui
   ═══════════════════════════════════════════════════════════════════════════ */

const fabrica = (u: string) => new WSFalso(u) as unknown as WebSocket

/** Un transporte ya conectado y abierto. Las de arriba lo hacen a mano. */
function transporteConectado(): { t: Transporte; ws: WSFalso } {
  const t = new Transporte('ws://x:9090', fabrica)
  t.conectar()
  const ws = WSFalso.ultimo
  ws.abrir()
  return { t, ws }
}

describe('Transporte — acciones', () => {
  it('manda `send_action_goal` con el tipo y `feedback: true`', () => {
    const { t, ws } = transporteConectado()
    t.enviarObjetivo('/navigate_to_pose', 'nav2_msgs/action/NavigateToPose', { pose: {} })
    const op = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'send_action_goal')
    expect(op.action).toBe('/navigate_to_pose')
    expect(op.action_type).toBe('nav2_msgs/action/NavigateToPose')
    // Sin `feedback` rosbridge no reenvia el avance, y para Nav2 eso es navegar
    // a ciegas: solo llegaria el resultado final.
    expect(op.feedback).toBe(true)
  })

  it('🔴 una accion FUERA de la lista blanca lanza, y NO deja promesa huerfana', () => {
    const { t, ws } = transporteConectado()
    expect(() => t.enviarObjetivo('/inventada', 'x/action/Y', {})).toThrowError(/acciones/i)
    // Y no se mando nada por el cable.
    expect(ws.enviados.some((s) => s.includes('send_action_goal'))).toBe(false)
  })

  it('el avance NO resuelve: puede haber decenas antes del resultado', async () => {
    const { t, ws } = transporteConectado()
    const avances: unknown[] = []
    const { id, resultado } = t.enviarObjetivo(
      '/navigate_to_pose', 'nav2_msgs/action/NavigateToPose', {},
      { alAvance: (v) => avances.push(v) },
    )
    let cerrado = false
    void resultado.then(() => { cerrado = true }, () => { cerrado = true })

    for (const d of [3.1, 2.4, 1.0]) {
      ws.recibir({ op: 'action_feedback', id, values: { distance_remaining: d } })
    }
    await Promise.resolve(); await Promise.resolve()
    expect(avances).toHaveLength(3)
    // Confundir avance con resultado cerraria la navegacion en el primer parte.
    expect(cerrado).toBe(false)

    ws.recibir({ op: 'action_result', id, values: { result: {} }, result: true })
    await expect(resultado).resolves.toEqual({ result: {} })
  })

  it('🔴🔴 al fallar, `values` llega como CADENA — medido en el robot', async () => {
    /*
     * Contra rvr-01, con Nav2 parado:
     *   {"op":"action_result","values":"No action server available",
     *    "status":0,"result":false,"id":"act1"}
     * `values` NO es el objeto de resultado. Resolverlo como exito pondria esa
     * frase donde la pantalla espera una pose.
     */
    const { t, ws } = transporteConectado()
    const { id, resultado } = t.enviarObjetivo('/navigate_to_pose', 'nav2_msgs/action/NavigateToPose', {})
    ws.recibir({
      op: 'action_result', id, action: '/navigate_to_pose',
      values: 'No action server available', status: 0, result: false,
    })
    await expect(resultado).rejects.toThrow(/No action server available/)
  })

  it('cancelar manda el op y NO cierra la promesa: la cierra el action_result', async () => {
    const { t, ws } = transporteConectado()
    const { id, resultado } = t.enviarObjetivo('/navigate_to_pose', 'nav2_msgs/action/NavigateToPose', {})
    let cerrado = false
    void resultado.then(() => { cerrado = true }, () => { cerrado = true })

    t.cancelarObjetivo('/navigate_to_pose', id)
    const op = ws.enviados.map((s) => JSON.parse(s)).find((o) => o.op === 'cancel_action_goal')
    expect(op.id).toBe(id)
    await Promise.resolve(); await Promise.resolve()
    // Cerrarla aqui dejaria sin dueño al `action_result` que rosbridge manda igual.
    expect(cerrado).toBe(false)

    ws.recibir({ op: 'action_result', id, values: {}, result: true, status: 5 })
    await expect(resultado).resolves.toEqual({})
  })

  it('sin enlace RECHAZA en el acto y no lanza', async () => {
    const t = new Transporte('ws://x:9090', fabrica)   // nunca conectado
    const { resultado } = t.enviarObjetivo('/navigate_to_pose', 'nav2_msgs/action/NavigateToPose', {})
    await expect(resultado).rejects.toThrow(/NO se ha enviado/)
  })

  it('si se cae el enlace, el objetivo se rechaza y su oyente se suelta', async () => {
    const { t, ws } = transporteConectado()
    const avances: unknown[] = []
    const { id, resultado } = t.enviarObjetivo(
      '/navigate_to_pose', 'nav2_msgs/action/NavigateToPose', {}, { alAvance: (v) => avances.push(v) },
    )
    const espera = expect(resultado).rejects.toThrow(/WebSocket/)
    t.cerrar()
    await espera
    // Un avance de una reconexion no puede llegarle a un objetivo que ya nadie
    // espera: el oyente se solto al cerrar.
    ws.recibir({ op: 'action_feedback', id, values: { tarde: true } })
    expect(avances).toHaveLength(0)
  })
})
