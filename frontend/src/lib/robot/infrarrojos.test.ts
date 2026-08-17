import { describe, expect, it } from 'vitest'
import {
  AVISO_EMISION, CADUCIDAD_LECTURA_S, CODIGO_MAX, CODIGO_MIN, SENSOR_SIN_SENAL,
  type EstadoIR, avisoConduccionIR, peticionBaliza, ultimoMensaje, zonaDelEmisor,
} from './infrarrojos'

/** Un estado sano, fresco y sin nadie cerca. Cada prueba cambia lo suyo. */
const base = (cambios: Partial<EstadoIR> = {}): EstadoIR => ({
  crudo: 0xFFFFFFFF,
  sensor_0: SENSOR_SIN_SENAL,
  sensor_1: SENSOR_SIN_SENAL,
  sensor_2: SENSOR_SIN_SENAL,
  sensor_3: SENSOR_SIN_SENAL,
  lecturas_validas: true,
  antiguedad_lectura_s: 0.2,
  ultimo_codigo: 0,
  hay_mensaje: false,
  antiguedad_mensaje_s: -1,
  modo: 'off',
  far_code: 0,
  near_code: 0,
  conduciendo_por_ir: false,
  ...cambios,
})

/** Enciende los sensores indicados con el codigo 1, que es el que se midio. */
const ven = (...cuales: number[]): Partial<EstadoIR> =>
  Object.fromEntries(cuales.map((n) => [`sensor_${n}`, 1])) as Partial<EstadoIR>

describe('zonaDelEmisor · los tres patrones MEDIDOS', () => {
  it('[1] es la IZQUIERDA, en los dos robots', () => {
    expect(zonaDelEmisor(base(ven(1))).zona).toBe('IZQUIERDA')
  })

  it('[1,3] y [1,2,3] son DETRAS — los dos, porque cada robot dio uno', () => {
    expect(zonaDelEmisor(base(ven(1, 3))).zona).toBe('DETRAS')
    expect(zonaDelEmisor(base(ven(1, 2, 3))).zona).toBe('DETRAS')
  })

  it('🔴 [2,3] NO se puede llamar «delante»: es DELANTE_O_DERECHA', () => {
    /*
     * La medida dio EXACTAMENTE este patron con el emisor delante y con el
     * emisor a la derecha, en los dos robots. Pintar uno de los dos seria
     * acertar la mitad de las veces con cara de certeza.
     */
    const l = zonaDelEmisor(base(ven(2, 3)))
    expect(l.zona).toBe('DELANTE_O_DERECHA')
    expect(l.evidencia).toContain('no se pueden separar')
  })
})

