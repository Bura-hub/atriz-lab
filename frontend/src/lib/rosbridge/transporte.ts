import {
  RegistroPendientes, opAdvertise, opCallService, opPublish, opSubscribe, opUnsubscribe,
} from './protocolo'

/**
 * Un WebSocket por robot. NO hay namespace: al robot lo identifica la CONEXION,
 * asi que el mismo codigo sirve para los 16.
 */
export function urlDeRobot(robot: number | string): string {
  const host = typeof robot === 'number' ? `rvr-${String(robot).padStart(2, '0')}.local` : robot
  return `ws://${host}:9090`
}

/** 1 s duplicando hasta 30 s, con +-20 % de ruido. */
export function esperaReconexion(intento: number, aleatorio: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** intento, 30000)
  return Math.round(base * (0.8 + 0.4 * aleatorio()))
}

type Manejador = (msg: unknown) => void
type FabricaWS = (url: string) => WebSocket

/** Lo que rosbridge cuenta por su canal `status`, y lo que no se pudo leer. */
export interface Aviso {
  nivel: string
  mensaje: string
}

interface OpcionesTransporte {
  reconectar?: boolean
  aleatorio?: () => number
  programar?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
}

export class Transporte {
  private ws: WebSocket | null = null
  private suscripciones = new Map<string, Set<Manejador>>()
  private anunciados = new Set<string>()
  private ultimaLlegada = new Map<string, number>()
  private pendientes = new RegistroPendientes()
  private oyentesCierre = new Set<() => void>()
  private oyentesAviso = new Set<(a: Aviso) => void>()
  private contador = 0
  private intentos = 0
  private cierreDeliberado = false
  private reconexionProgramada: ReturnType<typeof setTimeout> | null = null

  constructor(
    private url: string,
    private fabrica: FabricaWS = (u) => new WebSocket(u),
    private opciones: OpcionesTransporte = {},
  ) {}

  get conectado(): boolean {
    return this.ws !== null && this.ws.readyState === 1
  }

  /** Para que la teleoperacion pueda cortar su bucle al caerse el enlace. */
  alCerrarse(cb: () => void): () => void {
    this.oyentesCierre.add(cb)
    return () => this.oyentesCierre.delete(cb)
  }

  /**
   * Avisos de rosbridge y mensajes ilegibles. rosbridge DENIEGA EN SILENCIO,
   * asi que su canal `status` es lo unico que cuenta lo que rechazo: tirarlo
   * era quedarse sin la unica pista que da.
   */
  alAviso(cb: (a: Aviso) => void): () => void {
    this.oyentesAviso.add(cb)
    return () => this.oyentesAviso.delete(cb)
  }

  private avisar(a: Aviso): void {
    for (const cb of this.oyentesAviso) cb(a)
  }

  conectar(): void {
    // 🔴 IDEMPOTENTE. Sin esta guarda, dos llamadas dejaban DOS sockets vivos:
    //    cada mensaje se entregaba dos veces, y el `onclose` del viejo cancelaba
    //    las llamadas pendientes del nuevo, que estaba sano.
    if (this.ws !== null) return

    this.cierreDeliberado = false
    const ws = this.fabrica(this.url)
    this.ws = ws

    ws.onopen = () => {
      // 🔴 `intentos` NO se reinicia aqui. Que el socket ABRA no prueba que el
      //    enlace sirva: con rosbridge reiniciandose, cada ciclo pasaba por
      //    `onopen` antes que por `onclose` y la espera se quedaba clavada en
      //    ~1 s para siempre — el antipatron del driver que esto evita.
      //    Se reinicia cuando llega un MENSAJE, que si lo prueba.
      // Al reconectar se resuscribe a TODO y se reanuncia: rosbridge infiere el
      // QoS mirando los publicadores al suscribirse y no se reajusta despues.
      for (const topic of this.suscripciones.keys()) this.enviar(opSubscribe(topic))
      for (const topic of this.anunciados) this.enviar(opAdvertise(topic))
    }

    ws.onmessage = (e: MessageEvent) => {
      let m: unknown
      try {
        m = JSON.parse(String(e.data))
      } catch {
        // Un mensaje ilegible no puede tumbar el manejador entero ni pasar mudo.
        this.avisar({ nivel: 'error', mensaje: 'mensaje entrante ilegible: JSON invalido' })
        return
      }
      this.entrante(m as Parameters<typeof this.entrante>[0])
    }

    ws.onclose = () => {
      this.ws = null
      this.anunciados.clear()   // el socket nuevo tendra que reanunciar
      this.pendientes.cancelarTodas('se cerro el WebSocket')
      for (const cb of this.oyentesCierre) cb()
      // 🔴 NO se libera la parada de emergencia al reconectar: liberarla es
      //    siempre un acto humano deliberado.
      // 🔴 Y no se reconecta si el cierre lo pidio el usuario: `onclose` no
      //    distingue los dos casos por si solo, y sin esta bandera un `cerrar()`
      //    levantaba un socket nuevo que seguia recibiendo /scan —el 83 % del
      //    trafico— sin que nadie supiera que existia.
      if (this.opciones.reconectar && !this.cierreDeliberado) {
        const espera = esperaReconexion(this.intentos++, this.opciones.aleatorio)
        const programar = this.opciones.programar ?? setTimeout
        this.reconexionProgramada = programar(() => {
          this.reconexionProgramada = null
          this.conectar()
        }, espera)
      }
    }
  }

