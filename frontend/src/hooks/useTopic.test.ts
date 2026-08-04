import { beforeEach, describe, expect, it } from 'vitest'
import { exigirTopicPermitido, suscribirTopic } from './useTopic'
import { montarTransporte } from './useTransporte'
import { Transporte } from '../lib/rosbridge/transporte'
import { TOPICS_LECTURA } from '../lib/rosbridge/contrato'
import { WSFalso, fabricaFalsa } from '../pruebas/dobles'

const nada = { alCerrarse: () => {}, alAviso: () => {} }

beforeEach(() => {
  WSFalso.reiniciar()
})

describe('exigirTopicPermitido — la lista blanca', () => {
  it('🔴 rechaza un topic fuera de la lista blanca NOMBRANDOLO', () => {
    // rosbridge deniega EN SILENCIO -no manda `status` por el socket-, asi que
    // si esto no lanza aqui, el sintoma es «ese topic no llega» y se busca en el
    // robot. El nombre del topic tiene que estar en el mensaje.
    expect(() => exigirTopicPermitido('/ambient_light')).toThrowError(/ambient_light/)
    expect(() => exigirTopicPermitido('/ambient_light')).toThrowError(/lista blanca/)
  })

  it('rechaza tambien un topic de ESCRITURA: escribir no es leer', () => {
    // `/cmd_vel_raw` esta permitido para publicar, no para suscribirse.
    expect(() => exigirTopicPermitido('/cmd_vel_raw')).toThrowError(/cmd_vel_raw/)
  })

  it('rechaza `/cmd_vel`, que no esta en ninguna de las dos listas', () => {
    // Es la SALIDA del collision_monitor: publicar ahi funciona y salta la
    // seguridad. Que no aparezca ni por descuido.
    expect(() => exigirTopicPermitido('/cmd_vel')).toThrowError(/cmd_vel/)
  })

  it('deja pasar los doce topics de lectura del contrato', () => {
    for (const topic of TOPICS_LECTURA) {
      expect(() => exigirTopicPermitido(topic)).not.toThrow()
    }
  })
})

describe('suscribirTopic — el efecto que se suscribe', () => {
  it('manda el subscribe con su tipo y entrega los mensajes', () => {
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    const limpiar = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()

    const recibidos: unknown[] = []
    const baja = suscribirTopic(t, '/motor_status', (m) => recibidos.push(m))

    const sub = WSFalso.ultimo.ops().find((o) => o.op === 'subscribe')
    expect(sub?.topic).toBe('/motor_status')
    // 🔴 Sin `type` la clave desaparece al serializar y rosbridge recibe un
    //    subscribe mudo: el sintoma vuelve a ser «ese topic no llega».
    expect(sub?.type).toBe('atriz_rvr_msgs/msg/MotorStatus')

    WSFalso.ultimo.recibir({ op: 'publish', topic: '/motor_status', msg: { fallo: true } })
    expect(recibidos).toEqual([{ fallo: true }])

    baja()
    limpiar()
  })

  it('🔴 la limpieza da de baja DE VERDAD: manda unsubscribe al robot', () => {
    // Olvidarlo no es una fuga de memoria: es `/scan` -el 83 % del trafico de un
    // robot- llegando para siempre, y volviendo a pedirse en cada reconexion.
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    const limpiar = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()

    const recibidos: unknown[] = []
    const baja = suscribirTopic(t, '/odom', (m) => recibidos.push(m))
    baja()

    expect(WSFalso.ultimo.ops().some((o) => o.op === 'unsubscribe' && o.topic === '/odom')).toBe(true)

    // Y ya no llega nada a quien se dio de baja.
    WSFalso.ultimo.recibir({ op: 'publish', topic: '/odom', msg: { x: 1 } })
    expect(recibidos).toEqual([])
    limpiar()
  })

  it('dos oyentes del mismo topic comparten UNA sola suscripcion en el cable', () => {
    // Es lo que permite que `useSalud` vigile /odom sin pagarlo dos veces
    // cuando la vista ya lo esta pintando con useTopic.
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    const limpiar = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()

    const bajaA = suscribirTopic(t, '/odom', () => {})
    const bajaB = suscribirTopic(t, '/odom', () => {})
    expect(WSFalso.ultimo.ops().filter((o) => o.op === 'subscribe' && o.topic === '/odom')).toHaveLength(1)

    // Y dar de baja a uno NO corta el topic para el otro.
    bajaA()
    expect(WSFalso.ultimo.ops().some((o) => o.op === 'unsubscribe')).toBe(false)
    bajaB()
    expect(WSFalso.ultimo.ops().some((o) => o.op === 'unsubscribe' && o.topic === '/odom')).toBe(true)
    limpiar()
  })
})
