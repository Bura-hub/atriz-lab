import { describe, expect, it } from 'vitest'
import { leerMensaje } from './protocolo'
import {
  type EstadoTaller,
  TALLER_INICIAL, entradaViva, insigniaDelTerminal, puedeEjecutar,
  textoCambiadoDesdeElLanzamiento, tras, trasCerrar,
} from './sesion_taller'

/** Encadena mensajes crudos sobre el estado inicial, como llegarian del socket. */
const correr = (...crudos: Record<string, unknown>[]) =>
  crudos.reduce((e, c) => tras(e, leerMensaje(JSON.stringify(c))), TALLER_INICIAL)

const bienvenida = (extra: Record<string, unknown> = {}) => ({
  op: 'atriz_bienvenida', robot: 7, sujeto: 'ana', reloj_fiable: true,
  directorio: '/home/sphero/estudiantes', sesion: null, ...extra,
})

const corriendoMia = {
  op: 'atriz_estado', estado: 'CORRIENDO', sujeto: 'ana', soy_el_dueno: true,
  pid: 4711, nombre: '01_avanzar.py', huella: 'abc123def456', restante_s: 540,
}

describe('el enlace', () => {
  it('la bienvenida abre y trae quién soy según el ROBOT', () => {
    const e = correr(bienvenida())
    expect(e.enlace).toBe('ABIERTO')
    expect(e.robot).toBe(7)
    expect(e.sujeto).toBe('ana')
    expect(puedeEjecutar(e).puede).toBe(true)
  })

  it('🔴 cerrar NO borra la ejecución en marcha', () => {
    /*
     * Es la mentira más cara que puede decir esta pantalla. El proceso vive en
     * su propia sesión y sobrevive al socket: borrarlo al perder la conexión
     * haría creer que el programa paró, con el robot todavía moviéndose.
     */
    const vivo = correr(bienvenida(), corriendoMia)
    expect(vivo.ejecucion?.pid).toBe(4711)
    const cerrado = trasCerrar(vivo, 'se cortó')
    expect(cerrado.ejecucion?.pid).toBe(4711)
    expect(cerrado.enlace).toBe('RECHAZADO')
  })
})

describe('🔴 el robot ocupado por otro', () => {
  const conLuis = correr(bienvenida({
    sesion: { sujeto: 'luis', estado: 'CORRIENDO', pid: 900, nombre: '03_cuadrado.py', desde_s: 200 },
  }))

  it('no se puede ejecutar, y el motivo dice QUIÉN y CON QUÉ', () => {
    // Un «ocupado» a secas deja al segundo mirando sin saber a quién buscar.
    const v = puedeEjecutar(conLuis)
    expect(v.puede).toBe(false)
    expect(v.motivo).toContain('luis')
    expect(v.motivo).toContain('03_cuadrado.py')
  })

  it('🔴 y NO se toma como ejecución propia: no ofrece pararla', () => {
    expect(conLuis.ejecucion).toBeNull()
    expect(entradaViva(conLuis).viva).toBe(false)
  })

  it('🔴 un rechazo por ocupado NO cierra el enlace', () => {
    /*
     * Cerrar dejaría al segundo alumno sin ver de quién es el robot, que es
     * justo lo que hay que enseñarle.
     */
    const e = tras(conLuis, leerMensaje(JSON.stringify({
      op: 'atriz_rechazo', codigo: 'OCUPADO', motivo: 'lo tiene luis',
    })))
    expect(e.enlace).toBe('ABIERTO')
    expect(e.rechazo?.codigo).toBe('OCUPADO')
  })
})

describe('🔴 el reenganche: la ejecución en marcha es MÍA', () => {
  const reenganche = correr(bienvenida({
    sesion: { sujeto: 'ana', estado: 'CORRIENDO', pid: 4711, nombre: '05_sensor_color.py', desde_s: 30 },
  }))

  it('se recupera como propia, no como «robot ocupado»', () => {
    /*
     * Pasa al recargar la página o al volver de una caída de red. Tratarlo como
     * ocupado convertiría un F5 en diez minutos de espera contra el propio robot,
     * y el alumno no tendría forma de parar su propio programa.
     */
    expect(reenganche.ejecucion?.pid).toBe(4711)
    expect(reenganche.ejecucion?.nombre).toBe('05_sensor_color.py')
    expect(entradaViva(reenganche).viva).toBe(true)
  })

  it('y no se puede lanzar otro encima', () => {
    const v = puedeEjecutar(reenganche)
    expect(v.puede).toBe(false)
    expect(v.motivo).toMatch(/ya tienes/i)
  })
})

describe('la ejecución propia', () => {
  it('el estado trae PID y lo que queda, y lo que queda lo dice el AGENTE', () => {
    const e = correr(bienvenida(), corriendoMia)
    expect(e.ejecucion?.pid).toBe(4711)
    expect(e.ejecucion?.restanteS).toBe(540)
  })

  it('🔴 al terminar se guarda el desenlace y se suelta la ranura', () => {
    const e = correr(bienvenida(), corriendoMia, {
      op: 'atriz_fin', motivo: 'SENAL', senal: 'SIGINT', codigo: null, duracion_s: 12,
      efecto: { scan_llegaba: true, stop_scan_llamado: true, odom_max_lineal: 0 },
    })
    expect(e.ejecucion).toBeNull()
    expect(puedeEjecutar(e).puede).toBe(true)
    // El resultado se conserva: es lo que el alumno mira después.
    expect(e.desenlace?.senal).toBe('SIGINT')
    expect(e.desenlace?.efecto?.stopScanLlamado).toBe(true)
  })

  it('🔴 el desenlace NO resume el efecto en «todo bien»', () => {
    /*
     * Que un programa termine no dice que el robot se haya quedado quieto. Lo
     * dice `efecto`, que lo mide el agente después — y sus campos pueden decir
     * «no lo sé», que no es «no pasa».
     */
    const e = correr(bienvenida(), corriendoMia, {
      op: 'atriz_fin', motivo: 'SALIDA_NORMAL', codigo: 0, duracion_s: 3,
    })
    expect(e.desenlace?.efecto).toBeNull()
  })

  it('el recorte actualiza el contador sin tocar nada más', () => {
    const e = correr(bienvenida(), corriendoMia, {
      op: 'atriz_recorte', lineas_descartadas: 4210, bytes_descartados: 900000,
    })
    expect(e.ejecucion?.lineasDescartadas).toBe(4210)
    expect(e.ejecucion?.pid).toBe(4711)
  })
})

