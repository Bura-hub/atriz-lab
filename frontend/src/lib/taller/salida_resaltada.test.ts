import { describe, expect, it } from 'vitest'
import { clasificar, hayTraza, segmentar, type ClaseLinea } from './salida_resaltada'

const lineasDe = (t: string) => t.split('\n')

/** Las clases de cada linea, para leerlas de un vistazo en la asercion. */
const clasesDe = (t: string) => clasificar(lineasDe(t))

/**
 * Una traza REAL de este proyecto: `avanzar()` rechazando una velocidad.
 *
 * Copiada de la forma que Python 3.12 emite, con la linea de codigo repetida y
 * el subrayado `^^^` que trae desde la 3.11.
 */
const TRAZA_VALOR = `Traceback (most recent call last):
  File "/home/sphero/practicas/01_avanzar.py", line 12, in <module>
    robot.avanzar(9.0, 3)
    ~~~~~~~~~~~~~^^^^^^^^
  File "/home/sphero/atriz_ws/src/Atriz_rvr/scripts/estudiantes/atriz.py", line 412, in avanzar
    raise ValueError('la velocidad no puede pasar de 0.40 m/s')
ValueError: la velocidad no puede pasar de 0.40 m/s`

/** Ctrl-C a mitad de un avance: la practica 99 entera vive de esto. */
const TRAZA_CTRL_C = `Traceback (most recent call last):
  File "/home/sphero/practicas/01_avanzar.py", line 12, in <module>
    robot.avanzar(0.20, 3)
KeyboardInterrupt`

/** Un parentesis sin cerrar: el `SyntaxError` no lleva `, in ...`. */
const TRAZA_SINTAXIS = `  File "/home/sphero/practicas/03_cuadrado.py", line 8
    robot.avanzar(0.20, 2
                 ^
SyntaxError: '(' was never closed`

