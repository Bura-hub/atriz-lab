import { describe, expect, it } from 'vitest'
import {
  EntradaBaldosa,
  EntradaEstadoRobot, TEXTO_SIN_SENAL, UMBRAL_LATIDO_MURO_MS, UMBRAL_TERMICO_RANCIO_S, resumirBaldosa,
} from './resumen'
import { UMBRAL_SILENCIO_MS } from '../rosbridge/salud'

/**
 * Una baldosa SANA: robot conectado, latiendo, bateria al «100 %» real
 * (8,29 V medidos), temperatura recien sondeada y sin atasco. Cada prueba
 * cambia SOLO lo que esta probando, para que un fallo señale una causa.
 */
const estadoSano = (cambios: Partial<EntradaEstadoRobot> = {}): EntradaEstadoRobot => ({
  latido: 100,
  latidoPrevio: 99,
  paradaEmergencia: false,
  rvrResponde: true,
  antiguedadMuestraS: 0.06,
  antiguedadOdomS: 0.06,
  reanudacionesFallidas: 0,
  conduciendoPorIR: false,
  ...cambios,
})

const sana = (cambios: Partial<EntradaBaldosa> = {}): EntradaBaldosa => ({
  id: 1,
  conectado: true,
  voltios: 8.29,
  antiguedadTermicoS: 5,
  atascado: false,
  estadoRobot: estadoSano(),
  msDesdeUltimoLatido: 900,
  ...cambios,
})

