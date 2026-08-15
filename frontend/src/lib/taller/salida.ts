/**
 * LA SALIDA DEL PROGRAMA, acumulada para pintarla. PURA — sin React y sin DOM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE HAY UN TOPE **TAMBIEN AQUI**, si el agente ya tiene el suyo
 * ═══════════════════════════════════════════════════════════════════════════
 * Porque son dos problemas distintos y solo uno lo resuelve el agente:
 *
 *   · El del **agente** protege el WiFi y su propia memoria: 2 MiB por
 *     ejecucion.
 *   · Este protege **el navegador**, que tiene que pintar el texto. Un `<pre>`
 *     con dos millones de caracteres bloquea la pestaña con el robot en marcha,
 *     y entonces el alumno no puede ni pulsar Parar.
 *
 * Y los dos cuentan lo descartado. **Nunca en silencio**: un programa que
 * imprime en bucle y una pantalla que dejo de actualizarse se ven igual desde
 * fuera, y este proyecto tiene medido lo que cuesta esa confusion.
 */

/**
 * Lo que se conserva en pantalla. 4000 lineas son ~20 pantallas de scroll.
 *
 * ⚠️ No es un numero medido: es una eleccion, y por eso se dice. Lo que si esta
 *    medido es la cadencia de las practicas —una fila cada 0,5 s en
 *    `05_sensor_color.py`, 10 Hz en el seguidor de linea—, o sea que 4000 lineas
 *    son ~33 min de la primera y ~7 de la segunda.
 */
export const TOPE_LINEAS_PANTALLA = 4000

export interface Salida {
  /** Las lineas que se pintan, ya recortadas por arriba. */
  lineas: readonly string[]
  /** Cuantas se han tirado del PRINCIPIO por el tope de esta pantalla. */
  perdidasArriba: number
  /** Lo que el AGENTE dijo haber descartado. Es otro numero y otra causa. */
  descartadasPorElAgente: number
  /** Lo que aun no acaba en salto de linea. Se pinta, pero puede crecer. */
  cola: string
}

export const SALIDA_VACIA: Salida = {
  lineas: [],
  perdidasArriba: 0,
  descartadasPorElAgente: 0,
  cola: '',
}

/**
 * Añade un trozo tal como llega del PTY.
 *
 * 🔴 EL TROZO NO VIENE PARTIDO POR LINEAS, y por eso hay `cola`. El PTY se lee
 *    por bloques: un `print()` puede llegar en dos pedazos, y el segundo puede
 *    tardar. Pintar solo lo que acaba en `\n` dejaria la ultima linea invisible
 *    — justo la que el alumno esta esperando cuando el programa le pregunta algo
 *    con `input()`, porque **el aviso de `input()` no lleva salto de linea**.
 */
export function anadir(s: Salida, trozo: string): Salida {
  if (trozo === '') return s

  const entero = s.cola + trozo
  const partes = entero.split('\n')
  // El ultimo pedazo no acabo en `\n`: se queda de cola.
  const cola = partes.pop() ?? ''
  if (partes.length === 0) return { ...s, cola }

  const juntas = [...s.lineas, ...partes]
  if (juntas.length <= TOPE_LINEAS_PANTALLA) {
    return { ...s, lineas: juntas, cola }
  }
  const sobran = juntas.length - TOPE_LINEAS_PANTALLA
  return {
    ...s,
    lineas: juntas.slice(sobran),
    perdidasArriba: s.perdidasArriba + sobran,
    cola,
  }
}

/** Lo que el agente dice haber recortado. Es SU contador, no el de aqui. */
export function conRecorteDelAgente(s: Salida, descartadas: number): Salida {
  return { ...s, descartadasPorElAgente: descartadas }
}

/**
 * Cierra la cola cuando el programa termina.
 *
 * Sin esto, la ultima linea de un programa que no acaba en `\n` —un `input()`
 * sin contestar, o un `print(..., end='')`— se quedaria fuera del texto final.
 */
export function cerrar(s: Salida): Salida {
  return s.cola === '' ? s : anadir({ ...s, cola: '' }, `${s.cola}\n`)
}

/** Todo lo que hay que pintar, en un solo texto. */
export function texto(s: Salida): string {
  return s.cola === '' ? s.lineas.join('\n') : [...s.lineas, s.cola].join('\n')
}

/**
 * La frase que explica lo que falta, o vacia si no falta nada.
 *
 * 🔴 DISTINGUE LAS DOS CAUSAS, y no las suma: lo que tiro esta pantalla se
 *    recupera desplazandose hacia arriba en el robot si alguien lo guardo; lo
 *    que tiro el agente **no existe en ninguna parte**. Sumarlas daria un numero
 *    mas grande y menos util.
 */
export function faltaAlgo(s: Salida): string {
  const trozos: string[] = []
  if (s.perdidasArriba > 0) {
    trozos.push(
      `esta pantalla solo guarda las últimas ${TOPE_LINEAS_PANTALLA} líneas, `
      + `así que faltan ${s.perdidasArriba} del principio`,
    )
  }
  if (s.descartadasPorElAgente > 0) {
    trozos.push(
      `y el robot descartó ${s.descartadasPorElAgente} líneas más porque el programa `
      + 'imprimía más rápido de lo que se puede enviar',
    )
  }
  return trozos.join(', ')
}

export const estaVacia = (s: Salida): boolean => s.lineas.length === 0 && s.cola === ''
