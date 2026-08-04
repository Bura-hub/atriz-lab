import { describe, expect, it } from 'vitest'
import { ACCION_MONITOR, MensajeEstadoMonitor } from '../../hooks/useTopic'
import { MOTIVO_FUENTE_INVALIDA, interpretarSeguridad } from './seguridad'

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
  for (const [nombre, valor] of [
    ['RALENTIZAR', ACCION_MONITOR.RALENTIZAR],
    ['APROXIMACION', ACCION_MONITOR.APROXIMACION],
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
