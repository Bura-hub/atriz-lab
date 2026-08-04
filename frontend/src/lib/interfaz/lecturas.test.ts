import { describe, expect, it } from 'vitest'
import {
  LecturaBateria, LecturaMotores, atascoDe, booleanoValido, entradaDeBaldosa, falloDe,
  leerRespuestaServicio, numeroValido, porcentajeDe, voltajeDe,
} from './lecturas'
import { resumirBaldosa } from '../flota/resumen'

describe('numeroValido / booleanoValido — la puerta por la que pasa todo', () => {
  it('deja pasar un numero finito y nada mas', () => {
    expect(numeroValido(8.29)).toBe(8.29)
    expect(numeroValido(0)).toBe(0)
    expect(numeroValido(-1)).toBe(-1)
    expect(numeroValido(Number.NaN)).toBeNull()
    expect(numeroValido(Number.POSITIVE_INFINITY)).toBeNull()
    expect(numeroValido(undefined)).toBeNull()
    expect(numeroValido(null)).toBeNull()
  })

  it('🔴 un booleano ausente da null, NO false', () => {
    // Colapsar «no vino el campo» a `false` es afirmar que se comprobo y no hay.
    expect(booleanoValido(true)).toBe(true)
    expect(booleanoValido(false)).toBe(false)
    expect(booleanoValido(undefined)).toBeNull()
    expect(booleanoValido(null)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La bateria: VOLTIOS
// ═══════════════════════════════════════════════════════════════════════════
describe('voltajeDe / porcentajeDe', () => {
  it('lee `voltage`, que es la señal autoritativa', () => {
    expect(voltajeDe({ voltage: 8.29 })).toBe(8.29)
  })

  it('🔴 el NaN que publica el driver cuando la lectura falla NO pasa por un voltaje', () => {
    expect(voltajeDe({ voltage: Number.NaN })).toBeNull()
    expect(voltajeDe({})).toBeNull()
    expect(voltajeDe(null)).toBeNull()
  })

  it('🔴 percentage es una FRACCION 0-1: 0,34 son 34 %, no 0 %', () => {
    // Leerlo como 0-100 hizo que un robot al 34 % pareciera estar al 0 % y
    // provoco una falsa alarma de bateria agotada.
    expect(porcentajeDe({ percentage: 0.34 })).toBeCloseTo(34, 6)
    expect(porcentajeDe({ percentage: 1 })).toBeCloseTo(100, 6)
  })

  it('el voltaje y el porcentaje son cosas distintas: 100 % con 8,29 V', () => {
    // El caso medido: el firmware decia 100 % con la bateria a 1,29 V del umbral
    // de «baja». Por eso el porcentaje nunca decide nada.
    const m: LecturaBateria = { voltage: 8.29, percentage: 1 }
    expect(voltajeDe(m)).toBe(8.29)
    expect(porcentajeDe(m)).toBeCloseTo(100, 6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// El atasco: null NO es false
// ═══════════════════════════════════════════════════════════════════════════
const motoresSanos = (cambios: Partial<LecturaMotores> = {}): LecturaMotores => ({
  atascado_izquierdo: false,
  atascado_derecho: false,
  fallo: false,
  temperatura_izquierdo: 27.5,
  temperatura_derecho: 28.3,
  estado_termico_izquierdo: 0,
  estado_termico_derecho: 0,
  antiguedad_atasco_s: 2.0,
  antiguedad_fallo_s: 12.0,
  antiguedad_termico_s: 12.0,
  ...cambios,
})

describe('atascoDe', () => {
  it('con antiguedad conocida y las dos banderas a false, no hay atasco', () => {
    expect(atascoDe(motoresSanos())).toBe(false)
  })

  it('cualquiera de las dos orugas trabada es un atasco', () => {
    expect(atascoDe(motoresSanos({ atascado_izquierdo: true }))).toBe(true)
    expect(atascoDe(motoresSanos({ atascado_derecho: true }))).toBe(true)
  })

  it('🔴 antiguedad_atasco_s = -1 es «nunca se ha sabido nada»: null, no false', () => {
    // Las banderas valen `false` porque es su VALOR INICIAL, no porque nadie haya
    // comprobado nada: el atasco solo llega por notificacion y el SDK no tiene
    // `get_motor_stall_state`. Leerlo como «no hay atasco» es falsa tranquilidad.
    const r = atascoDe(motoresSanos({ antiguedad_atasco_s: -1 }))
    expect(r).toBeNull()
    expect(r).not.toBe(false)
  })

  it('🔴 sin mensaje tampoco se afirma nada', () => {
    expect(atascoDe(null)).toBeNull()
    expect(atascoDe(undefined)).toBeNull()
  })

  it('🔴 sin el campo de antiguedad se trata como -1: no se sabe', () => {
    expect(atascoDe({ atascado_izquierdo: false, atascado_derecho: false })).toBeNull()
  })

  it('con la antiguedad conocida pero sin banderas, tampoco se inventa un false', () => {
    expect(atascoDe({ antiguedad_atasco_s: 3 })).toBeNull()
  })
})

describe('falloDe — el fallo SI se sondea, asi que su false vale', () => {
  it('con antiguedad conocida, false significa «se comprobo y no hay»', () => {
    expect(falloDe(motoresSanos())).toBe(false)
    expect(falloDe(motoresSanos({ fallo: true }))).toBe(true)
  })

  it('con antiguedad -1 vuelve a ser «no se sabe»', () => {
    expect(falloDe(motoresSanos({ antiguedad_fallo_s: -1 }))).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La entrada de la baldosa
// ═══════════════════════════════════════════════════════════════════════════
describe('entradaDeBaldosa', () => {
  it('arma la entrada con los campos que el muro necesita', () => {
    const e = entradaDeBaldosa({
      id: 7,
      conectado: true,
      bateria: { voltage: 8.29 },
      motores: motoresSanos(),
      msDesdeUltimoMotorStatus: 900,
    })
    expect(e).toEqual({
      id: 7,
      conectado: true,
      voltios: 8.29,
      antiguedadTermicoS: 12.0,
      atascado: false,
      msDesdeUltimoLatido: 900,
      // Sin `/estado_robot` la entrada lo dice: `null`, que NO es «todo bien».
      estadoRobot: null,
    })
  })

  it('recoge /estado_robot cuando llega, con la lectura anterior del latido', () => {
    const e = entradaDeBaldosa({
      id: 7,
      conectado: true,
      bateria: { voltage: 8.29 },
      motores: motoresSanos(),
      msDesdeUltimoMotorStatus: 900,
      estado: {
        latido: 2181,
        parada_emergencia: true,
        rvr_responde: true,
        antiguedad_muestra_s: 0.05,
        antiguedad_odom_s: 0.06,
        reanudaciones_fallidas: 0,
      },
      latidoPrevio: 2180,
    })
    expect(e.estadoRobot).toEqual({
      latido: 2181,
      latidoPrevio: 2180,
      paradaEmergencia: true,
      rvrResponde: true,
      antiguedadMuestraS: 0.05,
      antiguedadOdomS: 0.06,
      reanudacionesFallidas: 0,
    })
  })

  it('🔴 un mensaje al que le falta lo esencial da null, no medio dato', () => {
    // `useTopic` hace una ASERCION de tipo, no una validacion: si el robot manda
    // otra cosa —un driver mas viejo, un campo renombrado— nada lo detiene, y un
    // `undefined` comparado con un umbral produce decisiones inventadas.
    const e = entradaDeBaldosa({
      id: 7,
      conectado: true,
      bateria: null,
      motores: null,
      msDesdeUltimoMotorStatus: null,
      estado: { latido: 5 },          // sin parada_emergencia ni rvr_responde
      latidoPrevio: 4,
    })
    expect(e.estadoRobot).toBeNull()
  })

  it('y las antiguedades que faltan caen a -1, la convencion de «no se sabe»', () => {
    const e = entradaDeBaldosa({
      id: 7,
      conectado: true,
      bateria: null,
      motores: null,
      msDesdeUltimoMotorStatus: null,
      estado: { latido: 5, parada_emergencia: false, rvr_responde: true },
      latidoPrevio: null,
    })
    // 🔴 -1 y no 0: un 0 significaria «acaba de llegar una muestra», que es la
    //    direccion insegura del error.
    expect(e.estadoRobot?.antiguedadOdomS).toBe(-1)
    expect(e.estadoRobot?.antiguedadMuestraS).toBe(-1)
  })

  it('un robot sin ningun mensaje todavia no afirma nada de nada', () => {
    const e = entradaDeBaldosa({
      id: 3, conectado: true, bateria: null, motores: null, msDesdeUltimoMotorStatus: null,
    })
    expect(e.voltios).toBeNull()
    expect(e.antiguedadTermicoS).toBeNull()
    expect(e.atascado).toBeNull()
    expect(e.msDesdeUltimoLatido).toBeNull()
  })

  it('🔴 y la baldosa que sale de ahi NO pide que nadie vaya a ningun sitio', () => {
    // La cadena entera: sin datos -> SIN_DATOS -> «sin señal de vida» -> MIRAR.
    // Nunca IR, y nunca una averia.
    const b = resumirBaldosa(entradaDeBaldosa({
      id: 3, conectado: true, bateria: null, motores: null, msDesdeUltimoMotorStatus: null,
    }))
    expect(b.estado).toBe('SIN_DATOS')
    expect(b.atencion).toBe('MIRAR')
    expect(b.bateria).toBe('DESCONOCIDO')
  })

  it('un robot cargando (voltaje NaN, sin atasco conocido) sale DESCONOCIDO y no OK', () => {
    const b = resumirBaldosa(entradaDeBaldosa({
      id: 5,
      conectado: true,
      bateria: { voltage: Number.NaN },
      motores: motoresSanos({ antiguedad_atasco_s: -1 }),
      msDesdeUltimoMotorStatus: 800,
    }))
    expect(b.bateria).toBe('DESCONOCIDO')
    expect(b.bateria).not.toBe('OK')
    expect(b.atascado).toBeNull()
    expect(b.atencion).not.toBe('IR')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La respuesta de un servicio
// ═══════════════════════════════════════════════════════════════════════════
describe('leerRespuestaServicio', () => {
  it('lee success y message cuando vienen', () => {
    expect(leerRespuestaServicio({ success: true, message: 'all_lights = (255, 0, 0)' }))
      .toEqual({ success: true, message: 'all_lights = (255, 0, 0)' })
  })

  it('🔴 una respuesta VACIA (los cuatro servicios de std_srvs/Empty) no afirma nada', () => {
    expect(leerRespuestaServicio({})).toEqual({ success: null, message: null })
  })

  it('lo que no es un objeto tampoco', () => {
    expect(leerRespuestaServicio(null)).toEqual({ success: null, message: null })
    expect(leerRespuestaServicio('ok')).toEqual({ success: null, message: null })
    expect(leerRespuestaServicio(undefined)).toEqual({ success: null, message: null })
  })

  it('un success que no es booleano se descarta en vez de convertirse', () => {
    expect(leerRespuestaServicio({ success: 1 }).success).toBeNull()
  })

  it('un message vacio es como no traerlo', () => {
    expect(leerRespuestaServicio({ success: false, message: '' }).message).toBeNull()
  })
})