describe('🔴 LO QUE NO PUEDE PASAR NUNCA', () => {
  it('🔴🔴 ninguna entrada posible produce una brujula de cuatro cuadrantes', () => {
    /*
     * LA PRUEBA QUE SOSTIENE EL MODULO ENTERO, y por eso barre el rango COMPLETO
     * en vez de tres puntos representativos: este repositorio ya dejo pasar un
     * bug por muestrear 181, 700 y 1275 de un rango continuo, y otro por probar
     * `verde === 0` cuando el caso malo valia 1.
     *
     * 16 combinaciones de sensores x 4 estados de sensor_0 = las 64 posibles.
     */
    const zonas = new Set<string>()
    for (let mascara = 0; mascara < 16; mascara += 1) {
      for (const s0 of [SENSOR_SIN_SENAL, 0, 1, 15]) {
        const e = base({
          sensor_0: s0,
          sensor_1: (mascara & 1) ? 1 : SENSOR_SIN_SENAL,
          sensor_2: (mascara & 2) ? 1 : SENSOR_SIN_SENAL,
          sensor_3: (mascara & 4) ? 1 : SENSOR_SIN_SENAL,
        })
        zonas.add(zonaDelEmisor(e).zona)
      }
    }
    // Ni «DELANTE» ni «DERECHA» existen como veredicto separado.
    expect([...zonas].some((z) => z === 'DELANTE' || z === 'DERECHA')).toBe(false)
    // Y lo que sale es exactamente el vocabulario medido, sin colarse nada.
    expect([...zonas].sort()).toEqual(
      ['DELANTE_O_DERECHA', 'DETRAS', 'IZQUIERDA', 'NADIE_EN_ESTA_MUESTRA', 'PATRON_NO_MEDIDO'],
    )
  })

  it('🔴 un patron NO medido no se reparte al mas parecido: se dice que no se sabe', () => {
    /*
     * La rama por descarte de este proyecto ya afirmo «luz verde» sobre un suelo
     * a oscuras. [2] a solas se parece a [2,3], y parecerse no es ser.
     */
    for (const combo of [[2], [3], [1, 2]]) {
      const l = zonaDelEmisor(base(ven(...combo)))
      expect(l.zona).toBe('PATRON_NO_MEDIDO')
      // Y no se calla que hay ALGUIEN: eso el dato si lo dice.
      expect(l.evidencia).toContain('Hay alguien')
    }
  })

  it('🔴 una lectura RANCIA no se convierte en «no hay nadie»', () => {
    // El registro del firmware se borra al segundo: con 3 s encima, los cuatro
    // 255 significan «hace mucho que no miro». Es el caso que el `.msg` avisa.
    expect(zonaDelEmisor(base({ antiguedad_lectura_s: 3 })).zona).toBe('RANCIA')
    // Y el limite se respeta por los dos lados, sin margen inventado.
    expect(zonaDelEmisor(base({ antiguedad_lectura_s: CADUCIDAD_LECTURA_S })).zona)
      .toBe('NADIE_EN_ESTA_MUESTRA')
    expect(zonaDelEmisor(base({ antiguedad_lectura_s: CADUCIDAD_LECTURA_S + 0.01 })).zona)
      .toBe('RANCIA')
  })

  it('🔴 una antiguedad NO FINITA es «no se sabe», no cero', () => {
    // Misma familia que `nivelBateria(NaN)` devolviendo OK: NaN > 1 es false, asi
    // que sin la guarda explicita caeria en la rama de dato fresco.
    for (const mala of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(zonaDelEmisor(base({ antiguedad_lectura_s: mala })).zona).toBe('RANCIA')
    }
  })

  it('🔴 sin sondeo, los cinco campos NO se interpretan', () => {
    // Con `lecturas_validas: false` el driver manda relleno. Leerlo igualmente
    // seria publicar ceros como si fueran datos.
    const e = base({ lecturas_validas: false, ...ven(1) })
    expect(zonaDelEmisor(e).zona).toBe('SIN_SONDEO')
  })

  it('el sondeo se comprueba ANTES que la frescura, y eso importa', () => {
    /*
     * Con el sondeo apagado, `antiguedad_lectura_s` tampoco es un dato. Si se
     * mirara primero la frescura, la pantalla diria «lectura caducada» —que
     * manda a esperar— en vez de «esto esta apagado», que manda a encenderlo.
     */
    const e = base({ lecturas_validas: false, antiguedad_lectura_s: 99 })
    expect(zonaDelEmisor(e).zona).toBe('SIN_SONDEO')
  })
})

describe('sensor_0, el byte que nunca llevo datos', () => {
  it('no participa en el patron: [1] con sensor_0 activo sigue siendo IZQUIERDA', () => {
    expect(zonaDelEmisor(base({ ...ven(1), sensor_0: 1 })).zona).toBe('IZQUIERDA')
  })

  it('🔴 pero se saca a la superficie, porque contradiria la medida', () => {
    // «NUNCA, en los dos robots, en ~10 experimentos». Si aparece, lo que hay
    // que revisar es la evidencia 100, no esta pantalla.
    expect(zonaDelEmisor(base({ sensor_0: 1 })).sensor0ConDatos).toBe(true)
    expect(zonaDelEmisor(base()).sensor0ConDatos).toBe(false)
  })

  it('sin sondeo no se afirma nada de el tampoco', () => {
    expect(zonaDelEmisor(base({ lecturas_validas: false, sensor_0: 1 })).sensor0ConDatos)
      .toBe(false)
  })
})

