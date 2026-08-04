import { describe, expect, it, vi } from 'vitest'
import { opAdvertise, opPublish, opSubscribe, opCallService, RegistroPendientes } from './protocolo'
import { TIPOS, TOPICS_LECTURA, TOPICS_ESCRITURA, tipoDe } from './contrato'

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

  // Punto 7 del encargo: opCallService manda el timeout en SEGUNDOS -lo que
  // rosbridge espera en el propio op (call_service.py)-, no solo el id.
  it('call_service lleva id y timeout (en segundos) para poder emparejar la respuesta y avisar a rosbridge', () => {
    expect(opCallService('/start_scan', {}, 'abc', 5)).toEqual({
      op: 'call_service', service: '/start_scan', args: {}, id: 'abc', timeout: 5,
    })
  })
})

// Punto 3 del encargo: el `tipoDe(topic)!` tapaba un `undefined` con un `!`.
// Si TOPICS_LECTURA/TOPICS_ESCRITURA y TIPOS se desincronizan (el mismo bug
// real que costo `Encoders` vs `Encoder`), opSubscribe/opAdvertise deben
// LANZAR nombrando el topic, no mandar un subscribe/advertise mudo.
describe('opSubscribe / opAdvertise — el tipo es obligatorio', () => {
  it('lanza si un topic de la lista blanca no tiene entrada en TIPOS (contrato.ts desincronizado)', () => {
    // Se desincroniza TIPOS a proposito, sobre el objeto real -no un doble-,
    // para probar la ruta exacta que falla en produccion. Restaurado en el
    // finally: es el unico test que toca este estado compartido.
    // '/odom' es de LECTURA y '/emergency_stop' de ESCRITURA: cada uno tiene
    // que pasar su propia comprobacion de lista blanca antes de llegar al
    // tipo, para que el fallo que se observe sea el del TIPO y no el de la
    // lista blanca.
    const tipos = TIPOS as Record<string, string | undefined>
    const odomOriginal = tipos['/odom']
    const paradaOriginal = tipos['/emergency_stop']
    delete tipos['/odom']
    delete tipos['/emergency_stop']
    try {
      expect(() => opSubscribe('/odom')).toThrowError(/«\/odom».*TIPOS/)
      expect(() => opAdvertise('/emergency_stop')).toThrowError(/«\/emergency_stop».*TIPOS/)
    } finally {
      tipos['/odom'] = odomOriginal
      tipos['/emergency_stop'] = paradaOriginal
    }
  })

  // Cobertura de la familia entera: todo topic de lectura o escritura tiene
  // que tener tipo, SIEMPRE -no solo el caso puntual de arriba-. Tres lineas,
  // y cierra la puerta para cualquier topic futuro, no solo /odom.
  it('todos los topics de TOPICS_LECTURA y TOPICS_ESCRITURA tienen tipo', () => {
    for (const t of [...TOPICS_LECTURA, ...TOPICS_ESCRITURA]) expect(tipoDe(t)).toBeDefined()
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
