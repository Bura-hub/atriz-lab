import { describe, expect, it, vi } from 'vitest'
import { opAdvertise, opPublish, opSubscribe, opCallService, RegistroPendientes } from './protocolo'

describe('construccion de ops', () => {
  it('subscribe lleva el tipo del contrato', () => {
    expect(opSubscribe('/odom')).toEqual({ op: 'subscribe', topic: '/odom', type: 'nav_msgs/msg/Odometry' })
  })

  it('advertise de la parada lleva su tipo', () => {
    expect(opAdvertise('/emergency_stop')).toEqual({
      op: 'advertise', topic: '/emergency_stop', type: 'std_msgs/msg/Empty',
    })
  })

  // La lista blanca se comprueba EN EL CLIENTE para no caer en el silencio.
  it('se niega a publicar en /cmd_vel, con un mensaje que lo explica', () => {
    expect(() => opPublish('/cmd_vel', {})).toThrowError(/lista blanca/)
  })

  it('se niega a suscribirse a algo fuera de la lista', () => {
    expect(() => opSubscribe('/ambient_light')).toThrowError(/lista blanca/)
  })

  it('call_service lleva id para poder emparejar la respuesta', () => {
    expect(opCallService('/start_scan', {}, 'abc')).toEqual({
      op: 'call_service', service: '/start_scan', args: {}, id: 'abc',
    })
  })
})

describe('llamadas pendientes', () => {
  it('resuelve cuando llega la respuesta', async () => {
    const r = new RegistroPendientes()
    const p = r.registrar('x', 5000)
    r.resolver('x', { values: true })
    await expect(p).resolves.toEqual({ values: true })
  })

  // Simetrico de la prueba anterior. Arreglo transversal: rosbridge manda
  // `result: false` cuando el servicio FALLA (call_service.py), y antes de
  // este metodo el cliente resolvia pase lo que pase, tirando el motivo real.
  it('rechazar() rechaza la promesa con el motivo, sin esperar al plazo', async () => {
    const r = new RegistroPendientes()
    const p = r.registrar('x', 5000)
    r.rechazar('x', 'el servicio fallo: el YDLIDAR no respondio')
    await expect(p).rejects.toThrow(/el YDLIDAR no respondio/)
  })

  // El mensaje NO debe elegir entre «denegado» y «robot caido»: no se pueden distinguir.
  it('al vencer el plazo dice las dos posibilidades y no elige', async () => {
    vi.useFakeTimers()
    const r = new RegistroPendientes()
    const p = r.registrar('y', 5000)
    // 🔴 DOS aserciones, no un regex combinado. Tres razones, y las tres se
    //    aprendieron rompiendolo:
    //    1. `/denegad[ao].*|.*ca[ií]d/` (la version original) es en realidad
    //       `(denegad[ao].*)|(.*ca[ií]d)`: PASA mencionando solo una.
    //    2. `/denegad[ao][\s\S]*ca[ií]d/` arregla eso pero exige un ORDEN:
    //       si el mensaje se reescribe como «puede estar caido, o denegado»,
    //       la prueba falla sin que nada este mal.
    //    3. Un regex combinado no dice CUAL de las dos falta cuando rompe.
    // Las dos se preparan ANTES de avanzar el reloj (estan enganchadas a la
    // misma promesa `p`, que solo se rechaza una vez) y se esperan por
    // separado despues: Promise.all sobre dos `.rejects` de la misma promesa
    // resulto fragil con temporizadores falsos en Vitest 4.1.10.
    const esperaDenegado = expect(p).rejects.toThrow(/denegad[ao]/)
    const esperaCaido = expect(p).rejects.toThrow(/ca[ií]d/)
    vi.advanceTimersByTime(5001)
    await esperaDenegado
    await esperaCaido
    vi.useRealTimers()
  })

  // Un id repetido pisaba la entrada anterior en silencio y dejaba huerfano
  // el temporizador de la primera: acababa rechazada con «sin respuesta»
  // aunque el robot SI hubiera contestado. Ahora se dice en el acto.
  it('un id repetido lanza en el acto, y la primera promesa sigue viva', async () => {
    const r = new RegistroPendientes()
    const p = r.registrar('dup', 5000)
    expect(() => r.registrar('dup', 5000)).toThrowError(/dup/)
    r.resolver('dup', { ok: true })
    await expect(p).resolves.toEqual({ ok: true })
  })

  it('cancelar todas rechaza las pendientes al caerse el enlace', async () => {
    const r = new RegistroPendientes()
    const p = r.registrar('z', 5000)
    r.cancelarTodas('se cerro el WebSocket')
    await expect(p).rejects.toThrowError(/WebSocket/)
  })
})
