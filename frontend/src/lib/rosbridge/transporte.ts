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

/**
 * 🔴 Punto 7 del encargo: hay DOS paredes de plazo para una `llamar()`, y
 * antes solo se movia una. rosbridge tiene la SUYA (el `timeout` del propio
 * `op`, ver `opCallService`); `Transporte.llamar()` arma ademas un
 * temporizador LOCAL, en JS, que antes corria a ciegas del de rosbridge.
 *
 * Medido: ante un servicio que FALLA de verdad, rosbridge contesta con el
 * motivo REAL a los ~6 s (su propio default de 5,0 s mas el redondeo de red).
 * Con un local de exactamente el mismo valor, el local gana la carrera casi
 * siempre y sustituye el motivo real por el generico "denegado o el robot
 * esta caido" -justo la conjetura que este proyecto ya paga caro en otros
 * sitios. Este margen pone el muro LOCAL por ENCIMA del que se le pide a
 * rosbridge: el generico solo puede aparecer si rosbridge no contesta NADA,
 * que es el unico caso en que es cierto.
 */
export const MARGEN_PLAZO_LOCAL_MS = 2000

type Manejador = (msg: unknown) => void
type FabricaWS = (url: string) => WebSocket

/** Un aviso local del cliente. Ver el docstring de `alAviso()`. */
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
   * Avisos LOCALES del cliente. Hoy solo uno: un mensaje entrante ilegible.
   *
   * ⚠️ NO llega por aqui ninguna denegacion de rosbridge, aunque seria el sitio
   *    natural. Verificado en el fuente de rosbridge 2.7.0: `Protocol.log()`
   *    escribe en el logger DEL NODO y ahi acaba —`"status"` tiene 0
   *    apariciones en `protocol.py` y en `rosbridge_server`—, asi que el aviso
   *    se queda en el journal del robot y NO sale por el socket.
   * → No hay red de seguridad si la lista blanca del robot se separa de
   *   `contrato.ts`. Lo unico que avisa es el plazo de 5 s de `llamar()`, y por
   *   eso existe `comprobar_contrato.mjs`.
   */
  alAviso(cb: (a: Aviso) => void): () => void {
    this.oyentesAviso.add(cb)
    return () => this.oyentesAviso.delete(cb)
  }

  private avisar(a: Aviso): void {
    for (const cb of this.oyentesAviso) cb(a)
  }

  conectar(): void {
    // 🔴 Cancela una reconexion ya programada ANTES de nada: si no, un
    //    `conectar()` manual mientras hay un temporizador pendiente lo deja
    //    huerfano —solo se sobrescribia la referencia— y ese temporizador
    //    dispara mas tarde, incluso DESPUES de un `cerrar()`. Medido: 3 sockets
    //    contra 1 en el control.
    if (this.reconexionProgramada !== null) {
      clearTimeout(this.reconexionProgramada)
      this.reconexionProgramada = null
    }
    // 🔴 IDEMPOTENTE. Sin esta guarda, dos llamadas dejaban DOS sockets vivos:
    //    cada mensaje se entregaba dos veces, y el `onclose` del viejo cancelaba
    //    las llamadas pendientes del nuevo, que estaba sano.
    if (this.ws !== null) return

    const ws = this.fabrica(this.url)
    this.ws = ws

    ws.onopen = () => {
      // 🔴 C3: si mientras tanto YA hay un socket mas nuevo (`this.ws` cambio),
      //    este `onopen` es de un socket VIEJO/obsoleto: salir sin tocar nada.
      if (this.ws !== ws) return
      // 🔴 `intentos` NO se reinicia aqui. Que el socket ABRA no prueba que el
      //    enlace sirva: con rosbridge reiniciandose, cada ciclo pasaba por
      //    `onopen` antes que por `onclose` y la espera se quedaba clavada en
      //    ~1 s para siempre — el antipatron del driver que esto evita.
      //    Se reinicia cuando llega un MENSAJE, que si lo prueba.
      // Al reconectar se resuscribe a TODO: rosbridge infiere el QoS mirando
      // los publicadores al suscribirse y no se reajusta despues.
      // 🔴 C2: cada topic en su propio try/catch. `suscribir()` ya impide que
      //    entre un topic invalido por la via publica, pero un solo topic que
      //    lance aqui (por la razon que sea) no debe arrastrar a los demas ni
      //    cortar el bucle de reanuncio de abajo -que es donde vive
      //    /emergency_stop.
      for (const topic of this.suscripciones.keys()) {
        try {
          this.enviar(opSubscribe(topic))
        } catch (error) {
          this.avisar({
            nivel: 'error',
            mensaje: `no se pudo re-suscribir a «${topic}»: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }
      // Se reanuncia TODO lo que estaba anunciado. No se limpia `anunciados` al
      // cerrar a proposito: asi /emergency_stop vuelve anunciado desde el primer
      // instante y pulsar la parada es UN mensaje, no un advertise + un publish.
      for (const topic of this.anunciados) {
        try {
          this.enviar(opAdvertise(topic))
        } catch (error) {
          this.avisar({
            nivel: 'error',
            mensaje: `no se pudo re-anunciar «${topic}»: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }
    }

    ws.onmessage = (e: MessageEvent) => {
      // 🔴 C3: mensaje de un socket VIEJO despues de que `this.ws` ya apunte
      //    a otro (una reconexion rapida puede dejar el viejo entregando
      //    mensajes un rato). No debe alimentar `entrante()` con datos de un
      //    socket que ya no es el vigente.
      if (this.ws !== ws) return
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
      // 🔴🔴 C3, EL CRITICO: el `close()` de un WebSocket real es ASINCRONO.
      //    `cerrar()` anula `this.ws` de inmediato (sincrono, deliberado) y un
      //    `conectar()` justo despues (el boton "Reconectar" tipico:
      //    `cerrar(); conectar()`) ya deja `this.ws` apuntando al socket
      //    NUEVO antes de que este `onclose` DEL VIEJO llegue a disparar. Sin
      //    esta guarda, `this.ws = null` de aqui abajo anulaba el socket
      //    NUEVO y VIVO: medido, `conectado` pasaba a `false` con el socket
      //    nuevo en OPEN y `/odom` seguiendo entrando -telemetria viva mas
      //    parada muerta (`publicar('/emergency_stop')` lanzando para
      //    siempre), la cancelacion de las llamadas en vuelo del socket sano
      //    (`pendientes.cancelarTodas`), y el corte del bucle de
      //    teleoperacion via `oyentesCierre`. Un `onclose` que no es el del
      //    socket vigente no debe tocar NADA de este estado.
      if (this.ws !== ws) return
      this.ws = null
      // 🔴 NO se limpia `anunciados` aqui: ver el comentario del bucle de
      //    reanuncio en `onopen`. Limpiarlo dejaba ese bucle recorriendo
      //    siempre un conjunto vacio -codigo muerto- y perdia el reanuncio
      //    anticipado justo donde mas importa, /emergency_stop.
      this.pendientes.cancelarTodas('se cerro el WebSocket')
      for (const cb of this.oyentesCierre) cb()
      // 🔴 NO se libera la parada de emergencia al reconectar: liberarla es
      //    siempre un acto humano deliberado.
      // 🔴 Y esto NUNCA se alcanza tras un `cerrar()` deliberado: `cerrar()`
      //    ya dejo `this.ws` en `null` de forma SINCRONA (ver mas abajo), asi
      //    que la guarda de arriba (`this.ws !== ws`) sale antes de llegar
      //    aqui. Por eso ya no hace falta una bandera aparte para distinguir
      //    «lo pidio el usuario» de «se cayo el enlace» -habia una
      //    (`cierreDeliberado`) y quedo muerta tras el arreglo de R1:
      //    medido quitandola, las 87 pruebas siguen en verde. Sin la guarda
      //    de C3 esto SI haria falta -era su version anterior, cuando
      //    `onclose` corria sin ella y un `cerrar()` levantaba un socket
      //    nuevo que seguia recibiendo /scan —el 83 % del trafico— sin que
      //    nadie supiera que existia.
      if (this.opciones.reconectar) {
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
    if (this.reconexionProgramada !== null) {
      clearTimeout(this.reconexionProgramada)
      this.reconexionProgramada = null
    }
    // 🔴 R1: el `close()` de un WebSocket real es ASINCRONO (ver el comentario
    //    de C3 en `ws.onclose`, mas abajo), asi que su `onclose` diferido no
    //    ha disparado todavia en este punto. La guarda de C3 (`this.ws !== ws`)
    //    lo va a descartar en cuanto llegue, porque `this.ws` esta a punto de
    //    quedar en `null` -y eso es CORRECTO para un socket viejo tras un
    //    `cerrar(); conectar()`, pero significa que NO podemos confiar en que
    //    ese `onclose` haga el desmontaje: hay que hacerlo aqui, explicito,
    //    ANTES de anular `this.ws`. Sin esto, un `cerrar()` a secas ya no
    //    cancelaba las llamadas pendientes ni avisaba a `oyentesCierre` -la
    //    misma atribucion falsa de I1 (pendientes que vencen su plazo y
    //    culpan al robot), reintroducida por otra puerta.
    // Solo si habia algo que cerrar: si `this.ws` ya era `null` (nunca se
    // conecto, o ya se habia caido y su propio `onclose` ya hizo este mismo
    // desmontaje), no hay nada que cancelar ni que avisar dos veces.
    if (this.ws !== null) {
      this.ws.close()
      this.pendientes.cancelarTodas('se cerro el WebSocket')
      for (const cb of this.oyentesCierre) cb()
      this.ws = null
    }
  }

  private enviar(op: unknown): void {
    this.ws?.send(JSON.stringify(op))
  }

  private entrante(m: {
    op: string; topic?: string; msg?: unknown; id?: string; values?: unknown; result?: boolean
  }): void {
    // Un mensaje que llega SI prueba que el enlace sirve. Ver `onopen`.
    this.intentos = 0

    if (m.op === 'publish' && m.topic) {
      this.ultimaLlegada.set(m.topic, Date.now())
      for (const cb of this.suscripciones.get(m.topic) ?? []) cb(m.msg)
      return
    }
    if (m.op === 'service_response' && m.id) {
      // 🔴 rosbridge manda `result: false` cuando el servicio FALLA, con el
      //    motivo REAL en `values` (call_service.py). Resolverlo como exito
      //    tiraba ese motivo y lo sustituia por una conjetura ocho segundos
      //    despues —«no llego ningun /scan, puede que el LIDAR no haya
      //    arrancado»—, apuntando al sitio equivocado. Es «mide antes de
      //    atribuir» al reves, y escrito en el mensaje que lee el alumno.
      if (m.result === false) {
        this.pendientes.rechazar(m.id, `el servicio fallo: ${String(m.values)}`)
        return
      }
      this.pendientes.resolver(m.id, m.values)
      return
    }
  }

  suscribir(topic: string, cb: Manejador): () => void {
    const nueva = !this.suscripciones.has(topic)
    // 🔴 C2: validar ANTES de tocar el Map, este conectado o no.
    //    `opSubscribe(topic)` lanza aqui, en el sitio del error, con el Map
    //    todavia intacto -antes solo se validaba `if (nueva && this.conectado)`,
    //    asi que:
    //    - Desconectado: no lanzaba nada aqui. El fallo aparecia MAS TARDE,
    //      dentro de `onopen`, y ahi la excepcion escapaba del manejador sin
    //      procesar el resto de topics ni el reanuncio.
    //    - Conectado: lanzaba, pero DESPUES de mutar el Map y ANTES de
    //      devolver la funcion de baja: la entrada quedaba dentro sin
    //      ninguna forma publica de quitarla -zombie para siempre.
    const op = nueva ? opSubscribe(topic) : null
    if (nueva) this.suscripciones.set(topic, new Set())
    this.suscripciones.get(topic)!.add(cb)
    if (op && this.conectado) this.enviar(op)
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

  /**
   * `ms` es el plazo que se le pide a ROSBRIDGE (se manda como `timeout`, en
   * segundos: ver `opCallService`). El temporizador LOCAL de verdad es mayor
   * -`ms + MARGEN_PLAZO_LOCAL_MS`-, a proposito: ver el comentario de
   * `MARGEN_PLAZO_LOCAL_MS`, arriba. Asi rosbridge tiene sitio para contestar
   * con el motivo REAL antes de que el generico local lo sustituya.
   */
  llamar(servicio: string, args: unknown = {}, ms = 5000): Promise<unknown> {
    // Mismo motivo que `publicar`: sin enlace se dice en el acto, no se espera
    // cinco segundos a un plazo que ya se sabe que va a vencer.
    if (!this.conectado) {
      return Promise.reject(new Error(`sin conexion con el robot: «${servicio}» NO se ha llamado`))
    }
    const id = `atriz-${++this.contador}`
    // 🔴 I1: construir la op ANTES de registrar. `opCallService()` lanza en
    //    el acto si el servicio no esta en la lista blanca -y antes eso
    //    pasaba DESPUES de `registrar()`, que ya habia creado la promesa y su
    //    temporizador. La promesa quedaba huerfana (nadie la recibe: el throw
    //    corta `llamar()` antes de `return p`) y 5 s despues rechazaba sola,
    //    sin que nadie la escuchara, con el «sin respuesta... puede estar
    //    denegado o el robot puede estar caido» generico -el cliente se
    //    autorrechazo la llamada y mando a diagnosticar el robot.
    const op = opCallService(servicio, args, id, ms / 1000)
    const p = this.pendientes.registrar(id, ms + MARGEN_PLAZO_LOCAL_MS)
    this.enviar(op)
    return p
  }

  /** null = no ha llegado ninguno todavia. Es lo que alimenta salud.ts. */
  msDesdeUltimo(topic: string): number | null {
    const t = this.ultimaLlegada.get(topic)
    return t === undefined ? null : Date.now() - t
  }
}
