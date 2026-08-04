import { permitidoLlamar, permitidoPublicar, permitidoSuscribir, tipoDe } from './contrato'

export interface OpSalida {
  op: string
  [clave: string]: unknown
}

/**
 * 🔴🔴 YA MEDIDO (evidencia 68, robot real): el campo `qos` en `subscribe` SI
 * toma efecto en rosbridge 2.7.0, y por eso NO se manda -a proposito, y no
 * como un simple "no verificado" pendiente de medir.
 *
 * - Pedir `reliability: reliable` sobre `/odom` -que el driver publica
 *   BEST_EFFORT- da **0,00 Hz** entre dos controles a 16,5 Hz: el campo NO es
 *   cosmetico, silencia el topic de verdad si se pide el QoS que no toca.
 * - 🔴 Y lo mas importante para 16 robots con varias pestañas abiertas:
 *   rosbridge crea UNA sola suscripcion ROS por topic y la COMPARTE entre
 *   todos los clientes WebSocket conectados. El QoS del PRIMER cliente que se
 *   suscribe **gobierna a todos los que llegan despues**, sin ningun aviso:
 *   si el primero pide un QoS incompatible, los que llegan despues nacen
 *   MUDOS; si el primero es sano (o no manda `qos`, como aqui), el segundo
 *   hereda ese QoS sano y el suyo propio se ignora en silencio.
 * - Consecuencia: una sola pestaña con un `qos` mal pensado puede dejar
 *   ciegas a las demas -incluidas las de otros alumnos mirando el mismo
 *   robot. `opSubscribe` NO ACEPTA un parametro `qos` EN ABSOLUTO (no es un
 *   argumento opcional sin usar: no existe en la firma), para que mandarlo
 *   por descuido sea imposible. Si algun dia hace falta, tiene que ser una
 *   decision explicita -tocar esta funcion y este comentario- no un default
 *   que nadie revisa.
 */

const exigir = (permitido: boolean, que: string, donde: string) => {
  if (!permitido) {
    throw new Error(
      `«${que}» no esta en la lista blanca de ${donde} del robot (robot.launch.py). ` +
        `Si de verdad hace falta, se amplia EN EL ROBOT, no aqui.`,
    )
  }
}

/**
 * 🔴 El `tipoDe(topic)!` que habia aqui tapaba un `undefined` con un `!`: si
 * alguien añade un topic a TOPICS_LECTURA/TOPICS_ESCRITURA y olvida su
 * entrada en TIPOS, `JSON.stringify` con `type: undefined` hace DESAPARECER
 * la clave entera (`{"op":"subscribe","topic":"/x"}`, sin "type"), y el
 * sintoma es «ese topic no llega» -el mismo que costo el bug de `Encoders`.
 * Lanza en el sitio del error, con el topic nombrado, en vez de mandar al
 * robot un `subscribe`/`advertise` mudo.
 */
const tipoObligatorio = (topic: string): string => {
  const tipo = tipoDe(topic)
  if (tipo === undefined) {
    throw new Error(
      `«${topic}» esta en la lista blanca pero no tiene entrada en TIPOS (contrato.ts): ` +
        `sin tipo, la clave "type" desaparece al serializar y rosbridge recibe un subscribe/advertise mudo.`,
    )
  }
  return tipo
}

export function opSubscribe(topic: string): OpSalida {
  exigir(permitidoSuscribir(topic), topic, 'lectura')
  return { op: 'subscribe', topic, type: tipoObligatorio(topic) }
}

// `unsubscribe` no crea estado ni espera respuesta: no hay «denegado vs caido»
// que resolver, asi que no valida contra la lista blanca como las demas.
export const opUnsubscribe = (topic: string): OpSalida => ({ op: 'unsubscribe', topic })

export function opAdvertise(topic: string): OpSalida {
  exigir(permitidoPublicar(topic), topic, 'escritura')
  return { op: 'advertise', topic, type: tipoObligatorio(topic) }
}

export function opPublish(topic: string, msg: unknown): OpSalida {
  exigir(permitidoPublicar(topic), topic, 'escritura')
  return { op: 'publish', topic, msg }
}

/**
 * 🔴 `timeoutS`, en SEGUNDOS -no ms-, es lo que rosbridge espera en el `op`.
 * Verificado en el fuente de `call_service.py`:
 *
 *   :61   default_call_service_timeout: float = 5.0
 *   :92   timeout = message.get("timeout", self.default_call_service_timeout)
 *   :127  -> se pasa al ServiceCaller
 *
 * El plazo del servicio lo fija el CLIENTE, en el propio mensaje. Antes esta
 * funcion no mandaba el campo, asi que rosbridge usaba SU default (5.0 s) sin
 * que `Transporte.llamar()` lo supiera, y su temporizador LOCAL corria en
 * paralelo, a ciegas. Ver el comentario de `Transporte.llamar()` para la
 * consecuencia medida (el generico ganaba la carrera al motivo real).
 */
export function opCallService(service: string, args: unknown, id: string, timeoutS: number): OpSalida {
  exigir(permitidoLlamar(service), service, 'servicios')
  return { op: 'call_service', service, args, id, timeout: timeoutS }
}

/** Empareja respuestas con llamadas, y pone el plazo que rosbridge no pone. */
export class RegistroPendientes {
  private pendientes = new Map<
    string,
    { resolver: (v: unknown) => void; rechazar: (e: Error) => void; plazo: ReturnType<typeof setTimeout> }
  >()

  registrar(id: string, ms: number): Promise<unknown> {
    // 🔴 Un id repetido pisaba la entrada anterior EN SILENCIO y dejaba su
    //    temporizador huerfano: la PRIMERA llamada acababa rechazada con «sin
    //    respuesta» aunque el robot SI hubiera contestado —bajo la segunda
    //    entrada—, mandando a diagnosticar lo que no es. Es un error de
    //    programacion del llamante, asi que se dice en el acto y no despues.
    if (this.pendientes.has(id)) {
      throw new Error(`ya hay una llamada pendiente con el id «${id}»: no se reutilizan`)
    }
    return new Promise((resolver, rechazar) => {
      const plazo = setTimeout(() => {
        this.pendientes.delete(id)
        // No se elige entre las dos: desde el navegador son indistinguibles.
        rechazar(new Error(
          `sin respuesta en ${ms / 1000} s. Puede estar denegado por la lista blanca ` +
            `(rosbridge deniega en silencio) o el robot puede estar caido.`,
        ))
      }, ms)
      this.pendientes.set(id, { resolver, rechazar, plazo })
    })
  }

  resolver(id: string, valor: unknown): void {
    const p = this.pendientes.get(id)
    if (!p) return
    clearTimeout(p.plazo)
    this.pendientes.delete(id)
    p.resolver(valor)
  }

  /** Simetrico de `resolver`: para cuando rosbridge dice que el servicio FALLO. */
  rechazar(id: string, motivo: string): void {
    const p = this.pendientes.get(id)
    if (!p) return
    clearTimeout(p.plazo)
    this.pendientes.delete(id)
    p.rechazar(new Error(motivo))
  }

  cancelarTodas(motivo: string): void {
    for (const [id, p] of this.pendientes) {
      clearTimeout(p.plazo)
      p.rechazar(new Error(`llamada cancelada: ${motivo}`))
      this.pendientes.delete(id)
    }
  }
}
