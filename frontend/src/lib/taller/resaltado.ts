/**
 * EL TOKENIZADOR DE PYTHON DEL EDITOR — escrito a mano, y por una razon.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE NO SE USA UNA BIBLIOTECA
 * ═══════════════════════════════════════════════════════════════════════════
 * `CLAUDE.md:147`: **cero dependencias nuevas**. Y el propio `PanelTerminal`
 * ya lo habia razonado al escribir el editor: *«Monaco son ~5 MB para poner
 * colores»*. Prism y Shiki tampoco son gratis, y ninguno de los tres cabe en un
 * repositorio con cinco dependencias de produccion.
 *
 * Lo que hay que colorear son practicas de ~30 lineas escritas para alumnos de
 * primer curso. Un analizador completo de Python seria mas maquinaria que el
 * problema.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 UNA MAQUINA DE ESTADOS SOBRE EL TEXTO ENTERO, NO REGEX POR LINEA
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos razones, y las dos se ven en las practicas reales:
 *
 *   1. **Los docstrings triples cruzan lineas.** `05_sensor_color.py` abre uno
 *      en la linea 2 y lo cierra en la 20, con codigo indentado dentro. Una
 *      maquina por linea empezaria a colorear codigo dentro de un texto.
 *   2. **El orden manda.** Una pila de regex por prioridad se equivoca con una
 *      `#` dentro de una cadena, y con unas comillas dentro de un comentario.
 *      Recorrer una vez, de izquierda a derecha, no tiene ese problema.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LIMITE DECLARADO: LAS F-STRINGS NO SE ABREN POR DENTRO
 * ═══════════════════════════════════════════════════════════════════════════
 * `f'{"rojo":>6} {"verde":>6}'` y `f'{rojo:6d} {rg:5.2f}'` salen de las
 * practicas reales, y las dos se colorean **como una cadena entera**. No se
 * tokeniza lo que hay dentro de las llaves.
 *
 * Es una decision, no un descuido: hacerlo bien es meter un analizador de
 * expresiones dentro de otro —con sus propias comillas anidadas, que es
 * justamente el caso raro— y ninguna practica lo necesita para leerse. Si algun
 * dia hace falta, este comentario dice por donde se entra.
 *
 * ⚠️ Y otro limite: **esto no valida Python**. Una comilla sin cerrar tiñe el
 *    resto del fichero, igual que en cualquier editor. No es un error del
 *    tokenizador: es lo que un editor hace.
 */

export type TipoToken =
  | 'normal'
  | 'comentario'
  | 'cadena'
  | 'numero'
  | 'palabra_clave'
  | 'constante'
  | 'definicion'
  | 'llamada'

export interface Token {
  tipo: TipoToken
  texto: string
}

/**
 * Las palabras reservadas de Python 3.
 *
 * 📝 `True`, `False` y `None` van aparte (`CONSTANTES`) aunque el lenguaje las
 *    liste como reservadas: son **valores**, no estructura, y en un editor se
 *    leen mejor con el color de un numero que con el de un `for`.
 */
const PALABRAS_CLAVE: ReadonlySet<string> = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if',
  'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield',
])

const CONSTANTES: ReadonlySet<string> = new Set(['True', 'False', 'None'])

/** Tras `def` o `class`, el nombre que sigue es una definicion. */
const DEFINEN = new Set(['def', 'class'])

const ES_LETRA = /[A-Za-z_]/
const ES_ALFANUM = /[A-Za-z0-9_]/
const ES_DIGITO = /[0-9]/

/**
 * ¿Empieza aqui una cadena, y con que delimitador?
 *
 * Devuelve el delimitador completo (`'`, `"`, `'''`, `"""`) mas los prefijos
 * que lo preceden (`f`, `r`, `b`, `rb`, `fr`…), o `null`.
 */
function delimitadorEn(texto: string, i: number): { prefijo: string; comillas: string } | null {
  let j = i
  // Hasta dos letras de prefijo: `f`, `rb`, `fr`… No se valida cuales: un
  // prefijo raro sigue siendo una cadena, y teñirla es mejor que no verla.
  let prefijo = ''
  while (j < texto.length && prefijo.length < 2 && /[A-Za-z]/.test(texto[j])) {
    prefijo += texto[j]
    j++
  }
  const c = texto[j]
  if (c !== '"' && c !== "'") return null
  // Si hubo prefijo, tenia que ser de cadena; si no lo era, esto es un
  // identificador pegado a una comilla, cosa que Python no permite.
  if (prefijo !== '' && !/^[bBfFrRuU]{1,2}$/.test(prefijo)) return null

  const triple = texto.slice(j, j + 3)
  if (triple === '"""' || triple === "'''") return { prefijo, comillas: triple }
  return { prefijo, comillas: c }
}

/**
 * Donde acaba una cadena que empieza en `desde` con ese delimitador.
 *
 * Devuelve el indice del primer caracter DESPUES del cierre, o el final del
 * texto si nunca cierra.
 *
 * 🔴 La barra invertida escapa el siguiente caracter, sea cual sea. Sin esto,
 *    `'…\n'` de la practica 05 cerraria en la comilla equivocada — no, peor:
 *    `'no \' cerrada'` partiria la cadena por la mitad.
 */
function finDeCadena(texto: string, desde: number, comillas: string): number {
  let i = desde
  while (i < texto.length) {
    if (texto[i] === '\\') { i += 2; continue }
    if (texto.startsWith(comillas, i)) return i + comillas.length
    i++
  }
  return texto.length
}

