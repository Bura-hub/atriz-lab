import { describe, expect, it } from 'vitest'
import {
  permitidoPublicar, permitidoSuscribir, permitidoLlamar, tipoDe, confirmaEfecto,
  porcentajeLegible, nivelBateria, interpretarAntiguedad, SERVICIOS,
} from './contrato'

describe('lista blanca', () => {
  it('permite publicar en los tres topics de escritura', () => {
    expect(permitidoPublicar('/cmd_vel_raw')).toBe(true)
    expect(permitidoPublicar('/emergency_stop')).toBe(true)
    expect(permitidoPublicar('/initialpose')).toBe(true)
  })

  // Esta es LA prueba de esta tarea. /cmd_vel es la SALIDA del collision_monitor:
  // publicar ahi FUNCIONA y salta la capa de seguridad en silencio.
  it('NO permite publicar en /cmd_vel', () => {
    expect(permitidoPublicar('/cmd_vel')).toBe(false)
  })

  it('permite suscribirse a los 12 de lectura y a nada mas', () => {
    expect(permitidoSuscribir('/odom')).toBe(true)
    expect(permitidoSuscribir('/collision_monitor_state')).toBe(true)
    expect(permitidoSuscribir('/ambient_light')).toBe(false)
  })

  it('permite los 8 servicios y rechaza los que se saltan la seguridad', () => {
    expect(permitidoLlamar('/start_scan')).toBe(true)
    expect(permitidoLlamar('/set_leds')).toBe(true)
    expect(permitidoLlamar('/raw_motors')).toBe(false)
    expect(permitidoLlamar('/move_timed')).toBe(false)
  })

  it('conoce el tipo de cada topic', () => {
    expect(tipoDe('/odom')).toBe('nav_msgs/msg/Odometry')
    expect(tipoDe('/emergency_stop')).toBe('std_msgs/msg/Empty')
    expect(tipoDe('/cmd_vel_raw')).toBe('geometry_msgs/msg/Twist')
  })

  // Los tipos del paquete PROPIO del proyecto (atriz_rvr_msgs) son los unicos
  // que pueden derivar de verdad, porque son los unicos que vive el codigo de
  // este repositorio de web. `/encoders` fue justo el caso real: decia
  // 'atriz_rvr_msgs/msg/Encoders' (PLURAL) cuando el .msg y el import del
  // driver dicen 'Encoder' (singular) — ni este comprobador ni
  // `comprobar_contrato.mjs` (que solo compara NOMBRES contra
  // robot.launch.py) lo cazaban, porque ninguno de los dos miraba el tipo de
  // este topic en concreto.
  it('conoce el tipo exacto de los topics propios (atriz_rvr_msgs)', () => {
    expect(tipoDe('/color')).toBe('atriz_rvr_msgs/msg/Color')
    expect(tipoDe('/motor_status')).toBe('atriz_rvr_msgs/msg/MotorStatus')
    expect(tipoDe('/encoders')).toBe('atriz_rvr_msgs/msg/Encoder')
  })

  // 🔴 C1: cuatro de los ocho servicios tienen respuesta VACIA
  // (std_srvs/srv/Empty o SetLeds.srv), no solo /set_leds. Antes
  // `confirmaEfecto('/release_emergency_stop')` daba `true` -la operacion que
  // devuelve el control del robot a un aula con estudiantes- sobre una
  // respuesta que no contiene ni un bit para confirmar. Se comprueban los
  // OCHO, no solo dos: la primera version de esta prueba solo miraba
  // /set_leds y /start_scan y dejaba pasar el error en los otros seis.
  it('sabe cuales de los OCHO servicios no pueden confirmar su efecto (respuesta vacia)', () => {
    expect(confirmaEfecto('/start_scan')).toBe(false)
    expect(confirmaEfecto('/stop_scan')).toBe(false)
    expect(confirmaEfecto('/release_emergency_stop')).toBe(false)
    expect(confirmaEfecto('/set_leds')).toBe(false)
  })

  it('sabe cuales de los OCHO servicios SI confirman su efecto (bool success)', () => {
    expect(confirmaEfecto('/set_pos_and_yaw')).toBe(true)
    expect(confirmaEfecto('/set_led_rgb')).toBe(true)
    expect(confirmaEfecto('/set_multiple_leds')).toBe(true)
    expect(confirmaEfecto('/trigger_led_event')).toBe(true)
  })

  // Los OCHO de SERVICIOS estan cubiertos entre las dos pruebas de arriba:
  // ninguno se queda sin comprobar.
  it('las dos listas cubren los ocho servicios sin solapar', () => {
    const cubiertos = [
      '/start_scan', '/stop_scan', '/release_emergency_stop', '/set_leds',
      '/set_pos_and_yaw', '/set_led_rgb', '/set_multiple_leds', '/trigger_led_event',
    ]
    expect(cubiertos.sort()).toEqual([...SERVICIOS].sort())
  })
})

describe('bateria', () => {
  // percentage es una FRACCION 0-1: leerla como 0-100 hizo que un robot al
  // 34 % pareciera estar al 0 % y provoco una falsa alarma.
  it('convierte la fraccion 0-1 a porcentaje', () => {
    expect(porcentajeLegible(0.34)).toBe(34)
    expect(porcentajeLegible(1)).toBe(100)
  })

  // El porcentaje decia 100 % con 8,29 V. La senal valida es el VOLTAJE.
  it('decide por voltaje, con los umbrales del firmware', () => {
    expect(nivelBateria(8.29)).toBe('OK')
    expect(nivelBateria(7.01)).toBe('OK')
    expect(nivelBateria(6.99)).toBe('BAJA')
    expect(nivelBateria(6.49)).toBe('CRITICA')
  })

  // 🔴 C4: `nivelBateria(NaN)` devolvia 'OK' -el tope de seguridad, por la
  // puerta equivocada, igual que `limitar(nan)` en atriz.py. En el robot,
  // rvr_driver_node.py:958 publica `voltage = NaN` cuando la lectura falla
  // (RVR cargando con la Pi viva, o dormido): con el bug la vista de flota
  // pintaba ese robot en OK.
  it('un voltaje NO FINITO (NaN, Infinity) es DESCONOCIDO, no OK', () => {
    expect(nivelBateria(NaN)).toBe('DESCONOCIDO')
    expect(nivelBateria(Infinity)).toBe('DESCONOCIDO')
    expect(nivelBateria(-Infinity)).toBe('DESCONOCIDO')
  })

  // Misma familia que nivelBateria(NaN): Math.round(NaN * 100) da NaN en
  // silencio y una UI lo pintaria como "NaN%".
  it('porcentajeLegible(NaN) es null, no NaN', () => {
    expect(porcentajeLegible(NaN)).toBeNull()
    expect(porcentajeLegible(Infinity)).toBeNull()
  })
})

describe('frescura de /motor_status', () => {
  // -1.0 significa «nunca se ha sabido nada», NO «todo bien».
  it('trata -1.0 como desconocido, no como cero', () => {
    expect(interpretarAntiguedad(-1)).toEqual({ conocido: false })
    expect(interpretarAntiguedad(0)).toEqual({ conocido: true, antiguedadS: 0 })
    expect(interpretarAntiguedad(30.5)).toEqual({ conocido: true, antiguedadS: 30.5 })
  })

  // Misma familia: antes `NaN < 0` era `false`, asi que un valor NO FINITO
  // caia en la rama `conocido: true` con `antiguedadS: NaN`.
  it('trata NaN como desconocido, no como un numero valido', () => {
    expect(interpretarAntiguedad(NaN)).toEqual({ conocido: false })
  })
})
