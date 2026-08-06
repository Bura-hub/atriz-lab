import { describe, expect, it } from 'vitest'
import { ValorContextoRobot, exigirContextoRobot } from './ContextoRobot'
import { Transporte, urlDeRobot } from '../lib/rosbridge/transporte'
import { fabricaFalsa } from '../pruebas/dobles'

describe('exigirContextoRobot — usar el contexto sin proveedor', () => {
  it('🔴 LANZA en vez de devolver null', () => {
    // Devolver `null` dejaria la vista «cargando» para siempre, sin un solo
    // error: el patron de fallo silencioso que este proyecto lleva media docena
    // de veces pagando.
    expect(() => exigirContextoRobot(null)).toThrowError(/ProveedorRobot/)
  })

  it('el mensaje dice que hacer, no solo que fallo', () => {
    expect(() => exigirContextoRobot(null)).toThrowError(/Envuelve la vista/)
  })

  it('con un valor de verdad lo devuelve tal cual', () => {
    const valor: ValorContextoRobot = {
      robot: 1,
      transporte: new Transporte(urlDeRobot(1), fabricaFalsa),
      conectado: false,
      ultimoAviso: null,
      // La teleoperacion vive en el contexto desde que la parada esta en el
      // marco: una sola por conexion, para que dos pantallas no publiquen en
      // `/cmd_vel_raw` a la vez. Aqui basta un doble inerte.
      teleoperacion: {
        mover: () => {},
        parar: () => {},
        paradaEmergencia: () => {},
        arrancarBarrido: async () => {},
        // El doble devuelve «no confirmada» y no `true`: un doble que afirma un
        // efecto fisico es exactamente lo que esta prueba no debe normalizar.
        liberarParada: async () => ({ confirmada: false as const, motivo: 'SIN_TESTIGO' as const }),
        ultimoAviso: null,
      },
    }
    expect(exigirContextoRobot(valor)).toBe(valor)
  })
})

describe('la url que abre el proveedor', () => {
  it('un numero de robot se convierte en su nombre mDNS, y una IP se respeta', () => {
    // Es lo que hace que el mismo codigo funcione en casa y en el laboratorio.
    expect(urlDeRobot(1)).toBe('ws://rvr-01.local:9090')
    expect(urlDeRobot('192.168.1.58')).toBe('ws://192.168.1.58:9090')
  })
})
