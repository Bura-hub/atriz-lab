import { describe, expect, it } from 'vitest'
import { ESTADO_NAV, type MensajeEstadoNavegacion } from '../../hooks/useTopic'
import {
  UMBRAL_LATIDO_NAV_MS, decidirBoton, frase, leer, tono,
  type Pintado, type Sistema,
} from './navegacion'

function msg(p: Partial<MensajeEstadoNavegacion> = {}): MensajeEstadoNavegacion {
  return {
    header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
    latido: 10,
    slam: ESTADO_NAV.APAGADO,
    nav: ESTADO_NAV.APAGADO,
    slam_detalle: '',
    nav_detalle: '',
    slam_arrancando_s: -1,
    nav_arrancando_s: -1,
    hay_mapa: true,
    slam_latcheado: false,
    nav_latcheado: false,
    ...p,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 El latido manda sobre todo lo demas
// ═══════════════════════════════════════════════════════════════════════════
describe('el latido', () => {
  it('🔴 un mensaje que dice FUNCIONANDO con el latido parado se pinta NO_SE_SABE', () => {
    // Es el caso real: `/estado_navegacion` va TRANSIENT_LOCAL, asi que el
    // enlatado sobrevive al supervisor. Sin esto la pantalla pintaria verde
    // sobre un robot sin nadie detras.
    const m = msg({ slam: ESTADO_NAV.FUNCIONANDO })
    expect(leer(m, 'slam', true).pintado).toBe('FUNCIONANDO')
    expect(leer(m, 'slam', false).pintado).toBe('NO_SE_SABE')
  })

  it('sin mensaje tampoco se afirma nada, aunque el latido avanzara', () => {
    expect(leer(null, 'slam', true).pintado).toBe('NO_SE_SABE')
  })

  it('🔴 NO_SE_SABE no ofrece arrancar: seria a ciegas', () => {
    const b = decidirBoton(leer(null, 'nav', true), 'nav')
    expect(b.accion).toBeNull()
    expect(b.habilitado).toBe(false)
    expect(b.motivo).toContain('no se sabe')
  })

  it('🔴 el umbral es de 5 mensajes a 1 Hz, y NO son los 3000 ms de /odom', () => {
    /*
     * Este proyecto midio lo que pasa al mudar una cifra de sitio: 3000 ms
     * contra /odom (16,5 Hz) son 50 mensajes perdidos; los mismos 3000 ms
     * contra un topic de 1 Hz son TRES, y pintarian «no se sabe» al primer
     * hipo de WiFi. Si alguien unifica las dos constantes, esto falla.
     */
    expect(UMBRAL_LATIDO_NAV_MS).toBe(5000)
    expect(UMBRAL_LATIDO_NAV_MS).not.toBe(3000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Los seis estados, uno por uno — y el barrido completo
// ═══════════════════════════════════════════════════════════════════════════
describe('los seis estados', () => {
  const CRUDO_A_PINTADO: Array<[number, Pintado]> = [
    [ESTADO_NAV.APAGADO, 'APAGADO'],
    [ESTADO_NAV.ARRANCANDO, 'ARRANCANDO'],
    [ESTADO_NAV.FUNCIONANDO, 'FUNCIONANDO'],
    [ESTADO_NAV.CIEGO, 'CIEGO'],
    [ESTADO_NAV.MUDO, 'MUDO'],
    [ESTADO_NAV.FALLO, 'FALLO'],
    [ESTADO_NAV.DESCONOCIDO, 'NO_SE_SABE'],
  ]

  it.each(CRUDO_A_PINTADO)('el crudo %i se pinta %s', (crudo, esperado) => {
    expect(leer(msg({ slam: crudo }), 'slam', true).pintado).toBe(esperado)
  })

  it('🔴 un valor que no reconocemos NO cae en APAGADO', () => {
    /*
     * Si el robot añade un septimo estado y esta web es vieja, un `default` que
     * cayera en APAGADO convertiria «no lo se» en una afirmacion —y ofreceria
     * un boton de arrancar sobre algo que quiza esta corriendo—. Se barre el
     * rango entero, no tres puntos representativos: la banda intermedia es
     * justo donde vivio el bug del seguidor de linea de este proyecto.
     */
    for (let crudo = 7; crudo <= 40; crudo++) {
      expect(leer(msg({ slam: crudo }), 'slam', true).pintado).toBe('NO_SE_SABE')
    }
  })

  it('slam y nav se leen por separado y no se contaminan', () => {
    const m = msg({ slam: ESTADO_NAV.FUNCIONANDO, nav: ESTADO_NAV.FALLO })
    expect(leer(m, 'slam', true).pintado).toBe('FUNCIONANDO')
    expect(leer(m, 'nav', true).pintado).toBe('FALLO')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 BLOQUEADO gana a FALLO
// ═══════════════════════════════════════════════════════════════════════════
describe('latcheado', () => {
  it('🔴 gana a FALLO, y el motivo dice que hay que entrar al robot', () => {
    const l = leer(msg({ nav: ESTADO_NAV.FALLO, nav_latcheado: true }), 'nav', true)
    expect(l.pintado).toBe('BLOQUEADO')
    const b = decidirBoton(l, 'nav')
    expect(b.habilitado).toBe(false)
    expect(b.motivo).toContain('reset-failed')
    // 🔴 Y NO ofrece la accion: volver a pulsar no haria nada.
    expect(b.accion).toBeNull()
  })

  it('🔴 gana tambien a FUNCIONANDO', () => {
    // Si systemd tiene la unidad latcheada, lo que diga el estado es
    // sospechoso: se prefiere la lectura que manda a mirar el robot.
    const l = leer(msg({ slam: ESTADO_NAV.FUNCIONANDO, slam_latcheado: true }), 'slam', true)
    expect(l.pintado).toBe('BLOQUEADO')
  })

  it('el latcheado de uno no bloquea al otro', () => {
    const m = msg({ slam: ESTADO_NAV.FUNCIONANDO, nav_latcheado: true })
    expect(leer(m, 'slam', true).pintado).toBe('FUNCIONANDO')
    expect(leer(m, 'nav', true).pintado).toBe('BLOQUEADO')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El boton
// ═══════════════════════════════════════════════════════════════════════════
describe('decidirBoton', () => {
  it('apagado y con mapa: se puede arrancar', () => {
    const b = decidirBoton(leer(msg(), 'nav', true), 'nav')
    expect(b).toEqual({ accion: 'ARRANCAR', habilitado: true, motivo: '' })
  })

  it('🔴 Nav2 sin mapa: el boton se ve, se deshabilita, y DICE POR QUE', () => {
    const b = decidirBoton(leer(msg({ hay_mapa: false }), 'nav', true), 'nav')
    expect(b.habilitado).toBe(false)
    expect(b.motivo).toContain('mapa')
    // Un control gris y mudo se lee como un fallo de la web.
    expect(b.motivo.length).toBeGreaterThan(30)
  })

  it('🔴 SLAM SIN mapa si se puede arrancar: es lo que lo crea', () => {
    // Copiar la condicion de Nav2 a SLAM dejaria al usuario sin forma de
    // salir nunca del estado inicial: sin mapa no hay Nav2, y sin SLAM no hay
    // mapa. Es una dependencia circular a un clic de distancia.
    const b = decidirBoton(leer(msg({ hay_mapa: false }), 'slam', true), 'slam')
    expect(b.habilitado).toBe(true)
    expect(b.accion).toBe('ARRANCAR')
  })

  it('arrancando: deshabilitado y sin prometer cuanto falta', () => {
    const l = leer(msg({ nav: ESTADO_NAV.ARRANCANDO, nav_arrancando_s: 12.5 }), 'nav', true)
    const b = decidirBoton(l, 'nav')
    expect(b.habilitado).toBe(false)
    expect(l.arrancandoS).toBe(12.5)
    // 24,3 s es una medida en reposo con n=2. No se promete un plazo.
    expect(b.motivo).not.toMatch(/\d+\s*s|segundos|falta|%/)
  })

  it('🔴 CIEGO y MUDO ofrecen PARAR, no arrancar otra vez', () => {
    // Que este roto no significa que no ocupe el puerto, la CPU y el arbol TF.
    // Un slam_toolbox MUDO sigue publicando map->odom y parte el arbol si
    // alguien levanta AMCL: es justo el que hay que poder parar.
    for (const crudo of [ESTADO_NAV.CIEGO, ESTADO_NAV.MUDO, ESTADO_NAV.FUNCIONANDO]) {
      const b = decidirBoton(leer(msg({ slam: crudo }), 'slam', true), 'slam')
      expect(b.accion).toBe('PARAR')
      expect(b.habilitado).toBe(true)
    }
  })

  it('el detalle del robot se pasa TAL CUAL, sin reescribir', () => {
    const l = leer(msg({ slam: ESTADO_NAV.FALLO, slam_detalle: 'slam_toolbox está corriendo' }), 'slam', true)
    expect(l.detalle).toBe('slam_toolbox está corriendo')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// -1.0 es «no aplica», nunca cero
// ═══════════════════════════════════════════════════════════════════════════
describe('arrancandoS', () => {
  it('🔴 -1.0 es null, no 0 — «no se sabe» no es «acaba de empezar»', () => {
    expect(leer(msg({ slam_arrancando_s: -1 }), 'slam', true).arrancandoS).toBeNull()
    expect(leer(msg({ slam_arrancando_s: 0 }), 'slam', true).arrancandoS).toBe(0)
  })

  it('cualquier negativo se trata igual', () => {
    expect(leer(msg({ nav_arrancando_s: -0.5 }), 'nav', true).arrancandoS).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Las frases y el tono
// ═══════════════════════════════════════════════════════════════════════════
describe('frase y tono', () => {
  const TODOS: Pintado[] = [
    'NO_SE_SABE', 'APAGADO', 'ARRANCANDO', 'FUNCIONANDO',
    'CIEGO', 'MUDO', 'FALLO', 'BLOQUEADO',
  ]

  it('los ocho tienen frase, y ninguna esta vacia', () => {
    for (const p of TODOS) {
      for (const s of ['slam', 'nav'] as Sistema[]) {
        const t = frase({ pintado: p, detalle: '', arrancandoS: null, hayMapa: true }, s)
        expect(t.length, `«${p}» sin frase`).toBeGreaterThan(3)
      }
    }
  })

  it('🔴 CIEGO y MUDO describen el SINTOMA que se ve en el robot', () => {
    const base = { detalle: '', arrancandoS: null, hayMapa: true }
    // Es lo que hace que la persona relacione la pantalla con lo que tiene
    // delante: «el robot no conduce» es lo que va a observar.
    expect(frase({ ...base, pintado: 'CIEGO' }, 'slam')).toContain('no conducirá')
    expect(frase({ ...base, pintado: 'MUDO' }, 'slam')).toContain('no crecerá')
  })

  it('🔴 CIEGO y MUDO son MAL, no AVISO', () => {
    // Con SLAM ciego el robot no conduce (0,0 cm contra 9,9). Pintarlo de
    // ambar dejaria al alumno esperando a que se arregle solo.
    expect(tono('CIEGO')).toBe('MAL')
    expect(tono('MUDO')).toBe('MAL')
    expect(tono('BLOQUEADO')).toBe('MAL')
  })

  it('APAGADO es NEUTRO: no es un problema, es el estado de reposo', () => {
    expect(tono('APAGADO')).toBe('NEUTRO')
    expect(tono('NO_SE_SABE')).toBe('NEUTRO')
  })

  it('arrancando enseña los segundos cuando los hay', () => {
    const base = { pintado: 'ARRANCANDO' as const, detalle: '', hayMapa: true }
    expect(frase({ ...base, arrancandoS: 24.3 }, 'nav')).toBe('arrancando · 24 s')
    expect(frase({ ...base, arrancandoS: null }, 'nav')).toBe('arrancando')
  })

  it('🔴 ninguna frase afirma un efecto fisico', () => {
    for (const p of TODOS) {
      const t = frase({ pintado: p, detalle: '', arrancandoS: null, hayMapa: true }, 'slam')
      expect(t.toLowerCase()).not.toContain('confirmad')
      expect(t.toLowerCase()).not.toContain('listo')
    }
  })
})
