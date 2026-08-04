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

  // El mensaje NO debe elegir entre «denegado» y «robot caido»: no se pueden distinguir.
  it('al vencer el plazo dice las dos posibilidades y no elige', async () => {
    vi.useFakeTimers()
    const r = new RegistroPendientes()
    const p = r.registrar('y', 5000)
    // 🔴 Exige LAS DOS posibilidades en el mismo mensaje. Un regex con
    //    alternancia sin agrupar —`/denegad[ao].*|.*ca[ií]d/`— es en realidad
    //    `(denegad[ao].*)|(.*ca[ií]d)` y PASA mencionando solo una: la
    //    salvaguarda seria mas debil de lo que aparenta.
    const capturado = expect(p).rejects.toThrowError(/denegad[ao][\s\S]*ca[ií]d/)
    vi.advanceTimersByTime(5001)
    await capturado
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