describe('avisoConduccionIR', () => {
  it('🔴 avisa cuando el robot se mueve solo, y dice que no se para desde aqui', () => {
    const aviso = avisoConduccionIR(base({ conduciendo_por_ir: true, modo: 'following' }))
    expect(aviso).toContain('SE ESTÁ MOVIENDO SOLO')
    expect(aviso).toContain('following')
    // Ofrecer un boton que no existe es peor que no ofrecer nada.
    expect(aviso).toContain('se para en el robot')
  })

  it('calla cuando no hay nada que avisar', () => {
    expect(avisoConduccionIR(base())).toBeNull()
    // 🔴 Y el modo NO decide: `conduciendo_por_ir` sale de
    //    `get_active_control_system_id() == 8`, o sea de lo que hace el firmware,
    //    no de lo que se le pidio. Pedir `following` y que no conduzca es
    //    justamente el caso que el campo existe para distinguir.
    expect(avisoConduccionIR(base({ modo: 'following' }))).toBeNull()
  })
})

describe('ultimoMensaje', () => {
  it('🔴 el codigo 0 con hay_mensaje es un mensaje de verdad', () => {
    // Sin `hay_mensaje`, `ultimo_codigo = 0` no se distingue de «no ha llegado
    // ninguno», y 0 es un codigo valido.
    expect(ultimoMensaje(base({ hay_mensaje: true, ultimo_codigo: 0, antiguedad_mensaje_s: 2 })))
      .toEqual({ codigo: 0, antiguedadS: 2 })
  })

  it('sin hay_mensaje no hay mensaje, valga lo que valga el codigo', () => {
    expect(ultimoMensaje(base({ ultimo_codigo: 7 }))).toBeNull()
  })
})

describe('AVISO_EMISION', () => {
  it('🔴 dice que el nombre del emisor no elige quien te ve', () => {
    // Medido: emitiendo SOLO por detras, el otro robot lo recibe igual. Rebota.
    expect(AVISO_EMISION).toContain('NO garantiza la dirección')
    expect(AVISO_EMISION).toContain('rebota')
  })
})

describe('peticionBaliza — la baliza continua', () => {
  it('enciende con los dos codigos en rango', () => {
    expect(peticionBaliza(true, 3, 5)).toEqual({ encender: true, far_code: 3, near_code: 5 })
    expect(peticionBaliza(true, CODIGO_MIN, CODIGO_MAX))
      .toEqual({ encender: true, far_code: 0, near_code: 7 })
  })

  /*
   * 🔴 `null`, NO un valor recortado. Recortar convierte «pediste algo
   *    imposible» en «te mando otra cosa sin avisar», y este proyecto tiene el
   *    caso medido: `limitar(nan)` devolvia EL TOPE de velocidad.
   */
  it('devuelve null con un codigo fuera de rango, y no lo recorta', () => {
    for (const [f, n] of [[8, 0], [0, 8], [-1, 0], [0, -1], [1.5, 0], [0, NaN]] as const) {
      expect(peticionBaliza(true, f, n), `far=${f} near=${n}`).toBeNull()
    }
  })

  /*
   * 🔴🔴 APAGAR NO PUEDE FALLAR POR UN CODIGO MALO. El `.srv` dice que con
   *    `encender=false` los codigos se ignoran, asi que validarlos haria que un
   *    valor invalido en pantalla IMPIDIERA apagar la baliza — lo contrario de
   *    lo que tiene que hacer un mando que apaga algo.
   */
  it('apagar funciona SIEMPRE, aunque los codigos sean basura', () => {
    for (const [f, n] of [[99, -3], [NaN, NaN], [0, 0]] as const) {
      expect(peticionBaliza(false, f, n), `far=${f} near=${n}`)
        .toEqual({ encender: false, far_code: 0, near_code: 0 })
    }
  })

  /*
   * 📌 La forma del objeto es el contrato con `SetIRBaliza.srv`. Si alguien le
   *    añade un campo aqui sin tocar el `.srv`, rosbridge lo aceptaria y el
   *    driver lo ignoraria en silencio.
   */
  it('no manda campos que el .srv no tiene', () => {
    expect(Object.keys(peticionBaliza(true, 1, 2) ?? {}).sort())
      .toEqual(['encender', 'far_code', 'near_code'])
  })
})