describe('resumirBaldosa — la baldosa sana', () => {
  it('un robot conectado, latiendo y con la bateria bien no pide nada y no dice nada', () => {
    const b = resumirBaldosa(sana())
    expect(b.id).toBe(1)
    expect(b.estado).toBe('EN_LINEA')
    expect(b.atencion).toBe('NINGUNA')
    expect(b.motivos).toEqual([])
    expect(b.bateria).toBe('OK')
    expect(b.datosVigentes).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Regla 1 · BATERIA POR VOLTIOS, y DESCONOCIDO no es OK
// ═══════════════════════════════════════════════════════════════════════════
describe('resumirBaldosa — regla 1: la bateria se decide por VOLTIOS', () => {
  it('sin voltaje la bateria es DESCONOCIDO, y la baldosa NO la da por buena', () => {
    const b = resumirBaldosa(sana({ voltios: null }))
    // Lo que importa de verdad: DESCONOCIDO y OK son cosas distintas. Colapsar
    // las dos es lo que hacia `nivelBateria(NaN)` antes de arreglarse.
    expect(b.bateria).toBe('DESCONOCIDO')
    expect(b.bateria).not.toBe('OK')
    expect(b.voltios).toBeNull()
    expect(b.motivos.some((m) => m.includes('no se sabe la batería'))).toBe(true)
  })

  it('un NaN (lo que publica el driver cuando la lectura falla) tampoco es OK', () => {
    const b = resumirBaldosa(sana({ voltios: Number.NaN }))
    expect(b.bateria).toBe('DESCONOCIDO')
    expect(b.voltios).toBeNull()   // la interfaz no puede pintar «NaN V»
  })

  it('un Infinity tampoco pasa por bueno', () => {
    expect(resumirBaldosa(sana({ voltios: Number.POSITIVE_INFINITY })).bateria).toBe('DESCONOCIDO')
  })

  it('8,29 V es OK y 6,90 V es BAJA: lo decide el voltaje, no el porcentaje', () => {
    // El porcentaje del firmware decia 100 % con 8,29 V. Los dos casos de abajo
    // son indistinguibles por porcentaje y distintos por voltaje: es justo la
    // medida que hizo que este proyecto dejara de usar `percentage`.
    expect(resumirBaldosa(sana({ voltios: 8.29 })).bateria).toBe('OK')
    expect(resumirBaldosa(sana({ voltios: 6.9 })).bateria).toBe('BAJA')
    expect(resumirBaldosa(sana({ voltios: 6.4 })).bateria).toBe('CRITICA')
  })

  it('la bateria baja pide MIRAR, y el motivo trae el voltaje', () => {
    const b = resumirBaldosa(sana({ voltios: 6.9 }))
    expect(b.atencion).toBe('MIRAR')
    expect(b.motivos.some((m) => m.includes('6,90 V'))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Regla 2 · LA AUSENCIA DE DATOS NO ES AVERIA
// ═══════════════════════════════════════════════════════════════════════════
describe('resumirBaldosa — regla 2: sin datos es MIRAR, nunca IR', () => {
  it('sin conexion: SIN_CONEXION, MIRAR y el texto «sin señal de vida»', () => {
    const b = resumirBaldosa(sana({ conectado: false }))
    expect(b.estado).toBe('SIN_CONEXION')
    expect(b.atencion).toBe('MIRAR')
    expect(b.atencion).not.toBe('IR')
    expect(b.motivos).toContain(TEXTO_SIN_SENAL)
  })

  it('el texto es LITERALMENTE «sin señal de vida»', () => {
    // Se afirma la cadena, no la constante: una prueba que solo compara contra
    // `TEXTO_SIN_SENAL` sigue verde aunque alguien cambie el texto a «robot
    // averiado», que es justo lo que la regla 2 prohibe decir. Se comprobo
    // rompiendolo: con la constante puesta a otra cosa, esta prueba falla y las
    // que usan la constante no.
    expect(TEXTO_SIN_SENAL).toBe('sin señal de vida')
    expect(resumirBaldosa(sana({ conectado: false })).motivos).toContain('sin señal de vida')
  })

  it('conectado pero sin latido: SIN_DATOS, MIRAR y el mismo texto', () => {
    const b = resumirBaldosa(sana({ msDesdeUltimoLatido: null }))
    expect(b.estado).toBe('SIN_DATOS')
    expect(b.atencion).toBe('MIRAR')
    expect(b.motivos).toContain(TEXTO_SIN_SENAL)
  })

  it('el motivo dice explicitamente que NO es una averia (el robot cargando es lo cotidiano)', () => {
    const b = resumirBaldosa(sana({ msDesdeUltimoLatido: 999999 }))
    expect(b.motivos.some((m) => m.includes('NO es una avería'))).toBe(true)
    expect(b.motivos.some((m) => m.includes('cargando'))).toBe(true)
  })

  it('🔴 un voltaje CRITICO rancio, sin latido, NO manda a nadie a cruzar el edificio', () => {
    // El hecho es positivo pero NO es actual: sin latido no se sabe si esa
    // lectura es de hace dos segundos o de hace una hora.
    const b = resumirBaldosa(sana({ conectado: false, voltios: 6.0 }))
    expect(b.atencion).toBe('MIRAR')
    expect(b.datosVigentes).toBe(false)
  })

  it('🔴 un atasco rancio, sin latido, tampoco manda a nadie', () => {
    const b = resumirBaldosa(sana({ msDesdeUltimoLatido: null, atascado: true }))
    expect(b.atencion).toBe('MIRAR')
    expect(b.atascado).toBe(true)      // el dato se conserva...
    expect(b.datosVigentes).toBe(false) // ...pero marcado como no vigente
  })

  it('sin latido la baldosa NO afirma nada sobre bateria ni temperatura: solo habla de la señal', () => {
    const b = resumirBaldosa(sana({ conectado: false, voltios: 6.0, antiguedadTermicoS: 400 }))
    expect(b.motivos).toHaveLength(2)
    expect(b.motivos[0]).toBe(TEXTO_SIN_SENAL)
    expect(b.motivos.some((m) => m.includes('bateria'))).toBe(false)
    expect(b.motivos.some((m) => m.includes('temperatura'))).toBe(false)
  })

  it('un latido NEGATIVO (salto de NTP hacia atras) no cuenta como fresco', () => {
    // Sin el `ms >= 0`, «-50 <= 5000» es verdad y la baldosa diria que hay
    // latido sobre un robot mudo. Es la direccion insegura.
    expect(resumirBaldosa(sana({ msDesdeUltimoLatido: -50 })).estado).toBe('SIN_DATOS')
  })

  it('la frontera del latido: justo en el umbral hay vida, un ms despues no', () => {
    expect(resumirBaldosa(sana({ msDesdeUltimoLatido: UMBRAL_LATIDO_MURO_MS })).estado).toBe('EN_LINEA')
    expect(resumirBaldosa(sana({ msDesdeUltimoLatido: UMBRAL_LATIDO_MURO_MS + 1 })).estado).toBe('SIN_DATOS')
  })

  it('🔴 el umbral del MURO no es el de salud.ts, y no debe unificarse', () => {
    // salud.ts mide /odom a 16,5 Hz; el muro mide /motor_status a 1 Hz. Usar
    // 3000 ms sobre un topic de 1 Hz pintaria las 16 baldosas «sin señal de
    // vida» al primer hipo de WiFi -exactamente lo que la regla 2 evita.
    expect(UMBRAL_LATIDO_MURO_MS).toBeGreaterThan(UMBRAL_SILENCIO_MS)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Regla 3 · IR SOLO CON UN HECHO POSITIVO
// ═══════════════════════════════════════════════════════════════════════════
describe('resumirBaldosa — regla 3: IR solo con un hecho positivo y actual', () => {
  it('un atasco confirmado en un robot vivo manda IR', () => {
    const b = resumirBaldosa(sana({ atascado: true }))
    expect(b.atencion).toBe('IR')
    expect(b.motivos.some((m) => m.includes('atasco confirmado'))).toBe(true)
  })

  it('una bateria CRITICA en un robot vivo manda IR', () => {
    const b = resumirBaldosa(sana({ voltios: 6.4 }))
    expect(b.atencion).toBe('IR')
    expect(b.motivos.some((m) => m.includes('CRÍTICA'))).toBe(true)
  })

  it('🔴 un robot del que no se sabe NADA (todo null) nunca es IR', () => {
    const b = resumirBaldosa(sana({ voltios: null, antiguedadTermicoS: null, atascado: null }))
    expect(b.atencion).not.toBe('IR')
    expect(b.atencion).toBe('NINGUNA')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Regla 4 · -1.0 ES «NO SE SABE», Y UNA TEMPERATURA VIEJA ES EL MISMO DATO
// ═══════════════════════════════════════════════════════════════════════════
describe('resumirBaldosa — regla 4: la antiguedad termica', () => {
  it('🔴 -1.0 es «no se sabe», no «cero segundos» ni «todo bien»', () => {
    const b = resumirBaldosa(sana({ antiguedadTermicoS: -1 }))
    // La comparacion completa es deliberada: si alguien tratara el -1 como un
    // numero mas, esto seria `{ conocido: true, antiguedadS: -1 }`.
    expect(b.frescuraTermico).toEqual({ conocido: false })
    expect(b.termicoRancio).toBe(false)   // desconocido no es rancio, ni fresco
    expect(b.motivos.some((m) => m.includes('temperatura'))).toBe(false)
  })

  it('cero segundos SI es un dato: recien sondeado', () => {
    expect(resumirBaldosa(sana({ antiguedadTermicoS: 0 })).frescuraTermico)
      .toEqual({ conocido: true, antiguedadS: 0 })
  })

  it('null (el campo ni siquiera llego) tambien es «no se sabe»', () => {
    expect(resumirBaldosa(sana({ antiguedadTermicoS: null })).frescuraTermico).toEqual({ conocido: false })
  })

  it('por encima del umbral la temperatura es el MISMO dato repetido, y se dice', () => {
    const b = resumirBaldosa(sana({ antiguedadTermicoS: UMBRAL_TERMICO_RANCIO_S + 5 }))
    expect(b.termicoRancio).toBe(true)
    expect(b.motivos.some((m) => m.includes('MISMO dato repetido'))).toBe(true)
  })

  it('justo en el umbral todavia no es rancio', () => {
    expect(resumirBaldosa(sana({ antiguedadTermicoS: UMBRAL_TERMICO_RANCIO_S })).termicoRancio).toBe(false)
  })

  it('una temperatura rancia NO sube la atencion: un RVR cargando la produce todos los dias', () => {
    expect(resumirBaldosa(sana({ antiguedadTermicoS: 400 })).atencion).toBe('NINGUNA')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Regla 5 · `atascado: null` NO ES `false`
// ═══════════════════════════════════════════════════════════════════════════
describe('resumirBaldosa — regla 5: no saber si hay atasco no es que no lo haya', () => {
  it('el null se propaga tal cual, no se colapsa a false', () => {
    const b = resumirBaldosa(sana({ atascado: null }))
    expect(b.atascado).toBeNull()
    expect(b.atascado).not.toBe(false)
  })

  it('no saberlo no dispara IR, y tampoco genera una frase que diga que esta bien', () => {
    const b = resumirBaldosa(sana({ atascado: null }))
    expect(b.atencion).toBe('NINGUNA')
    expect(b.motivos.some((m) => m.includes('atasco'))).toBe(false)
  })

  it('un false explicito y un null dan la misma atencion pero NO el mismo dato', () => {
    expect(resumirBaldosa(sana({ atascado: false })).atascado).toBe(false)
    expect(resumirBaldosa(sana({ atascado: null })).atascado).toBeNull()
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// `/estado_robot`: las tres cosas que el muro no podia saber
// ═══════════════════════════════════════════════════════════════════════════

describe('resumirBaldosa — el tercer estado: /odom muerto con el enlace vivo', () => {
  // 🔴 ES EL CASO QUE PINTABA VERDE. Llegan muestras del RVR, el latido avanza y
  //    rvr_responde dice true, pero /odom no se completa. Por todos los demas
  //    caminos el robot parece sano.
  const muerta = resumirBaldosa(sana({
    estadoRobot: estadoSano({ antiguedadMuestraS: 0.05, antiguedadOdomS: 12 }),
  }))

  it('lo detecta', () => {
    expect(muerta.odometriaMuerta).toBe(true)
  })

  it('🔴 y manda IR: es un hecho positivo y actual, y nada mas lo delata', () => {
    expect(muerta.atencion).toBe('IR')
  })

  it('dice que reiniciar el streaming NO lo arregla', () => {
    // Sin esa frase, quien lo lea intentara justo lo que no funciona.
    expect(muerta.motivos.some((m) => m.includes('NO lo arregla'))).toBe(true)
  })

  it('un robot sano NO lo dispara', () => {
    expect(resumirBaldosa(sana()).odometriaMuerta).toBe(false)
    expect(resumirBaldosa(sana()).atencion).toBe('NINGUNA')
  })

  it('🔴 y -1 («no se sabe») tampoco: no es una antiguedad pequeña', () => {
    // Comparar -1 contra el umbral daria «fresco» sobre un dato que no existe.
    expect(resumirBaldosa(sana({
      estadoRobot: estadoSano({ antiguedadMuestraS: -1, antiguedadOdomS: -1 }),
    })).odometriaMuerta).toBe(false)
  })
})

describe('resumirBaldosa — la parada de emergencia en el muro', () => {
  const parado = resumirBaldosa(sana({ estadoRobot: estadoSano({ paradaEmergencia: true }) }))

  it('se propaga, para que el administrador no busque una averia que no existe', () => {
    expect(parado.paradaEmergencia).toBe(true)
    expect(parado.motivos.some((m) => m.includes('parada de emergencia esta puesta'))).toBe(true)
  })

  it('dice que NO es una averia', () => {
    expect(parado.motivos.some((m) => m.includes('NO es una averia'))).toBe(true)
  })

  it('⚠️ pide MIRAR, no IR: alguien la pulso, es un estado normal', () => {
    expect(parado.atencion).toBe('MIRAR')
  })
})

describe('🆕 «la Pi calla» — las CUATRO causas, no tres', () => {
  /*
   * El robot avisó de que este texto «apunta al sitio equivocado»: sus tres
   * causas señalaban al RVR o al proceso, y el fallo medido dos veces
   * (evidencias 109 y 113) no era ninguna — el driver vivo leyendo 8,37 V, el
   * WiFi a −46 dBm con cero desconexiones, y DDS sin cruzar DENTRO de la Pi.
   */
  const calla = resumirBaldosa(sana({
    conectado: true, msDesdeUltimoLatido: 99_000, estadoRobot: null,
  }))

  it('🔴 nombra el caso de DDS, que no encaja en ninguna de las otras tres', () => {
    const texto = calla.motivos.join(' ')
    expect(texto).toContain('mudo en DDS')
  })

  it('🔴 y dice explicitamente que NO es la red', () => {
    // Era la conclusion natural y esta medido que no: −46 dBm, 200 Mbit/s,
    // 0 desconexiones, `power_save off`.
    expect(calla.motivos.join(' ')).toContain('NO es la red')
  })

  it('manda ESPERAR antes de cruzar el edificio, porque se cura solo una vez', () => {
    // `atriz-vigia-dds` espera hasta 90 s y reinicia el stack. UNA vez por
    // arranque: con la marca puesta falla abierto, asi que no se promete mas.
    expect(calla.motivos.join(' ')).toMatch(/par de minutos/)
    expect(calla.motivos.join(' ')).toContain('una vez por arranque')
  })

  it('🔴 EL CONTROL: sin enlace NO se habla de DDS', () => {
    // Sin WebSocket no se sabe nada del robot; mencionar DDS ahi seria inventar
    // una causa sobre un hueco.
    const sinEnlace = resumirBaldosa(sana({ conectado: false, estadoRobot: null }))
    expect(sinEnlace.motivos.join(' ')).not.toContain('DDS')
  })
})

describe('🆕 resumirBaldosa — el robot que conduce SOLO por infrarrojos', () => {
  const porIR = resumirBaldosa(sana({ estadoRobot: estadoSano({ conduciendoPorIR: true }) }))

  it('🔴 lo dice: sin esto la baldosa pinta «parado» un robot que cruza el aula', () => {
    // `following` y `evading` son modos del FIRMWARE y no pasan por cmd_vel, asi
    // que ninguna otra señal del muro los ve.
    expect(porIR.motivos.some((m) => m.includes('se mueve SOLO'))).toBe(true)
    expect(porIR.etiquetas.some((t) => t.includes('conduce por IR'))).toBe(true)
  })

  it('y dice donde se apaga, que no es aqui', () => {
    expect(porIR.motivos.some((m) => m.includes('no desde aqui'))).toBe(true)
  })

  it('⚠️ pide MIRAR, no IR: en una practica de infrarrojos es lo que TIENE que pasar', () => {
    /*
     * Con `IR` las dieciseis baldosas pedirian cruzar el aula a la vez durante
     * una practica normal, que es el gasto de credibilidad que este fichero ya
     * documenta para la parada y para el RVR sin contestar.
     */
    expect(porIR.atencion).toBe('MIRAR')
  })

  it('🔴 EL CONTROL: un robot sano no lo dice, y sigue en NINGUNA', () => {
    const sano = resumirBaldosa(sana({ estadoRobot: estadoSano() }))
    expect(sano.atencion).toBe('NINGUNA')
    expect(sano.motivos.some((m) => m.includes('se mueve SOLO'))).toBe(false)
  })

  it('🔴 sin /estado_robot NO se afirma que no conduzca', () => {
    // `null` es «no se sabe». Un robot mudo ya sale en MIRAR por otro camino, y
    // añadir aqui una negacion inventada seria afirmar de mas.
    const mudo = resumirBaldosa(sana({ estadoRobot: null }))
    expect(mudo.motivos.some((m) => m.includes('se mueve SOLO'))).toBe(false)
  })
})

describe('resumirBaldosa — el RVR sin contestar (cargando o dormido)', () => {
  const cargando = resumirBaldosa(sana({ estadoRobot: estadoSano({ rvrResponde: false }) }))

  it('lo distingue de «no llego nada»', () => {
    expect(cargando.rvrResponde).toBe(false)
    expect(cargando.estado).toBe('EN_LINEA')   // la Pi SI contesta
  })

  it('nombra las tres causas sin elegir, y dice que cargando es lo cotidiano', () => {
    const m = cargando.motivos.find((x) => x.includes('RVR no contesta'))
    expect(m).toBeDefined()
    expect(m).toContain('cargando')
    expect(m).toContain('dormido')
    expect(m).toContain('cotidiano')
  })

  it('⚠️ MIRAR, no IR: un robot en el cargador no justifica cruzar el aula', () => {
    expect(cargando.atencion).toBe('MIRAR')
  })
})

describe('resumirBaldosa — sin /estado_robot', () => {
  it('🔴 «no llega» da null, NUNCA false: un driver viejo no es un robot sin parada', () => {
    const b = resumirBaldosa(sana({ estadoRobot: null }))
    expect(b.paradaEmergencia).toBeNull()
    expect(b.rvrResponde).toBeNull()
    expect(b.odometriaMuerta).toBe(false)
  })

  it('y no cambia la atencion: no se sabe, no se inventa', () => {
    expect(resumirBaldosa(sana({ estadoRobot: null })).atencion).toBe('NINGUNA')
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// Las etiquetas cortas: la MISMA informacion, a la distancia de lectura del muro
// ═══════════════════════════════════════════════════════════════════════════

describe('etiquetas — la version que cabe en una baldosa', () => {
  /** El peor caso REAL, medido el 2026-08-04: seis motivos a la vez. */
  const peor = resumirBaldosa(sana({
    voltios: 6.4,
    antiguedadTermicoS: 120,
    atascado: true,
    estadoRobot: estadoSano({
      paradaEmergencia: true, rvrResponde: false,
      antiguedadMuestraS: 0.05, antiguedadOdomS: 99, reanudacionesFallidas: 70,
    }),
  }))

  it('🔴 hay UNA etiqueta por motivo, siempre', () => {
    // Las dos listas se construyen juntas en `anota()`, asi que no pueden
    // desincronizarse — pero si alguien añade un `motivos.push` suelto, esto lo
    // caza. Una baldosa con mas frases que etiquetas se quedaria callada sobre
    // algo que si sabe.
    expect(peor.etiquetas).toHaveLength(peor.motivos.length)
    expect(peor.motivos.length).toBe(6)
  })

  it('y ninguna baldosa las tiene descuadradas, sea cual sea su estado', () => {
    for (const e of [
      sana(),
      sana({ conectado: false, estadoRobot: null }),
      sana({ voltios: null }),
      sana({ voltios: 6.9 }),
      sana({ estadoRobot: null }),
      peor === undefined ? sana() : sana({ atascado: true }),
    ]) {
      const b = resumirBaldosa(e)
      expect(b.etiquetas.length, JSON.stringify(e)).toBe(b.motivos.length)
    }
  })

  it('🔴 caben en una baldosa: ninguna pasa de 24 caracteres', () => {
    // El motivo mas largo mide 155. Ese es el numero que hacia ilegible el muro
    // y por el que existen las etiquetas.
    for (const et of peor.etiquetas) {
      expect(et.length, `«${et}» es demasiado larga para el muro`).toBeLessThanOrEqual(24)
    }
    expect(Math.max(...peor.motivos.map((m) => m.length))).toBeGreaterThan(100)
  })

  it('⚠️ y NO son un resumen que pierda casos: van las seis', () => {
    // Esconder motivos tras un desplegable esta prohibido -«el motivo ES la
    // accion»-. Esto no es esconder: es la misma lista, mas corta.
    const junto = peor.etiquetas.join(' | ')
    for (const clave of ['parada', 'odometría', 'RVR', 'atasco', 'batería', 'temperatura']) {
      expect(junto, `falta «${clave}» en las etiquetas`).toContain(clave)
    }
  })
})