describe('el color de la salida, deducido de su FORMA', () => {
  describe('una traza de Python, linea por linea', () => {
    it('reconoce las cinco piezas de una traza normal', () => {
      expect(clasesDe(TRAZA_VALOR)).toEqual<ClaseLinea[]>([
        'traza_cabecera',
        'traza_fichero',
        'traza_codigo',
        'traza_marca',
        'traza_fichero',
        'traza_codigo',
        'traza_error',
      ])
    })

    it('🔴 `KeyboardInterrupt` es el error, aunque no lleve dos puntos', () => {
      // Es el caso mas frecuente del aula: el alumno pulsa Ctrl-C. Un patron que
      // buscara `Nombre: mensaje` lo dejaria sin pintar justo aqui.
      const c = clasesDe(TRAZA_CTRL_C)
      expect(c[c.length - 1]).toBe('traza_error')
    })

    it('un `SyntaxError` no trae `, in ...` y se reconoce igual', () => {
      // 🔴 Y ademas no lleva cabecera `Traceback`: Python la omite cuando el
      //    fichero ni siquiera compila. Sin cabecera no hay traza que abrir, asi
      //    que estas lineas salen LLANAS — es una limitacion, no un acierto.
      expect(clasesDe(TRAZA_SINTAXIS).every((c) => c === 'normal')).toBe(true)
    })

    it('las excepciones encadenadas no se cortan por la mitad', () => {
      const t = `Traceback (most recent call last):
  File "a.py", line 1, in <module>
    abrir()
FileNotFoundError: no existe

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "a.py", line 3, in <module>
    rescatar()
RuntimeError: tampoco se pudo rescatar`
      const c = clasesDe(t)
      // Las DOS lineas de error se marcan, no solo la ultima.
      expect(c.filter((x) => x === 'traza_error')).toHaveLength(2)
      expect(c.filter((x) => x === 'traza_cabecera')).toHaveLength(3)  // 2 + el enlace
    })

    it('tras el error se vuelve a texto llano', () => {
      const t = `${TRAZA_CTRL_C}\nAdiós.\nHasta luego.`
      const c = clasesDe(t)
      expect(c.slice(-2)).toEqual<ClaseLinea[]>(['normal', 'normal'])
    })
  })

  describe('🔴 LOS CONTROLES NEGATIVOS: lo que NO es una traza', () => {
    it('un programa que solo imprime sale entero en llano', () => {
      const t = 'Avanzando 60 cm...\n  rojo verde azul\n  120    45    12\nListo.'
      expect(clasesDe(t).every((c) => c === 'normal')).toBe(true)
      expect(hayTraza(lineasDe(t))).toBe(false)
    })

    it('🔴 `ValueError: …` suelto NO se pinta como error', () => {
      // Sin el estado, esta linea seria indistinguible del final de una traza. Es
      // exactamente lo que imprime un alumno que captura su excepcion y la enseña.
      const t = 'ValueError: la velocidad no puede pasar de 0.40 m/s'
      expect(clasesDe(t)).toEqual<ClaseLinea[]>(['normal'])
    })

    it('🔴 LO QUE LAS PRACTICAS IMPRIMEN DE VERDAD, sin marcar ni una', () => {
      // Sacadas de `Atriz_rvr/scripts/estudiantes/*.py` el 2026-08-15. No son
      // ejemplos mios: son la salida que un alumno ve cuando TODO va bien.
      //
      // Las tres primeras estan en la COLUMNA CERO y llevan DOS PUNTOS, que es
      // exactamente la forma de la ultima linea de una traza. Y la tercera
      // empieza por la palabra «Error» **siendo una medida que salio BIEN** — es
      // lo que la practica 04 imprime cuando el giro acierta. Marcarla seria
      // decirle al alumno que se rompio algo justo cuando no se rompio nada.
      const t = [
        'AVISO: el barrido del LIDAR ya estaba encendido (¿navegacion en marcha?)',
        'Bateria: 7,95 V',
        'Error del lazo cerrado: 0.3 grados',
        'Giro 89.8 grados de verdad.',
        'Ejemplo:  python3 23_tren_de_robots.py baliza 0 1',
        '  esquina: 90.1 grados',
        '  no puedo leer los sensores: timeout',
        '  📨 3: «gira a la derecha»',
        'Listo.',
      ]
      expect(clasificar(t)).toEqual<ClaseLinea[]>(t.map(() => 'normal'))
      expect(hayTraza(t)).toBe(false)
    })

    it('✅ Y LA OTRA MITAD: un nombre inventado SI se marca DENTRO de una traza', () => {
      // Sin este par, «no marca la salida corriente» lo cumpliria una funcion que
      // no marca nada nunca. Y ademas fija la ventaja de mirar la POSICION y no
      // el NOMBRE: `MiFalloDelRobot` no acaba en «Error» ni existe en Python —
      // podria definirla un alumno— y aun asi se reconoce.
      expect(clasificar([
        'Traceback (most recent call last):',
        '  File "/home/sphero/practicas/07_patrulla.py", line 3, in <module>',
        'MiFalloDelRobot: la oruga izquierda no gira',
      ])[2]).toBe('traza_error')
    })

    it('🔴 texto INDENTADO fuera de una traza tampoco es codigo', () => {
      const t = '  File "esto no es una traza", line 1, in ninguna_parte'
      expect(clasesDe(t)).toEqual<ClaseLinea[]>(['normal'])
    })

    it('la cabecera tiene que ser la linea ENTERA, no un prefijo', () => {
      const t = 'Traceback (most recent call last): lo explico en clase\nsigo aquí'
      expect(clasesDe(t).every((c) => c === 'normal')).toBe(true)
    })

    it('⚠️ EL LIMITE DECLARADO: si el alumno la imprime EXACTA, cuela', () => {
      // No se puede distinguir —es el mismo texto byte a byte— y por eso la
      // pantalla dice de donde sale el color en vez de presentarlo como un hecho.
      const t = "Traceback (most recent call last):\nesto lo escribí yo"
      expect(clasesDe(t)[0]).toBe('traza_cabecera')
    })
  })

  describe('🔴 LA INVARIANTE: ni una linea de mas ni de menos', () => {
    it.each([
      ['vacio', ''],
      ['una linea', 'hola'],
      ['lineas en blanco', 'a\n\n\nb'],
      ['una traza', TRAZA_VALOR],
      ['traza y texto', `antes\n${TRAZA_VALOR}\ndespués`],
      ['CRLF', 'a\r\nb\r\n'],
    ])('%s: una clase por linea', (_n, t) => {
      const l = lineasDe(t)
      expect(clasificar(l)).toHaveLength(l.length)
    })

    it.each([
      ['vacio', ''],
      ['solo llano', 'a\nb\nc'],
      ['una traza', TRAZA_VALOR],
      ['traza en medio', `antes\n${TRAZA_VALOR}\ndespués\ny más`],
    ])('%s: segmentar reconstruye el texto exacto', (_n, t) => {
      expect(segmentar(lineasDe(t)).map((s) => s.texto).join('\n')).toBe(t)
    })
  })

  describe('🔴 EL COSTE: agrupar es lo que evita 4000 elementos', () => {
    it('un programa SIN trazas devuelve UN SOLO segmento', () => {
      // Es la propiedad que importa: la salida normal deja el DOM igual que hoy
      // —un nodo de texto— con el robot en marcha y el alumno teniendo que poder
      // pulsar Parar.
      const muchas = Array.from({ length: 4000 }, (_, i) => `fila ${i}`)
      const s = segmentar(muchas)
      expect(s).toHaveLength(1)
      expect(s[0].clase).toBe('normal')
    })

    it('una traza cuesta sus lineas, y el resto sigue agrupado', () => {
      const lineas = [
        ...Array.from({ length: 500 }, (_, i) => `fila ${i}`),
        ...lineasDe(TRAZA_CTRL_C),
        ...Array.from({ length: 500 }, (_, i) => `después ${i}`),
      ]
      // 1 bloque llano + 4 lineas de traza + 1 bloque llano.
      expect(segmentar(lineas)).toHaveLength(6)
    })

    it('4000 lineas se clasifican en menos de 50 ms', () => {
      // ⚠️ Es una COTA, no una medida del aula: aquí corre en Node sobre un PC.
      //    Sirve para que una regresión de orden de magnitud se vea, no para
      //    prometer un número.
      const muchas = Array.from({ length: 4000 }, (_, i) =>
        i % 100 === 0 ? 'Traceback (most recent call last):' : `fila ${i}`)
      const t0 = performance.now()
      segmentar(muchas)
      expect(performance.now() - t0).toBeLessThan(50)
    })
  })
})