/** Donde acaba un numero que empieza en `desde`. */
function finDeNumero(texto: string, desde: number): number {
  let i = desde
  // Hexadecimal, octal y binario: `0x1f`, `0o17`, `0b1010`.
  if (texto[i] === '0' && /[xXoObB]/.test(texto[i + 1] ?? '')) {
    i += 2
    while (i < texto.length && /[0-9a-fA-F_]/.test(texto[i])) i++
    return i
  }
  while (i < texto.length && (ES_DIGITO.test(texto[i]) || texto[i] === '_')) i++
  if (texto[i] === '.' && ES_DIGITO.test(texto[i + 1] ?? '')) {
    i++
    while (i < texto.length && (ES_DIGITO.test(texto[i]) || texto[i] === '_')) i++
  }
  // Exponente: `1e-3`, `2E+10`.
  if (/[eE]/.test(texto[i] ?? '') && /[0-9+-]/.test(texto[i + 1] ?? '')) {
    i += 2
    while (i < texto.length && ES_DIGITO.test(texto[i])) i++
  }
  return i
}

/**
 * El texto entero, partido en trozos con su tipo.
 *
 * 🔴 CONSERVA TODOS LOS CARACTERES. `tokenizar(c).map(t => t.texto).join('')`
 *    tiene que devolver `c` exactamente — saltos de linea, espacios y tabuladores
 *    incluidos. El editor pinta estos trozos DEBAJO de un `<textarea>`
 *    transparente, asi que perder un solo caracter desplaza el color respecto al
 *    texto de ahi en adelante. Hay una prueba que lo comprueba sobre las
 *    practicas reales.
 */
export function tokenizar(codigo: string): Token[] {
  const salida: Token[] = []
  let i = 0
  let pendiente = ''
  /** La ultima palabra significativa, para saber si lo que viene se define. */
  let anterior = ''

  const soltar = () => {
    if (pendiente !== '') { salida.push({ tipo: 'normal', texto: pendiente }); pendiente = '' }
  }
  const empujar = (tipo: TipoToken, texto: string) => { soltar(); salida.push({ tipo, texto }) }

  while (i < codigo.length) {
    const c = codigo[i]

    // ── Comentario: hasta el final de la linea ──────────────────────────────
    if (c === '#') {
      const fin = codigo.indexOf('\n', i)
      const hasta = fin === -1 ? codigo.length : fin
      empujar('comentario', codigo.slice(i, hasta))
      i = hasta
      continue
    }

    // ── Cadena, con sus prefijos ────────────────────────────────────────────
    // Solo si el caracter anterior no forma parte de un identificador: sin esto,
    // la `f` de `perfil'` se leeria como prefijo de f-string.
    const anteriorEsIdent = i > 0 && ES_ALFANUM.test(codigo[i - 1])
    if ((c === '"' || c === "'") || (!anteriorEsIdent && ES_LETRA.test(c))) {
      const d = delimitadorEn(codigo, i)
      if (d !== null) {
        const inicio = i
        const trasComillas = i + d.prefijo.length + d.comillas.length
        const fin = finDeCadena(codigo, trasComillas, d.comillas)
        empujar('cadena', codigo.slice(inicio, fin))
        i = fin
        anterior = ''
        continue
      }
    }

    // ── Numero ──────────────────────────────────────────────────────────────
    // Solo si no viene pegado a un identificador: `x2` no lleva un numero dentro.
    if (ES_DIGITO.test(c) && !(i > 0 && ES_ALFANUM.test(codigo[i - 1]))) {
      const fin = finDeNumero(codigo, i)
      empujar('numero', codigo.slice(i, fin))
      i = fin
      anterior = ''
      continue
    }

    // ── Palabra: reservada, constante, definicion, llamada o nada ───────────
    if (ES_LETRA.test(c)) {
      let fin = i
      while (fin < codigo.length && ES_ALFANUM.test(codigo[fin])) fin++
      const palabra = codigo.slice(i, fin)

      let tipo: TipoToken = 'normal'
      if (PALABRAS_CLAVE.has(palabra)) tipo = 'palabra_clave'
      else if (CONSTANTES.has(palabra)) tipo = 'constante'
      else if (DEFINEN.has(anterior)) tipo = 'definicion'
      else {
        // Una llamada es un nombre seguido de `(`, saltando espacios. Es lo que
        // hace que `robot.avanzar(...)` destaque el verbo, que es lo que el
        // alumno busca cuando repasa su guion.
        let k = fin
        while (k < codigo.length && (codigo[k] === ' ' || codigo[k] === '\t')) k++
        if (codigo[k] === '(') tipo = 'llamada'
      }

      if (tipo === 'normal') pendiente += palabra
      else empujar(tipo, palabra)

      anterior = palabra
      i = fin
      continue
    }

    // ── Cualquier otra cosa: se acumula tal cual ────────────────────────────
    // 🔴 Los espacios y saltos NO borran `anterior`: `def  saludar` sigue siendo
    //    una definicion. Solo la borra algo que no sea espacio.
    if (!/\s/.test(c)) anterior = ''
    pendiente += c
    i++
  }

  soltar()
  return salida
}

/**
 * Los mismos tokens, pero partidos por lineas.
 *
 * El editor los pinta linea a linea para que el espejo case con el `<textarea>`,
 * y un docstring de veinte lineas es UN token: hay que partirlo o el ajuste de
 * linea no coincide.
 *
 * 🔴 Devuelve una entrada por linea, **incluidas las vacias**, o el espejo se
 *    quedaria corto y el color subiria respecto al texto.
 */
export function tokenizarPorLineas(codigo: string): Token[][] {
  const lineas: Token[][] = [[]]
  for (const token of tokenizar(codigo)) {
    const trozos = token.texto.split('\n')
    trozos.forEach((trozo, n) => {
      if (n > 0) lineas.push([])
      if (trozo !== '') lineas[lineas.length - 1].push({ tipo: token.tipo, texto: trozo })
    })
  }
  return lineas
}
