/**
 * LA SALIDA DEL PROGRAMA, clasificada por su FORMA. Pura — sin React ni DOM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 AQUI NO LLEGAN COLORES DE TERMINAL, Y POR ESO ESTO EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * El agente arranca al programa del alumno con `TERM='dumb'`
 * (`agente_nucleo.py:450`), a proposito: *«evita que una biblioteca decida
 * pintar colores o mover el cursor»*. Lo que llega al navegador es texto pelado,
 * sin una sola secuencia de escape.
 *
 * O sea que el color de esta pantalla **no viene del robot: se deduce aqui**, y
 * lo unico que hay para deducirlo es la forma de cada linea. Una traza de Python
 * tiene una forma muy reconocible; un `print()` cualquiera no tiene ninguna.
 *
 * ⚠️ **ES UNA HEURISTICA, Y SE DICE EN PANTALLA.** Un alumno que escriba
 *    `print('Traceback (most recent call last):')` vera su linea pintada como si
 *    fuera una traza. No hay forma de distinguirlo —es literalmente el mismo
 *    texto— y callarlo seria peor: en este proyecto una pantalla que afirma mas
 *    de lo que sabe ya ha costado caro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE LLEVA ESTADO, SI «UNA LINEA CADA VEZ» SERIA MAS SIMPLE
 * ═══════════════════════════════════════════════════════════════════════════
 * Porque dos de las cinco clases **no se pueden reconocer sueltas**:
 *
 *   · La linea de codigo que Python repite bajo cada `File "..."` es texto
 *     indentado, exactamente igual que cualquier `print()` con sangria.
 *   · `ValueError: no cabe` en la columna 0 es indistinguible de un
 *     `print('ValueError: no cabe')` del alumno.
 *
 * Dentro de una traza sí se sabe qué son. Fuera, no. El estado es un solo
 * booleano y el recorrido es de una pasada, asi que no cuesta nada.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y POR QUE `segmentar()` JUNTA LAS LINEAS LLANAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Hoy la salida es **un solo nodo de texto** con hasta 4000 lineas
 * (`TOPE_LINEAS_PANTALLA`), que es baratisimo de pintar. Emitir un elemento por
 * linea lo convertiria en 4000 elementos redibujados en cada trozo del PTY — a
 * 10 Hz en el seguidor de linea, **con el robot en marcha y el alumno teniendo
 * que poder pulsar Parar**.
 *
 * Por eso el coste se hace proporcional al **numero de trazas**, no al de
 * lineas: un programa que no falla devuelve UN segmento y el DOM queda
 * exactamente como esta hoy. Hay una prueba que lo fija.
 */

/**
 * Lo que puede ser una linea de la salida.
 *
 * 📝 `traza_marca` son los `^^^^` que Python 3.11+ dibuja bajo el trozo exacto
 *    que fallo. Van aparte porque son la informacion mas util de toda la traza y
 *    merecen la tinta del error, no la del codigo.
 */
export type ClaseLinea =
  | 'normal'
  | 'traza_cabecera'
  | 'traza_fichero'
  | 'traza_codigo'
  | 'traza_marca'
  | 'traza_error'

/** `Traceback (most recent call last):`, exacto y en la columna 0. */
const CABECERA = 'Traceback (most recent call last):'

/**
 * Las dos frases con las que Python encadena excepciones.
 *
 * Aparecen ENTRE dos trazas, en la columna 0 y sin sangria, asi que sin esto
 * cerrarian la traza y se leerian como el mensaje de error.
 */
const ENLACES: readonly string[] = [
  'During handling of the above exception, another exception occurred:',
  'The above exception was the direct cause of the following exception:',
]

/**
 * `  File "loquesea", line 12, in avanzar` — y tambien sin el `, in ...`, que es
 * como salen los `SyntaxError`.
 */
const FICHERO = /^\s+File ".*", line \d+(, in .*)?$/

/** Una linea de solo `^`, `~` y espacios: el subrayado de Python 3.11+. */
const SOLO_MARCAS = /^\s*[\^~]+[\^~\s]*$/

