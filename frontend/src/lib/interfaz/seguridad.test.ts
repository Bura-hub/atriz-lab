import { describe, expect, it } from 'vitest'
import { ACCION_MONITOR, MensajeEstadoMonitor } from '../../hooks/useTopic'
import {
  MOTIVO_FUENTE_INVALIDA, RADIO_APROXIMACION_M, RADIO_CIRCUNSCRITO_M,
  interpretarSeguridad, seMueve,
} from './seguridad'

const msg = (action_type: number, polygon_name: string): MensajeEstadoMonitor =>
  ({ action_type, polygon_name })

describe('interpretarSeguridad — el silencio NO es «todo bien»', () => {
  it('sin mensaje da DESCONOCIDO, no SIN_RESTRICCION', () => {
    const s = interpretarSeguridad(null)
    expect(s.efecto).toBe('DESCONOCIDO')
    expect(s.efecto).not.toBe('SIN_RESTRICCION')
  })

  it('🔴 y lo dice explicitamente, porque el monitor solo habla cuando el robot recibe ordenes', () => {
    // Medido (evidencia 72): 0 mensajes en 12 s con el robot en reposo. Si esta
    // frase desaparece, la interfaz puede acabar leyendo el silencio como salud.
    const s = interpretarSeguridad(null)
    expect(s.explicacion).toContain('NO significa que todo este bien')
  })
})

describe('interpretarSeguridad — el caso medido: el barrido apagado', () => {
  // Es EL caso: `{action_type: 1, polygon_name: 'invalid source'}` con /scan a
  // 0.00 Hz, que es el reposo normal de los 16 robots.
  const sinBarrido = interpretarSeguridad(msg(ACCION_MONITOR.PARAR, MOTIVO_FUENTE_INVALIDA))

  it('lo reconoce y lo marca como falta de barrido, no como obstaculo', () => {
    expect(sinBarrido.efecto).toBe('BLOQUEA')
    expect(sinBarrido.faltaBarrido).toBe(true)
  })

  it('🔴 dice que el robot NO esta averiado', () => {
    // La razon de existir de este modulo: «no se mueve y no hay error» es el
    // sintoma mas confuso del laboratorio.
    expect(sinBarrido.explicacion).toContain('no esta averiado')
  })

  it('y dice QUE HACER, que es lo unico que saca al alumno del atasco', () => {
    expect(sinBarrido.queHacer).toContain('barrido')
  })
})

describe('interpretarSeguridad — un obstaculo de verdad', () => {
  const conObstaculo = interpretarSeguridad(msg(ACCION_MONITOR.PARAR, 'Emergencia'))

  it('bloquea, pero NO lo confunde con la falta de barrido', () => {
    expect(conObstaculo.efecto).toBe('BLOQUEA')
    expect(conObstaculo.faltaBarrido).toBe(false)
  })

  it('nombra el poligono que se disparo', () => {
    expect(conObstaculo.explicacion).toContain('Emergencia')
  })
})

