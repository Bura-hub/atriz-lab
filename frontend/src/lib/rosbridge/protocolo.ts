import { permitidoLlamar, permitidoPublicar, permitidoSuscribir, tipoDe } from './contrato'

export interface OpSalida {
  op: string
  [clave: string]: unknown
}

/**
 * ⚠️ NO VERIFICADO: que campos de QoS acepta rosbridge 2.7.0 en `advertise` y
 * `subscribe`. Su fuente no esta en ningun repositorio del proyecto, asi que
 * todo lo que creemos saber de su protocolo es de SEGUNDA MANO.
 * Hasta medirlo (herramientas/medir_qos_rosbridge.mjs) NO se manda campo `qos`:
 * rosbridge se suscribe con qos_profile_sensor_data (BEST_EFFORT), que empareja
 * con publicadores BEST_EFFORT y RELIABLE por igual.
 */

const exigir = (permitido: boolean, que: string, donde: string) => {
  if (!permitido) {
    throw new Error(
      `«${que}» no esta en la lista blanca de ${donde} del robot (robot.launch.py). ` +
        `Si de verdad hace falta, se amplia EN EL ROBOT, no aqui.`,
    )
  }
}

export function opSubscribe(topic: string): OpSalida {
  exigir(permitidoSuscribir(topic), topic, 'lectura')
  return { op: 'subscribe', topic, type: tipoDe(topic)! }
}

// `unsubscribe` no crea estado ni espera respuesta: no hay «denegado vs caido»
// que resolver, asi que no valida contra la lista blanca como las demas.
export const opUnsubscribe = (topic: string): OpSalida => ({ op: 'unsubscribe', topic })

export function opAdvertise(topic: string): OpSalida {
  exigir(permitidoPublicar(topic), topic, 'escritura')
  return { op: 'advertise', topic, type: tipoDe(topic)! }
}

export function opPublish(topic: string, msg: unknown): OpSalida {
  exigir(permitidoPublicar(topic), topic, 'escritura')
  return { op: 'publish', topic, msg }
}

export function opCallService(service: string, args: unknown, id: string): OpSalida {
  exigir(permitidoLlamar(service), service, 'servicios')
  return { op: 'call_service', service, args, id }
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

  cancelarTodas(motivo: string): void {
    for (const [id, p] of this.pendientes) {
      clearTimeout(p.plazo)
      p.rechazar(new Error(`llamada cancelada: ${motivo}`))
      this.pendientes.delete(id)
    }
  }
}
