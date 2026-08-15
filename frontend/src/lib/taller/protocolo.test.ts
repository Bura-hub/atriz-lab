import { describe, expect, it } from 'vitest'
import {
  SENALES, leerMensaje, motivoDeCierre, opEjecutar, opEntrada, opLeer, opSenal,
} from './protocolo'

const paquete = (o: Record<string, unknown>) => JSON.stringify(o)

describe('lo que se manda', () => {
  it('🔴 ejecutar lleva SIEMPRE el código, nunca «el fichero N»', () => {
    /*
     * Es la decisión de forma del protocolo. Abrir una práctica es leerla al
     * editor y ejecutar lo que hay en el editor: un solo camino de ejecución que
     * probar, el alumno puede modificar una práctica, y la pantalla puede
     * afirmar sin adivinar que lo que corre es lo que se ve.
     */
    const o = opEjecutar('print(1)', '01_avanzar.py')
    expect(o.op).toBe('atriz_exec')
    expect(o.codigo).toBe('print(1)')
    // Y NO manda un tope si no se pide: el agente tiene el suyo, medido.
    expect('tope_pared_s' in o).toBe(false)
  })

  it('el tope solo viaja cuando alguien lo pide', () => {
    expect(opEjecutar('x', 'y.py', 900).tope_pared_s).toBe(900)
  })

  it('las cinco señales de la práctica 99 están', () => {
    // SIGINT repetido, SIGQUIT, SIGTERM, SIGHUP y el kill -9 del ejercicio 5.
    expect([...SENALES].sort())
      .toEqual(['SIGHUP', 'SIGINT', 'SIGKILL', 'SIGQUIT', 'SIGTERM'])
    expect(opSenal('SIGQUIT')).toEqual({ op: 'atriz_signal', senal: 'SIGQUIT' })
  })

  it('la entrada y la lectura llevan lo suyo y nada más', () => {
    expect(opEntrada('45.0\n')).toEqual({ op: 'atriz_stdin', texto: '45.0\n' })
    expect(opLeer('99_test_ctrl_c.py')).toEqual({ op: 'atriz_leer', fichero: '99_test_ctrl_c.py' })
  })
})

describe('leerMensaje · lo que llega', () => {
  it('la bienvenida trae quién tiene el robot, si lo tiene alguien', () => {
    const m = leerMensaje(paquete({
      op: 'atriz_bienvenida', robot: 7, sujeto: 'ana', reloj_fiable: true,
      directorio: '/home/sphero/…/estudiantes',
      sesion: { sujeto: 'luis', estado: 'CORRIENDO', pid: 4711, nombre: '03_cuadrado.py', desde_s: 200 },
    }))
    expect(m.clase).toBe('BIENVENIDA')
    if (m.clase !== 'BIENVENIDA') return
    expect(m.ocupacion?.sujeto).toBe('luis')
    expect(m.ocupacion?.pid).toBe(4711)
  })

  it('sin nadie ejecutando, la ocupación es null y no un objeto vacío', () => {
    const m = leerMensaje(paquete({ op: 'atriz_bienvenida', robot: 7, sesion: null }))
    if (m.clase !== 'BIENVENIDA') throw new Error('clase')
    expect(m.ocupacion).toBeNull()
  })

  it('🔴 `restante_s` se LEE del agente, no se calcula aquí', () => {
    /*
     * La Pi no tiene RTC: arranca con el reloj hasta 19,5 h en el pasado. Restar
     * un instante del robot de uno del navegador daría una cuenta atrás absurda
     * —o negativa— sin que nada pareciera roto.
     */
    const m = leerMensaje(paquete({ op: 'atriz_estado', estado: 'CORRIENDO', restante_s: 540 }))
    if (m.clase !== 'ESTADO') throw new Error('clase')
    expect(m.restanteS).toBe(540)
  })

  it('un `restante_s` ausente es null, que NO es cero', () => {
    // Cero significaría «se acabó el tiempo». Ausente significa «no se sabe».
    const m = leerMensaje(paquete({ op: 'atriz_estado', estado: 'CORRIENDO' }))
    if (m.clase !== 'ESTADO') throw new Error('clase')
    expect(m.restanteS).toBeNull()
  })

  it('el fin trae el efecto, y cada campo puede decir «no lo sé»', () => {
    const m = leerMensaje(paquete({
      op: 'atriz_fin', motivo: 'SENAL', senal: 'SIGKILL', duracion_s: 12,
      efecto: { scan_llegaba: true, stop_scan_llamado: true, odom_max_lineal: 0.0 },
    }))
    if (m.clase !== 'FIN') throw new Error('clase')
    expect(m.efecto?.scanLlegaba).toBe(true)
    expect(m.efecto?.stopScanLlamado).toBe(true)
    // 🔴 No mirado ≠ mirado y no pasa. `null` es un valor con significado.
    expect(m.efecto?.navegacionEnMarcha).toBeNull()
    expect(m.efecto?.odomMaxAngular).toBeNull()
  })

  it('el listado tira las entradas sin nombre en vez de inventarlas', () => {
    const m = leerMensaje(paquete({
      op: 'atriz_listado', directorio: '/x',
      ficheros: [{ nombre: '01_avanzar.py', bytes: 900 }, { bytes: 1 }, 'basura', null],
    }))
    if (m.clase !== 'LISTADO') throw new Error('clase')
    expect(m.ficheros).toEqual([{ nombre: '01_avanzar.py', bytes: 900 }])
  })
})

