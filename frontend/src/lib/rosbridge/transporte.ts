import { RegistroPendientes, opAdvertise, opCallService, opPublish, opSubscribe } from './protocolo'

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
  private contador = 0
  private intentos = 0

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

  conectar(): void {
    const ws = this.fabrica(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.intentos = 0
      // Al reconectar se resuscribe a TODO y se reanuncia: rosbridge infiere el
      // QoS mirando los publicadores al suscribirse y no se reajusta despues.
      for (const topic of this.suscripciones.keys()) this.enviar(opSubscribe(topic))
      for (const topic of this.anunciados) this.enviar(opAdvertise(topic))
    }
    ws.onmessage = (e: MessageEvent) => this.entrante(JSON.parse(String(e.data)))
    ws.onclose = () => {
      this.ws = null
      this.anunciados.clear()   // el socket nuevo tendra que reanunciar
      this.pendientes.cancelarTodas('se cerro el WebSocket')
      for (const cb of this.oyentesCierre) cb()
      // 🔴 NO se libera la parada de emergencia al reconectar: liberarla es
      //    siempre un acto humano deliberado.
      if (this.opciones.reconectar) {
        const espera = esperaReconexion(this.intentos++, this.opciones.aleatorio)
        const programar = this.opciones.programar ?? setTimeout
        programar(() => this.conectar(), espera)
      }
    }
  }

  cerrar(): void {
    this.ws?.close()
    this.ws = null
  }

  private enviar(op: unknown): void {
    this.ws?.send(JSON.stringify(op))
  }

  private entrante(m: { op: string; topic?: string; msg?: unknown; id?: string; values?: unknown }): void {
    if (m.op === 'publish' && m.topic) {
      this.ultimaLlegada.set(m.topic, Date.now())
      for (const cb of this.suscripciones.get(m.topic) ?? []) cb(m.msg)
      return
    }
    if (m.op === 'service_response' && m.id) this.pendientes.resolver(m.id, m.values)
  }

  suscribir(topic: string, cb: Manejador): () => void {
    const nueva = !this.suscripciones.has(topic)
    if (nueva) this.suscripciones.set(topic, new Set())
    this.suscripciones.get(topic)!.add(cb)
    if (nueva && this.conectado) this.enviar(opSubscribe(topic))
    return () => { this.suscripciones.get(topic)?.delete(cb) }
  }

  publicar(topic: string, msg: unknown): void {
    if (!this.anunciados.has(topic)) {
      this.enviar(opAdvertise(topic))
      this.anunciados.add(topic)
    }
    this.enviar(opPublish(topic, msg))
  }

  llamar(servicio: string, args: unknown = {}, ms = 5000): Promise<unknown> {
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