describe('interpretarSeguridad — ralentizar', () => {
  /*
   * ⚠️ ANTES ESTE BUCLE LLEVABA TRES CÓDIGOS. `APROXIMACION` se ha sacado, y no
   * es una reorganización: la prueba afirmaba que se presenta «como va mas
   * despacio, no como averia» sobre un estado en el que el robot está PARADO y
   * no puede salir. Su sustituta está en el bloque de abajo.
   */
  for (const [nombre, valor] of [
    ['RALENTIZAR', ACCION_MONITOR.RALENTIZAR],
    ['LIMITAR', ACCION_MONITOR.LIMITAR],
  ] as const) {
    it(`${nombre} se presenta como «va mas despacio», no como averia`, () => {
      const s = interpretarSeguridad(msg(valor, 'Precaucion'))
      expect(s.efecto).toBe('RALENTIZA')
      expect(s.explicacion).toContain('No esta averiado')
    })
  }

  it('🔴 avisa de que tambien frena al ALEJARSE', () => {
    // Medido: un retroceso comandado de 30 cm recorrio 14, porque el poligono es
    // estatico y no sabe hacia donde va el robot. Sin este aviso, la web da a
    // entender que el robot no obedece.
    const s = interpretarSeguridad(msg(ACCION_MONITOR.RALENTIZAR, 'Precaucion'))
    expect(s.queHacer).toContain('alejandote')
  })

  it('🔴 y NINGUNO de los dos promete que se pueda desbloquear desde la web', () => {
    // `sinSalidaDesdeLaWeb` es de APROXIMACION y solo de ahi: si se pegara a
    // RALENTIZAR, la pantalla dejaria de ofrecer el unico remedio que si vale
    // en ese caso, que es seguir conduciendo mas despacio.
    for (const a of [ACCION_MONITOR.RALENTIZAR, ACCION_MONITOR.LIMITAR]) {
      expect(interpretarSeguridad(msg(a, 'Precaucion')).sinSalidaDesdeLaWeb).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 APROXIMACION — LO QUE MIDIO EL ROBOT EL 2026-08-09
//
// Evidencias 93, 94 y 95. Con la pared DETRAS a 16,8 cm y 188 cm libres
// delante, mandando por /cmd_vel_raw:
//
//     AVANZAR alejandose -> 0,0 cm    GIRAR -> 0,0°    RETROCEDER -> 0,0 cm
//
// 24 de 24 estaciones todo-o-nada, y el umbral es el mismo en las cuatro
// direcciones. Este bloque existe para que la pantalla no pueda volver a
// llamarlo «va mas despacio».
// ═══════════════════════════════════════════════════════════════════════════
describe('APROXIMACION no es RALENTIZAR', () => {
  const aprox = msg(ACCION_MONITOR.APROXIMACION, 'Aproximacion')

  it('🔴 sin saber si se mueve, avisa de que PUEDE quedarse inmovil', () => {
    const s = interpretarSeguridad(aprox)
    expect(s.efecto).toBe('PUEDE_INMOVILIZAR')
    expect(s.efecto).not.toBe('RALENTIZA')
  })

  it('🔴 con el robot MANDADO y QUIETO, lo afirma: esta inmovilizado', () => {
    const s = interpretarSeguridad(aprox, { mandando: true, moviendose: false })
    expect(s.efecto).toBe('INMOVILIZA')
    expect(s.explicacion).toMatch(/no puede salir solo/i)
  })

  it('si SI se mueve, no se afirma que este congelado', () => {
    // `approach` cubre desde «un poco mas lento» hasta cero, y el action_type es
    // el mismo: sin ver el efecto no se puede elegir, y aqui el efecto dice que
    // no.
    const s = interpretarSeguridad(aprox, { mandando: true, moviendose: true })
    expect(s.efecto).toBe('PUEDE_INMOVILIZAR')
  })

  it('sin mandar nada tampoco se afirma: quieto porque nadie le pidio moverse', () => {
    const s = interpretarSeguridad(aprox, { mandando: false, moviendose: false })
    expect(s.efecto).toBe('PUEDE_INMOVILIZAR')
  })

  it('🔴 en LOS DOS casos dice que la web no puede sacarlo', () => {
    for (const m of [undefined, { mandando: true, moviendose: false }] as const) {
      const s = interpretarSeguridad(aprox, m)
      expect(s.sinSalidaDesdeLaWeb).toBe(true)
      expect(s.queHacer).toMatch(/con la mano/i)
    }
  })

  it('🔴🔴 NUNCA sugiere marcha atras: esta medido que da 0,0 cm igual', () => {
    /*
     * Es el consejo que daba antes («si vas marcha atras alejandote, tambien
     * frena»), heredado del texto de `Precaucion`. Aplicado a APROXIMACION
     * manda a probar algo que no puede funcionar, sobre alguien que ya cree que
     * el robot no le hace caso.
     */
    const s = interpretarSeguridad(aprox, { mandando: true, moviendose: false })
    expect(`${s.explicacion} ${s.queHacer}`).not.toMatch(/prueba a alejarte|vete hacia atr/i)
    // Y lo dice explicitamente, que es mas fuerte que callarlo:
    expect(s.queHacer).toMatch(/marcha atras esta medido/i)
  })

  it('dice el giro tambien, porque el mando se escala ENTERO', () => {
    // Lo mas contraintuitivo: girar en el sitio no acerca a nada y aun asi da
    // 0,0°. Sin decirlo, el alumno prueba a girar como escape natural.
    const s = interpretarSeguridad(aprox, { mandando: true, moviendose: false })
    expect(s.explicacion).toMatch(/girar/i)
  })

  it('cita 15 cm, que es el radio VIGENTE desde el 2026-08-09', () => {
    // Era 0.18. Un texto que siga diciendo 18 estaria describiendo un robot al
    // que no le llego el fichero nuevo.
    const s = interpretarSeguridad(aprox, { mandando: true, moviendose: false })
    expect(s.explicacion).toContain('15 cm')
    expect(s.explicacion).not.toContain('18 cm')
  })
})

describe('los radios, y su relacion', () => {
  it('🔴 el radio del monitor NO puede bajar del circunscrito', () => {
    /*
     * Por debajo de 0,1442 el monitor autorizaria giros que la esquina del
     * chasis no puede hacer. Por encima, cada centimetro es banda de
     * inmovilizacion. Son la misma cantidad, y por eso van juntos aqui.
     */
    expect(RADIO_APROXIMACION_M).toBeGreaterThan(RADIO_CIRCUNSCRITO_M)
  })

  it('la banda de inmovilizacion que queda son 0,6 cm', () => {
    expect((RADIO_APROXIMACION_M - RADIO_CIRCUNSCRITO_M) * 100).toBeCloseTo(0.6, 1)
  })

  it('🔴 y NO es 0.18: ese valor significa un robot desactualizado', () => {
    // `verificar_robot.sh` da FALLO —no aviso— si lo encuentra en un robot.
    expect(RADIO_APROXIMACION_M).toBe(0.15)
  })
})

describe('seMueve — el umbral es la resolucion de la pantalla', () => {
  it('cero exacto es «no se mueve»', () => {
    expect(seMueve(0, 0)).toBe(false)
  })

  it('lo que la pantalla pinta como 0,000 cuenta como quieto', () => {
    // Se muestran tres decimales: por debajo de medio milesimo se ve un cero.
    expect(seMueve(0.0004, 0)).toBe(false)
    expect(seMueve(0, -0.0004)).toBe(false)
  })

  it('a partir de ahi, se mueve — y el GIRO cuenta igual que el avance', () => {
    expect(seMueve(0.001, 0)).toBe(true)
    expect(seMueve(0, 0.02)).toBe(true)
    expect(seMueve(-0.05, 0)).toBe(true)
  })

  it('🔴 sin dato es null, que no es «quieto»', () => {
    // Un `/odom` que no llega no prueba que el robot este parado. Confundirlos
    // afirmaria «esta inmovilizado» sobre un robot del que no se sabe nada.
    expect(seMueve(null, null)).toBeNull()
    expect(seMueve(undefined, undefined)).toBeNull()
    expect(seMueve(NaN, NaN)).toBeNull()
  })

  it('con un solo eje valido, decide con ese', () => {
    expect(seMueve(0.5, null)).toBe(true)
    expect(seMueve(null, 0)).toBe(false)
  })
})

describe('interpretarSeguridad — no inventa', () => {
  it('DO_NOTHING es la unica forma de decir «no esta limitando»', () => {
    expect(interpretarSeguridad(msg(ACCION_MONITOR.NO_HACER_NADA, '')).efecto)
      .toBe('SIN_RESTRICCION')
  })

  it('🔴 un action_type fuera del enum NO se mapea al mas parecido', () => {
    // «Un valor plausible no es un valor validado»: el enum tiene 0-4 y solo se
    // habia OBSERVADO el 1. Un 9 futuro no puede colarse como ralentizacion.
    const s = interpretarSeguridad(msg(9, 'loquesea'))
    expect(s.efecto).toBe('NO_RECONOCIDO')
    expect(s.explicacion).toContain('action_type=9')
    expect(s.explicacion).toContain('seria adivinar')
  })

  it('y ninguno de los codigos del enum cae en NO_RECONOCIDO', () => {
    for (const v of Object.values(ACCION_MONITOR)) {
      expect(interpretarSeguridad(msg(v, 'x')).efecto).not.toBe('NO_RECONOCIDO')
    }
  })
})
