import { describe, expect, it } from 'vitest'
import { ACCION_APROXIMACION, EntradaNoObedece, diagnosticar, resumen } from './no_obedece'

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
  it('🔴 SIN SESION el remedio no menciona ningun boton', () => {
    /*
     * Es la mitad de la prueba original que sigue viva. Decir «pulsa» a quien no
     * puede pulsar manda a buscar un control que no esta en la pantalla, y quien
     * lo busca concluye que la interfaz esta rota.
     */
    const c = causa(diagnosticar({ ...sano, paradaEmergencia: true }), 'parada')
    expect(c.estado).toBe('CONFIRMADA')
    expect(c.remedio).toMatch(/laboratorio|junto al robot/i)
    expect(c.remedio).not.toMatch(/pulsa|bot[oó]n de abajo/i)
  })

  it('CON sesion ofrece liberarla, y avisa de que hay que MIRAR el robot', () => {
    /*
     * ⚠️ Esta prueba es NUEVA y sustituye a «el remedio NO ofrece liberarla».
     * El peligro que motivaba aquella —el robot arrancando solo al liberar con
     * un objetivo de Nav2 vivo, 34,7 cm— esta cerrado por `cancelar_nav2`: 0,0 cm
     * con control. Lo que la web NO puede comprobar es que ese nodo este vivo,
     * y por eso el remedio manda a mirar el robot en vez de callarlo.
     */
    const c = causa(diagnosticar({ ...sano, paradaEmergencia: true, haySesion: true }), 'parada')
    expect(c.estado).toBe('CONFIRMADA')      // el veredicto NO depende de la sesion
    expect(c.remedio).toMatch(/liberarla desde aqu[ií]/i)
    expect(c.remedio).toMatch(/mirarlo|ve a mirar/i)
  })

  it('el VEREDICTO no depende de la sesion, solo el remedio', () => {
    // Si la sesion cambiara el estado, la pantalla estaria diciendo que un robot
    // esta mas o menos parado segun quien lo mire.
    const sin = causa(diagnosticar({ ...sano, paradaEmergencia: true }), 'parada')
    const con = causa(diagnosticar({ ...sano, paradaEmergencia: true, haySesion: true }), 'parada')
    expect(con.estado).toBe(sin.estado)
    expect(con.evidencia).toBe(sin.evidencia)
    expect(con.remedio).not.toBe(sin.remedio)
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 La capa de seguridad frenando — el caso que faltaba
// ═══════════════════════════════════════════════════════════════════════════
describe('la capa de seguridad', () => {
  const sano = {
    conectado: true, paradaEmergencia: false, rvrResponde: true,
    antiguedadOdomS: 0.1, reanudacionesFallidas: 0,
    hayBarrido: true, msDesdeBarrido: 100, pestanaOculta: false,
  }
  const causa = (extra: object) =>
    diagnosticar({ ...sano, ...extra }).find((c) => c.id === 'frenado')!

  it('🔴 SIN mensaje del monitor NO se descarta: se dice que no se sabe', () => {
    /*
     * El monitor publica al CAMBIAR, no cada tanto: 0 mensajes en 12 s con el
     * robot quieto. Tratar el silencio como «no está frenando» descartaría la
     * causa más probable de que un avance salga corto — y es la misma forma que
     * «ros2 topic list conserva topics de nodos muertos».
     */
    expect(causa({ frenadoMonitor: null }).estado).toBe('NO_SE_SABE')
    expect(causa({}).estado).toBe('NO_SE_SABE')
  })

  it('ralentizando: CONFIRMADA, y dice que el robot SÍ obedece', () => {
    const c = causa({ frenadoMonitor: { accion: 2, poligono: 'Precaucion' } })
    expect(c.estado).toBe('CONFIRMADA')
    expect(c.titulo).toContain('SÍ obedece')
    // 🔴 El ANCHO es el dato que lo explica, y el que la pantalla no decía.
    expect(c.evidencia).toContain('40 de ANCHO')
    expect(c.evidencia).toContain('COSTADO')
    expect(c.remedio).toContain('LADOS')
  })

  it('parando por invalid source: el remedio NO manda a buscar un obstáculo', () => {
    // `invalid source` significa que no le llega /scan. Mandar a apartar algo
    // que no existe es el falso diagnóstico que esta pantalla evita.
    const c = causa({ frenadoMonitor: { accion: 1, poligono: 'invalid source' } })
    expect(c.estado).toBe('CONFIRMADA')
    expect(c.remedio).toContain('LIDAR')
    expect(c.remedio).not.toContain('Aparta')
  })

  it('parando por un polígono de verdad: manda a apartar lo que haya', () => {
    expect(causa({ frenadoMonitor: { accion: 1, poligono: 'Emergencia' } }).remedio)
      .toContain('Aparta')
  })

  it('sin limitar: DESCARTADA', () => {
    expect(causa({ frenadoMonitor: { accion: 0, poligono: '' } }).estado).toBe('DESCARTADA')
  })

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴🔴 LA ACCIÓN 3, QUE HASTA EL 2026-08-09 CAÍA EN LA RAMA EQUIVOCADA
   * ═════════════════════════════════════════════════════════════════════════
   * Le contestaba «la capa de seguridad te está frenando, y el robot SÍ
   * obedece» a quien tenía delante un robot que daba 0,0 cm avanzando, 0,0°
   * girando y 0,0 cm retrocediendo. En LA pantalla del «no obedece».
   */
  describe('🔴 acción 3 (APROXIMACION): el robot está bloqueado, no lento', () => {
    const c = () => causa({ frenadoMonitor: { accion: 3, poligono: 'Aproximacion' } })

    it('NO dice que el robot obedezca', () => {
      expect(c().titulo).not.toMatch(/S[IÍ] obedece/i)
      expect(c().titulo).toMatch(/BLOQUEADO/)
    })

    it('dice que no puede salir solo, que es lo que nadie sabía', () => {
      expect(c().titulo).toMatch(/no puede salir solo/i)
    })

    it('🔴 no menciona el 40 %, que es de OTRO polígono', () => {
      // `Precaucion` recorta al 40 %; `approach` multiplica por cero. Copiar la
      // cifra de uno al otro es el error que este proyecto llama «una cifra
      // correcta en su contexto se vuelve falsa al mudarla de sitio».
      expect(`${c().evidencia} ${c().remedio}`).not.toContain('40 %')
    })

    it('🔴 el remedio NO manda a repetir la orden ni a probar marcha atrás', () => {
      // El anterior decía «despeja los LADOS y repite la medida». Repetir no
      // hace nada: está medido en las cuatro direcciones.
      expect(c().remedio).not.toMatch(/repite/i)
      expect(c().remedio).toMatch(/con la mano/i)
    })

    it('trae las tres cifras medidas, para que se pueda comprobar', () => {
      expect(c().evidencia).toContain('0,0 cm')
      expect(c().evidencia).toContain('0,0°')
      expect(c().evidencia).toContain('15 cm')
    })
  })
})

describe('🔴 la constante local no puede quedarse atrás del .msg del robot', () => {
  it('ACCION_APROXIMACION es el 3 del enum de useTopic', async () => {
    /*
     * `no_obedece.ts` declara el 3 en local para no depender de React, que es lo
     * que permite probarlo sin entorno de navegador. El precio de esa copia es
     * que puede divergir; esta prueba es lo que lo impide, y por eso el import
     * va aquí dentro y no arriba.
     */
    const { ACCION_MONITOR } = await import('../../hooks/useTopic')
    expect(ACCION_APROXIMACION).toBe(ACCION_MONITOR.APROXIMACION)
  })
})
