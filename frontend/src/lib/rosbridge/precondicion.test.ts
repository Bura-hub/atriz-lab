import { describe, expect, it } from 'vitest'
import { evaluarPrecondicion, hayQueAvisar, type Precondicion } from './precondicion'

/** El caso normal de un alumno con la sesión abierta. */
const BIEN = { exigido: true, usuario: 'bura_hub', cargando: false }

describe('lo que tiene que pasar antes de que un socket pueda abrir', () => {
  describe('🔴 EL CASO QUE OCURRIO EL 2026-08-16', () => {
    it('sin sesión y con los robots exigiendo testigo, lo dice', () => {
      const p = evaluarPrecondicion({ exigido: true, usuario: null, cargando: false })
      expect(p.estado).toBe('SIN_SESION')
    })

    it('🔴 y NO acusa a los robots: lo dice explícitamente', () => {
      // Es el fallo entero. El robot estaba perfecto —servicios arriba, RVR
      // hablando, la puerta verificada en las dos direcciones— y la pantalla
      // pintaba dieciséis «sin señal de vida». Quien lo leyó cruzó el
      // laboratorio a mirar un robot que no tenía nada.
      const p = evaluarPrecondicion({ exigido: true, usuario: null, cargando: false })
      if (p.estado !== 'SIN_SESION') throw new Error('debería faltar la sesión')
      expect(p.mensaje).toMatch(/no dice nada sobre los robots|pueden estar perfectamente/i)
    })

    it('y da a dónde ir, no solo el diagnóstico', () => {
      const p = evaluarPrecondicion({ exigido: true, usuario: null, cargando: false })
      if (p.estado !== 'SIN_SESION') throw new Error('debería faltar la sesión')
      /*
       * 📝 Era `/entrar` hasta el 2026-08-16, cuando la portada y la entrada se
       *    fundieron en una sola pantalla (decisión del usuario: eran dos
       *    páginas para una sola cosa). `/entrar` sigue existiendo y redirige
       *    aquí, así que el valor viejo también funcionaría — pero este aviso se
       *    pinta en el muro y en cada robot, y un enlace que pasa por una
       *    redirección es un salto que se ve.
       *
       * 🔴 Lo que la prueba comprueba NO cambia: que haya **a dónde ir**. Un
       *    diagnóstico sin remedio es la mitad de un aviso.
       */
      expect(p.enlace).toBe('/')
    })
  })

  describe('✅ EL CONTROL POSITIVO: con sesión no molesta', () => {
    // Sin esto, «avisa cuando falta la sesión» lo cumpliría una función que
    // avisa siempre, y el aviso se volvería ruido permanente.
    it('con sesión, LISTO', () => {
      expect(evaluarPrecondicion(BIEN).estado).toBe('LISTO')
    })

    it('y con un robot concreto, también', () => {
      for (const robot of [1, 8, 16]) {
        expect(evaluarPrecondicion({ ...BIEN, destino: robot }).estado, String(robot)).toBe('LISTO')
      }
    })
  })

  describe('🔴 EL HUECO DE MEDIO SEGUNDO, que se vio en pantalla', () => {
    /*
     * `hayQueAvisar(NO_SE_SABE)` es `false` —correcto: no se pinta un aviso
     * mientras la sesion carga—, pero el muro lo estaba usando para decidir si
     * podia acusar a los robots. Y los dieciseis sockets fallan mucho ANTES que
     * la sesion: los nombres `rvr-02..16` no resuelven y cierran al instante.
     *
     * Medido el 2026-08-16 con el guion de capturas: a los 3,5 s el muro pintaba
     * «Ningún robot responde» y a los ~6 s se corregia solo. Quien abre la
     * pagina lee primero la causa equivocada.
     */
    it('«no hay que avisar» NO significa «se puede acusar al robot»', () => {
      const cargando = evaluarPrecondicion({ exigido: true, usuario: null, cargando: true })
      // Las dos cosas a la vez, y esa es la trampa entera:
      expect(hayQueAvisar(cargando)).toBe(false)
      expect(cargando.estado).not.toBe('LISTO')
    })

    it('✅ y con sesion SI se puede: LISTO es lo unico que lo autoriza', () => {
      expect(evaluarPrecondicion(BIEN).estado).toBe('LISTO')
    })
  })

  describe('🔴 NO SABER NO ES UN NO', () => {
    it('mientras la sesión carga, NO_SE_SABE', () => {
      // Acusar antes de saber pinta un aviso rojo que aparece y desaparece en
      // cada carga de cada página. Misma regla que el `null` de /estado_robot.
      const p = evaluarPrecondicion({ exigido: true, usuario: null, cargando: true })
      expect(p.estado).toBe('NO_SE_SABE')
    })

    it('y NO_SE_SABE no se enseña', () => {
      expect(hayQueAvisar({ estado: 'NO_SE_SABE' })).toBe(false)
    })
  })

  describe('sin el interruptor, nada cambia', () => {
    it('con `exigido` en falso, siempre LISTO', () => {
      // Un despliegue con robots sin parchear: el transporte abre como siempre y
      // esta comprobación no puede inventarse un problema.
      for (const usuario of [null, 'bura_hub']) {
        for (const cargando of [true, false]) {
          expect(evaluarPrecondicion({ exigido: false, usuario, cargando }).estado)
            .toBe('LISTO')
        }
      }
    })
  })

  describe('🔴 UN ROBOT PUESTO POR DIRECCION: entrar NO lo arregla', () => {
    it('lo dice, y no manda a iniciar sesión', () => {
      // A una IP no se le puede firmar un testigo —lleva `rob` dentro, y una
      // dirección no tiene número que comparar—. Mandar a entrar sería el
      // consejo equivocado: se entra, y sigue sin funcionar.
      const p = evaluarPrecondicion({ ...BIEN, destino: '192.168.1.200' })
      expect(p.estado).toBe('POR_DIRECCION')
    })

    it('🔴 y gana al «falta la sesión», aunque falten las dos', () => {
      // El orden importa: si se dijera «entra» a quien además tiene una IP
      // puesta, entraría y volvería a fallar sin más explicación.
      const p = evaluarPrecondicion({
        exigido: true, usuario: null, cargando: false, destino: '10.14.7.7',
      })
      expect(p.estado).toBe('POR_DIRECCION')
    })

    it('un nombre de máquina cuenta como dirección', () => {
      expect(evaluarPrecondicion({ ...BIEN, destino: 'rvr-01.local' }).estado)
        .toBe('POR_DIRECCION')
    })

    it('✅ EL CONTROL: un número dentro de la flota NO es una dirección', () => {
      // Sin esto, «detecta direcciones» pasaría con algo que lo marca todo.
      expect(evaluarPrecondicion({ ...BIEN, destino: 1 }).estado).toBe('LISTO')
      // Y un número FUERA de 1..16 sí lo es: no hay robot 17 al que firmarle.
      expect(evaluarPrecondicion({ ...BIEN, destino: 17 }).estado).toBe('POR_DIRECCION')
      expect(evaluarPrecondicion({ ...BIEN, destino: 0 }).estado).toBe('POR_DIRECCION')
    })
  })

  describe('sin destino, solo mira la sesión —que es lo que el muro necesita', () => {
    it('el muro lo dice UNA vez, no dieciséis', () => {
      // Dieciséis errores idénticos no dicen «te falta la sesión»: dicen «el
      // laboratorio está caído».
      const p = evaluarPrecondicion({ exigido: true, usuario: null, cargando: false })
      expect(p.estado).toBe('SIN_SESION')
      expect(hayQueAvisar(p)).toBe(true)
    })
  })

  describe('`hayQueAvisar` cubre los cuatro estados', () => {
    it.each([
      ['LISTO', { estado: 'LISTO' } as Precondicion, false],
      ['NO_SE_SABE', { estado: 'NO_SE_SABE' } as Precondicion, false],
    ])('%s -> %s', (_n, p, esperado) => {
      expect(hayQueAvisar(p)).toBe(esperado)
    })

    it('los dos que sí se enseñan', () => {
      expect(hayQueAvisar(evaluarPrecondicion({
        exigido: true, usuario: null, cargando: false,
      }))).toBe(true)
      expect(hayQueAvisar(evaluarPrecondicion({
        exigido: true, usuario: 'x', cargando: false, destino: '1.2.3.4',
      }))).toBe(true)
    })
  })
})
