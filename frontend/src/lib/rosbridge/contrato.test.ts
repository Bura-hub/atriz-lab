import { describe, expect, it } from 'vitest'
import {
  permitidoPublicar, permitidoSuscribir, permitidoLlamar, tipoDe, confirmaEfecto,
  porcentajeLegible, nivelBateria, interpretarAntiguedad,
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

  // SetLeds.srv tiene la respuesta VACIA: es la unica operacion de la
  // superficie web que no puede fallar visiblemente. La UI no debe prometer
  // confirmacion de un cambio de color.
  it('sabe que /set_leds no puede confirmar su efecto', () => {
    expect(confirmaEfecto('/set_leds')).toBe(false)
    expect(confirmaEfecto('/start_scan')).toBe(true)
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
})

describe('frescura de /motor_status', () => {
  // -1.0 significa «nunca se ha sabido nada», NO «todo bien».
  it('trata -1.0 como desconocido, no como cero', () => {
    expect(interpretarAntiguedad(-1)).toEqual({ conocido: false })
    expect(interpretarAntiguedad(0)).toEqual({ conocido: true, antiguedadS: 0 })
    expect(interpretarAntiguedad(30.5)).toEqual({ conocido: true, antiguedadS: 30.5 })
  })
})