/**
 * Clasifica cada linea, en una pasada y con el contexto de la anterior.
 *
 * 🔴 DEVUELVE EXACTAMENTE UNA CLASE POR LINEA DE ENTRADA. Si devolviera menos, la
 *    salida se pintaria desplazada respecto al texto — el mismo fallo que la
 *    invariante del tokenizador del editor previene, por el otro lado.
 */
export function clasificar(lineas: readonly string[]): ClaseLinea[] {
  const clases: ClaseLinea[] = []
  let dentro = false

  for (const cruda of lineas) {
    // El PTY puede traer CRLF; el `\r` no cambia lo que la linea ES.
    const l = cruda.endsWith('\r') ? cruda.slice(0, -1) : cruda

    if (l === CABECERA) {
      clases.push('traza_cabecera')
      dentro = true
      continue
    }

    // 🔴 EL ENLACE SE MIRA ANTES DEL ESTADO, y lo destapo una prueba: llega
    //    DESPUES de que la traza de arriba se cerro con su linea de error, o sea
    //    con `dentro` ya en falso. Mirandolo dentro del bloque de estado, la
    //    frase salia llana en medio de dos trazas. Se reconoce sola sin riesgo:
    //    es una linea entera y literal, igual que la cabecera.
    //    📝 Y NO abre traza: de eso se encarga la cabecera que viene detras.
    if (ENLACES.includes(l)) {
      clases.push('traza_cabecera')
      continue
    }

    if (!dentro) {
      clases.push('normal')
      continue
    }

    // ── A partir de aqui, estamos DENTRO de una traza ──────────────────────
    if (l.trim() === '') {
      // Python deja una linea en blanco entre trazas encadenadas. No la cuenta
      // como texto del programa, pero tampoco cierra nada.
      clases.push('normal')
      continue
    }

    if (FICHERO.test(l)) {
      clases.push('traza_fichero')
      continue
    }

    if (/^\s/.test(l)) {
      clases.push(SOLO_MARCAS.test(l) ? 'traza_marca' : 'traza_codigo')
      continue
    }

    // 🔴 Sin sangria y con contenido: en una traza de Python eso SOLO puede ser
    //    la ultima linea, la del error. Y se reconoce asi —por la posicion— y no
    //    por el nombre: `KeyboardInterrupt` no lleva dos puntos ni acaba en
    //    «Error», y una excepcion definida por un alumno puede llamarse como
    //    quiera. Un patron de nombres dejaria fuera justo los casos del aula.
    clases.push('traza_error')
    dentro = false
  }

  return clases
}

export interface Segmento {
  clase: ClaseLinea
  /** Una o varias lineas ya unidas con `\n`. Solo `normal` agrupa varias. */
  texto: string
}

/**
 * Lo mismo, pero juntando las lineas llanas consecutivas en un solo trozo.
 *
 * 🔴 INVARIANTE: `segmentar(l).map(s => s.texto).join('\n') === l.join('\n')`.
 *    Es lo que garantiza que agrupar no se coma ni añada una linea.
 */
export function segmentar(lineas: readonly string[]): Segmento[] {
  const clases = clasificar(lineas)
  const salida: Segmento[] = []

  for (let i = 0; i < lineas.length; i++) {
    const clase = clases[i]
    const ultimo = salida[salida.length - 1]
    if (clase === 'normal' && ultimo !== undefined && ultimo.clase === 'normal') {
      ultimo.texto += `\n${lineas[i]}`
    } else {
      salida.push({ clase, texto: lineas[i] })
    }
  }

  return salida
}

/**
 * ¿Hay alguna traza aqui?
 *
 * Sirve para decidir si merece la pena enseñar la frase que explica de donde
 * sale el color. Si no hay ninguna, no hay nada que explicar.
 */
export const hayTraza = (lineas: readonly string[]): boolean =>
  clasificar(lineas).some((c) => c !== 'normal')
