import { beforeEach, describe, expect, it } from 'vitest'
import { montarTransporte } from './useTransporte'
import { suscribirTopic } from './useTopic'
import { Transporte } from '../lib/rosbridge/transporte'
import { WSFalso, dejarPasarMicrotareas, fabricaFalsa } from '../pruebas/dobles'

const nada = { alCerrarse: () => {}, alAviso: () => {} }

beforeEach(() => {
  WSFalso.reiniciar()
})

describe('montarTransporte — el efecto que posee la conexion', () => {
  it('conecta al montar y CIERRA al desmontar', async () => {
    const t = new Transporte('ws://x:9090', fabricaFalsa)

    const limpiar = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()
    expect(t.conectado).toBe(true)
    expect(WSFalso.abiertos).toHaveLength(1)

    limpiar()
    await dejarPasarMicrotareas()
    // Un Transporte que sobrevive al desmontaje sigue suscrito y sigue
    // reconectandose solo, para siempre, sin nadie mirando.
    expect(t.conectado).toBe(false)
    expect(WSFalso.abiertos).toHaveLength(0)
  })

  it('🔴 NO reconecta desde el oyente de alCerrarse: solo observa', () => {
    // Medido en este proyecto: reconectar de forma sincrona desde ahi crea
    // CUATRO sockets. El hook se limita a apuntar el hecho.
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    let caidas = 0
    const limpiar = montarTransporte(t, { alCerrarse: () => { caidas++ }, alAviso: () => {} })
    WSFalso.ultimo.abrir()

    const creadosAntes = WSFalso.creados.length
    WSFalso.ultimo.onclose?.()

    expect(caidas).toBe(1)
    expect(WSFalso.creados).toHaveLength(creadosAntes)   // ni un socket mas
    limpiar()
  })

  it('el oyente SI ve una caida espontanea mientras esta montado', () => {
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    let caidas = 0
    const limpiar = montarTransporte(t, { alCerrarse: () => { caidas++ }, alAviso: () => {} })
    WSFalso.ultimo.abrir()

    WSFalso.ultimo.onclose?.()   // se cae el WiFi, nadie pidio nada
    expect(caidas).toBe(1)
    limpiar()
  })

  it('la limpieza suelta los oyentes ANTES de cerrar, y despues no llega nada mas', async () => {
    // El orden importa: el componente que se esta desmontando no tiene por que
    // enterarse de su propio cierre deliberado -y avisarle seria un `setState`
    // sobre algo que ya no existe. Lo que si tiene que cumplirse es que a partir
    // de la limpieza NO llegue ni una caida ni un aviso mas.
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    let caidas = 0
    const avisos: unknown[] = []
    const limpiar = montarTransporte(t, {
      alCerrarse: () => { caidas++ },
      alAviso: (a) => avisos.push(a),
    })
    WSFalso.ultimo.abrir()
    const socket = WSFalso.ultimo

    limpiar()
    expect(caidas).toBe(0)   // el cierre deliberado no se le notifica a si mismo
    await dejarPasarMicrotareas()

    // Y el transporte podria seguir viviendo (otro montaje, un `conectar()`
    // suelto): nada de eso puede llegar ya a los oyentes de este montaje.
    socket.onclose?.()
    t.conectar()
    WSFalso.ultimo.abrir()
    WSFalso.ultimo.onmessage?.({ data: '{ esto no es json' })   // dispararia alAviso
    WSFalso.ultimo.onclose?.()

    expect(caidas).toBe(0)
    expect(avisos).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// StrictMode de React 19: en desarrollo monta, desmonta y vuelve a montar.
// ═══════════════════════════════════════════════════════════════════════════
describe('montarTransporte — el doble montaje de StrictMode', () => {
  it('🔴 montar, desmontar y volver a montar deja UN socket abierto y UNA suscripcion', async () => {
    const t = new Transporte('ws://x:9090', fabricaFalsa)

    // Montaje 1
    const limpiar1 = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()
    const baja1 = suscribirTopic(t, '/motor_status', () => {})

    // Desmontaje inmediato (lo que hace StrictMode)
    baja1()
    limpiar1()
    await dejarPasarMicrotareas()

    // Montaje 2
    const limpiar2 = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()
    const recibidos: unknown[] = []
    const baja2 = suscribirTopic(t, '/motor_status', (m) => recibidos.push(m))
    await dejarPasarMicrotareas()

    expect(WSFalso.abiertos).toHaveLength(1)
    expect(t.conectado).toBe(true)

    const socket = WSFalso.ultimo
    const subs = socket.ops().filter((o) => o.op === 'subscribe' && o.topic === '/motor_status')
    expect(subs).toHaveLength(1)

    // Y un mensaje se entrega UNA sola vez: con dos sockets vivos se entregaria
    // dos veces, que es el sintoma real de la fuga.
    socket.recibir({ op: 'publish', topic: '/motor_status', msg: { fallo: false } })
    expect(recibidos).toHaveLength(1)

    baja2()
    limpiar2()
  })

  it('el remontaje vuelve a pedir al robot los topics que seguian teniendo oyentes', async () => {
    // La suscripcion sobrevive al ciclo (no se dio de baja): al reconectar, el
    // Transporte tiene que volver a pedirla, o el topic no llega nunca mas.
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    const limpiar1 = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()
    const recibidos: unknown[] = []
    const baja = suscribirTopic(t, '/battery_state', (m) => recibidos.push(m))

    limpiar1()
    await dejarPasarMicrotareas()

    const limpiar2 = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()
    const socket = WSFalso.ultimo
    expect(socket.ops().some((o) => o.op === 'subscribe' && o.topic === '/battery_state')).toBe(true)

    socket.recibir({ op: 'publish', topic: '/battery_state', msg: { voltage: 8.29 } })
    expect(recibidos).toEqual([{ voltage: 8.29 }])

    baja()
    limpiar2()
  })
})