  cerrar(): void {
    // Se marca ANTES de cerrar, porque `onclose` se dispara dentro de `close()`.
    this.cierreDeliberado = true
    if (this.reconexionProgramada !== null) {
      clearTimeout(this.reconexionProgramada)
      this.reconexionProgramada = null
    }
    this.ws?.close()
    this.ws = null
  }

  private enviar(op: unknown): void {
    this.ws?.send(JSON.stringify(op))
  }

  private entrante(m: {
    op: string; topic?: string; msg?: unknown; id?: string; values?: unknown
    level?: string; msg_text?: string
  }): void {
    // Un mensaje que llega SI prueba que el enlace sirve. Ver `onopen`.
    this.intentos = 0

    if (m.op === 'publish' && m.topic) {
      this.ultimaLlegada.set(m.topic, Date.now())
      for (const cb of this.suscripciones.get(m.topic) ?? []) cb(m.msg)
      return
    }
    if (m.op === 'service_response' && m.id) {
      this.pendientes.resolver(m.id, m.values)
      return
    }
    if (m.op === 'status') {
      this.avisar({ nivel: String(m.level ?? 'info'), mensaje: String(m.msg ?? m.msg_text ?? '') })
    }
  }

  suscribir(topic: string, cb: Manejador): () => void {
    const nueva = !this.suscripciones.has(topic)
    if (nueva) this.suscripciones.set(topic, new Set())
    this.suscripciones.get(topic)!.add(cb)
    if (nueva && this.conectado) this.enviar(opSubscribe(topic))
    return () => {
      const oyentes = this.suscripciones.get(topic)
      if (!oyentes) return
      oyentes.delete(cb)
      // 🔴 Al quedarse SIN oyentes hay que decirselo AL ROBOT, no solo dejar de
      //    escuchar. Si no, /scan —el 83 % del trafico por robot— sigue llegando
      //    para siempre, y la reconexion se resuscribe a un topic que ya nadie
      //    quiere. Silencioso y caro.
      if (oyentes.size === 0) {
        this.suscripciones.delete(topic)
        if (this.conectado) this.enviar(opUnsubscribe(topic))
      }
    }
  }

  publicar(topic: string, msg: unknown): void {
    // 🔴 LANZA si no hay enlace. `this.ws?.send()` no-opeaba EN SILENCIO, y por
    //    aqui pasa /emergency_stop: una parada perdida sin que nadie se entere
    //    es el fallo mas caro y mas repetido de este proyecto. Quien publique
    //    tiene que poder decirle al usuario que NO se envio.
    if (!this.conectado) {
      throw new Error(`sin conexion con el robot: «${topic}» NO se ha enviado`)
    }
    if (!this.anunciados.has(topic)) {
      this.enviar(opAdvertise(topic))
      this.anunciados.add(topic)
    }
    this.enviar(opPublish(topic, msg))
  }

  llamar(servicio: string, args: unknown = {}, ms = 5000): Promise<unknown> {
    // Mismo motivo que `publicar`: sin enlace se dice en el acto, no se espera
    // cinco segundos a un plazo que ya se sabe que va a vencer.
    if (!this.conectado) {
      return Promise.reject(new Error(`sin conexion con el robot: «${servicio}» NO se ha llamado`))
    }
    const id = `atriz-${++this.contador}`
    const p = this.pendientes.registrar(id, ms)
    this.enviar(opCallService(servicio, args, id))
    return p
  }

  /** null = no ha llegado ninguno todavia. Es lo que alimenta salud.ts. */
  msDesdeUltimo(topic: string): number | null {
    const t = this.ultimaLlegada.get(topic)
    return t === undefined ? null : Date.now() - t
  }
}