describe('🔴 leerMensaje NUNCA lanza', () => {
  it('la basura sale como DESCONOCIDO, con su texto', () => {
    /*
     * Lo que llega viene de fuera. Con `throw` bastaría con olvidar un `try`
     * para que un JSON tonto tumbara la pantalla MIENTRAS un programa mueve el
     * robot. Misma decisión que `abrir()` en sesion/testigo.ts.
     */
    for (const malo of ['', 'no es json', '[]', 'null', '7', '{"op":42}', '{}']) {
      const m = leerMensaje(malo)
      expect(m.clase, malo).toBe('DESCONOCIDO')
    }
  })

  it('🔴 y NO se descarta en silencio: el crudo viaja para poder pintarlo', () => {
    // Un mensaje nuevo del agente contra una web vieja tiene que poder VERSE, o
    // el síntoma es «la pantalla no hace nada» sin ninguna pista.
    const m = leerMensaje('{"op":"atriz_cosa_nueva","x":1}')
    if (m.clase !== 'DESCONOCIDO') throw new Error('clase')
    expect(m.crudo).toContain('atriz_cosa_nueva')
  })

  it('un mensaje conocido al que le faltan campos no revienta', () => {
    expect(leerMensaje('{"op":"atriz_estado"}').clase).toBe('ESTADO')
    expect(leerMensaje('{"op":"atriz_fin"}').clase).toBe('FIN')
    expect(leerMensaje('{"op":"atriz_listado"}').clase).toBe('LISTADO')
  })
})

describe('motivoDeCierre', () => {
  it('🔴 el 1013 NO se lee como «no autorizado»', () => {
    /*
     * La Pi no tiene RTC y arranca con el reloj en el pasado hasta que NTP
     * contesta, ~18 s después. Decir «no autorizado» ahí mandaría a buscar a un
     * profesor por algo que se arregla esperando.
     */
    const t = motivoDeCierre(1013)
    expect(t).toMatch(/hora/i)
    expect(t).toMatch(/espera/i)
    expect(t).not.toMatch(/autoriza/i)
  })

  it('el 4404 manda a la página del robot correcto, no a reintentar', () => {
    expect(motivoDeCierre(4404)).toMatch(/otro robot/i)
  })

  it('el 4403 dice que puede no ser culpa de quien lo lee', () => {
    // Claves distintas entre servidor y robot es un fallo de montaje, y el
    // alumno no puede hacer nada: decírselo evita que lo intente diez veces.
    expect(motivoDeCierre(4403)).toMatch(/montó el laboratorio/i)
  })

  it('el 1006 explica el cierre mudo, que es el caso más común', () => {
    expect(motivoDeCierre(1006)).toMatch(/sin decir por qué/i)
  })

  it('un código que no conocemos no inventa un motivo', () => {
    expect(motivoDeCierre(4999)).toBe('')
    expect(motivoDeCierre(1000)).toBe('')
  })
})
