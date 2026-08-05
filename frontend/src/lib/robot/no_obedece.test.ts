import { describe, expect, it } from 'vitest'
import { EntradaNoObedece, diagnosticar, resumen } from './no_obedece'

/** Un robot al que todo le va bien: enlace, barrido, RVR y odometría. */
const sano: EntradaNoObedece = {
  conectado: true,
  paradaEmergencia: false,
  rvrResponde: true,
  antiguedadOdomS: 0.1,
  reanudacionesFallidas: 0,
  hayBarrido: true,
  msDesdeBarrido: 90,
  pestanaOculta: false,
}

const causa = (cs: ReturnType<typeof diagnosticar>, id: string) => cs.find((c) => c.id === id)!

describe('sin enlace no se diagnostica nada más', () => {
  it('🔴 una sola causa, y no se inventan las demás', () => {
    // Sin WebSocket no se sabe si la parada está puesta ni si el RVR contesta.
    // Enumerar las cinco con «no se sabe» seria ruido: lo unico cierto es que
    // no hay enlace.
    const cs = diagnosticar({ ...sano, conectado: false })
    expect(cs).toHaveLength(1)
    expect(cs[0].id).toBe('sin-enlace')
  })
})

describe('la parada de emergencia', () => {
  it('puesta → confirmada, y el remedio NO ofrece liberarla', () => {
    /*
     * Liberar es presencial: con un objetivo de Nav2 vivo, liberarla hizo que el
     * robot arrancara solo -34,7 cm medidos contra 0,0 con el nodo cancelar_nav2.
     * Una pantalla que ofreciera el boton crearia ese caso desde el otro lado
     * del aula.
     */
    const c = causa(diagnosticar({ ...sano, paradaEmergencia: true }), 'parada')
    expect(c.estado).toBe('CONFIRMADA')
    expect(c.remedio).toMatch(/laboratorio|presencial|junto al robot/i)
    expect(c.remedio).not.toMatch(/liberar|pulsa|bot[oó]n/i)
  })

  it('🔴 sin `/estado_robot` es NO_SE_SABE, nunca «descartada»', () => {
    // El silencio no es una negativa. Es la regla central del proyecto.
    expect(causa(diagnosticar({ ...sano, paradaEmergencia: null }), 'parada').estado)
      .toBe('NO_SE_SABE')
  })
})

describe('el barrido del LIDAR — el primer sospechoso', () => {
  it('sin `/scan` → confirmada: la capa de seguridad bloquea el movimiento', () => {
    const c = causa(diagnosticar({ ...sano, hayBarrido: false, msDesdeBarrido: null }), 'barrido')
    expect(c.estado).toBe('CONFIRMADA')
    expect(c.evidencia).toMatch(/0,0 cm/)
  })

  it('🔴 un `/scan` VIEJO no vale: lo que cuenta es que llegue AHORA', () => {
    // Un topic que llego una vez y se callo es exactamente el modo de fallo
    // silencioso que este proyecto persigue.
    expect(causa(diagnosticar({ ...sano, msDesdeBarrido: 9000 }), 'barrido').estado)
      .toBe('CONFIRMADA')
  })
})

describe('el RVR y la odometría', () => {
  it('el RVR mudo no elige entre CARGANDO y DORMIDO', () => {
    // Se ven igual desde aqui, y `reanudaciones_fallidas` no tiene umbrales
    // caracterizados. Se enseña el numero y decide quien mira el robot.
    const c = causa(diagnosticar({ ...sano, rvrResponde: false, reanudacionesFallidas: 69 }), 'rvr')
    expect(c.estado).toBe('CONFIRMADA')
    expect(c.evidencia).toMatch(/69/)
    expect(c.evidencia).toMatch(/cargando/i)
    expect(c.evidencia).toMatch(/dormido/i)
  })

  it('🔴 `antiguedad_odom_s` de −1 es NO_SE_SABE, no «recién llegada»', () => {
    // -1 significa «nunca se ha sabido nada de eso». Leerlo como un numero
    // pequeño lo convertiria en una falsa tranquilidad.
    const c = causa(diagnosticar({ ...sano, antiguedadOdomS: -1 }), 'odom')
    expect(c.estado).toBe('NO_SE_SABE')
    expect(c.evidencia).toMatch(/nunca/i)
  })

  it('odometría muerta con el enlace vivo → confirmada', () => {
    expect(causa(diagnosticar({ ...sano, antiguedadOdomS: 12.4 }), 'odom').estado)
      .toBe('CONFIRMADA')
  })
})

describe('dos causas a la vez', () => {
  it('🔴 NO se elige una: se devuelven las dos', () => {
    /*
     * Elegir seria el error que este proyecto pago cuatro veces. Cuando dos
     * causas encajan con los datos, el dato es que encajan dos.
     */
    const cs = diagnosticar({
      ...sano, paradaEmergencia: true, hayBarrido: false, msDesdeBarrido: null,
    })
    const confirmadas = cs.filter((c) => c.estado === 'CONFIRMADA').map((c) => c.id)
    expect(confirmadas).toContain('parada')
    expect(confirmadas).toContain('barrido')
    expect(resumen(cs)).toBe('2 causas encajan a la vez')
  })
})

describe('resumen', () => {
  it('🔴 NUNCA dice que el robot esté bien', () => {
    /*
     * Que ninguna de las cinco causas conocidas encaje no prueba que el robot
     * obedezca: solo que no es ninguna de las que esta pantalla sabe mirar.
     * Decir «todo bien» aqui seria la afirmacion que el proyecto entero
     * prohibe.
     */
    const r = resumen(diagnosticar(sano))
    expect(r).toBe('Ninguna de las causas conocidas encaja')
    expect(r).not.toMatch(/bien|correcto|sano|ok/i)
  })
})