describe('la línea de entrada', () => {
  it('🔴 sin programa corriendo NO está viva, y el motivo ya no miente', () => {
    /*
     * Decía «no hay nada al otro lado», que era cierto cuando el agente no
     * existía. Ahora el agente existe: el motivo es que no hay programa.
     */
    const m = entradaViva(TALLER_INICIAL)
    expect(m.viva).toBe(false)
    expect(m.motivo).toMatch(/ningún programa corriendo/i)
    expect(m.motivo).not.toMatch(/al otro lado/i)
  })

  it('viva mientras corre; muerta mientras se para', () => {
    expect(entradaViva(correr(bienvenida(), corriendoMia)).viva).toBe(true)
    const parando = correr(bienvenida(), { ...corriendoMia, estado: 'PARANDO' })
    expect(entradaViva(parando).viva).toBe(false)
  })
})

describe('🔴 lo que llega y no se entiende', () => {
  it('no corrompe el estado, y se guarda para poder verlo', () => {
    const e = correr(bienvenida(), corriendoMia, { op: 'atriz_cosa_del_futuro', x: 1 })
    expect(e.ejecucion?.pid).toBe(4711)
    expect(e.sinEntender[0]).toContain('atriz_cosa_del_futuro')
  })

  it('no crece sin freno', () => {
    let e = correr(bienvenida())
    for (let i = 0; i < 20; i += 1) e = tras(e, { clase: 'DESCONOCIDO', crudo: `n${i}` })
    expect(e.sinEntender.length).toBeLessThanOrEqual(5)
    expect(e.sinEntender.at(-1)).toBe('n19')
  })
})

describe('🔴 el texto cambiado desde que se lanzó', () => {
  it('lo detecta, para no dejar creer que corre lo que se ve', () => {
    const e = correr(bienvenida(), corriendoMia)
    expect(textoCambiadoDesdeElLanzamiento(e, 'abc123def456')).toBe(false)
    expect(textoCambiadoDesdeElLanzamiento(e, 'otra_huella1')).toBe(true)
  })

  it('sin ejecución no afirma nada', () => {
    expect(textoCambiadoDesdeElLanzamiento(TALLER_INICIAL, 'x')).toBe(false)
  })
})

describe('el reloj de la Pi', () => {
  it('🔴 «sin hora» se propaga como dato, no como fallo', () => {
    // La Pi no tiene RTC: arranca con el reloj en el pasado hasta que NTP
    // contesta. No es culpa de nadie y se arregla esperando.
    const e = correr(bienvenida({ reloj_fiable: false }))
    expect(e.relojFiable).toBe(false)
    expect(e.enlace).toBe('ABIERTO')
  })
})

describe('🔴 la insignia no puede decir «listo» sin saberlo', () => {
  /*
   * Encontrado EN EL NAVEGADOR el 2026-08-15, entrando sin sesion: el aviso
   * decia «hay que iniciar sesion para abrir el terminal» y la insignia de al
   * lado ponia **listo**. Era un ternario `corriendo ? ... : 'listo'` dentro del
   * JSX, o sea un binario donde hacen falta tres estados.
   *
   * Ninguna de las 740 pruebas lo vio, porque ninguna miraba esa insignia.
   */
  const con = (enlace: EstadoTaller['enlace'], ejecutando = false): EstadoTaller => ({
    ...TALLER_INICIAL,
    enlace,
    ejecucion: ejecutando
      ? { estado: 'CORRIENDO', pid: 42, nombre: 'x.py', huella: '', restanteS: null, lineasDescartadas: 0 }
      : null,
  })

  it('sin enlace NO dice «listo»: dice que no hay enlace', () => {
    for (const fase of ['CERRADO', 'RECHAZADO'] as const) {
      const i = insigniaDelTerminal(con(fase))
      expect(i.texto).not.toBe('listo')
      expect(i.texto).toBe('sin enlace')
      expect(i.tono).toBe('ATENCION')
    }
  })

  it('mientras abre, tampoco: «conectando»', () => {
    expect(insigniaDelTerminal(con('ABRIENDO')).texto).toBe('conectando')
  })

  it('con el enlace ABIERTO y nada corriendo, ahi si: «listo»', () => {
    // El control positivo. Sin el, «no dice listo» no distinguiria el arreglo
    // de haber borrado la palabra.
    expect(insigniaDelTerminal(con('ABIERTO')).texto).toBe('listo')
  })

  it('lo que corre manda sobre todo lo demas', () => {
    expect(insigniaDelTerminal(con('ABIERTO', true)).texto).toBe('corriendo')
    expect(insigniaDelTerminal(con('ABIERTO', true)).tono).toBe('ATENCION')
  })
})
