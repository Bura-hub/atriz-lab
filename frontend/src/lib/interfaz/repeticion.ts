/**
 * TEXTO QUE SE REPITE. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DE DONDE SALE ESTO
 * ═══════════════════════════════════════════════════════════════════════════
 * El 2026-08-04 la pantalla de telemetria pinto estas dos cosas:
 *
 *     «hace hace 7,9 s»
 *     «en reposo: 27,5 °C en reposo»
 *
 * Las dos por la misma causa: `Dato` añadia un prefijo a un valor que ya traia
 * la palabra. **Las 321 pruebas pasaron.** Ninguna mira texto pintado, y el
 * fallo solo aparece con datos llegando -o sea, despues de hidratar-, que es
 * justo donde no llega el HTML del servidor.
 *
 * Lo encontro una captura de pantalla. Este modulo existe para que la proxima
 * no dependa de que alguien mire.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SON DOS FALLOS DISTINTOS, Y UN SOLO DETECTOR NO LOS VE
 * ═══════════════════════════════════════════════════════════════════════════
 * `hace hace` es una palabra **pegada a si misma**.
 * `en reposo … en reposo` es una frase repetida **a distancia**, con seis
 * caracteres en medio.
 *
 * El primer detector que se escribio solo miraba lo primero, y por tanto
 * habria dejado pasar la mitad de lo que ya habia ocurrido. Por eso hay dos
 * funciones y no una.
 */

/**
 * 🔴 `\b` EN JAVASCRIPT ES ASCII, TAMBIEN CON EL FLAG `u`.
 *
 * `\b` se define contra `[A-Za-z0-9_]`, asi que una letra acentuada **no** es
 * caracter de palabra y abre una frontera falsa a su lado. En español eso es
 * un falso positivo constante:
 *
 *     «con la batería a 8,29 V, a 1,29 V»
 *             └──────┘
 *              \b(a)\s+\1\b casa la «a» final de «batería» con la «a» suelta
 *
 * Medido contra esta misma aplicacion: el detector con `\b` grito en TRES
 * pantallas sobre texto perfectamente correcto. Y un verificador con falsos
 * positivos se acaba ignorando, que es peor que no tenerlo.
 *
 * Los lookarounds `(?<!\p{L})` y `(?!\p{L})` si son Unicode.
 */
const PALABRA_PEGADA = /(?<!\p{L})(\p{L}+)\s+\1(?!\p{L})/giu

/**
 * Palabras duplicadas seguidas: «hace hace», «el el».
 *
 * Devuelve cada coincidencia una vez. Vacio si no hay ninguna.
 */
export function palabrasDuplicadas(texto: string): string[] {
  PALABRA_PEGADA.lastIndex = 0
  const vistas = new Set<string>()
  for (const m of texto.matchAll(PALABRA_PEGADA)) vistas.add(m[0].toLowerCase())
  return [...vistas]
}

/**
 * Cuantas palabras puede tener un trozo para que repetir una frase sea un
 * FALLO y no prosa normal.
 *
 * ⚠️ Es el parametro delicado de este modulo, y **la primera version lo tenia
 *    mal**: medía CARACTERES, con el tope en 90. Pasado por las pantallas de
 *    verdad, grito sobre esta linea del diagnostico:
 *
 *      «Un hueco declarado es honesto; un hueco callado se lee como todo bien»
 *
 *    72 caracteres, o sea por debajo del tope, y sin embargo es una oracion con
 *    dos mitades **paralelas a proposito**. Repetir «un hueco» ahi es la figura
 *    retorica, no un fallo.
 *
 * Contar palabras separa lo que hay que separar: una etiqueta o un valor no
 * pasa de diez -«Porcentaje que reporta el firmware (no decide nada)» son
 * ocho-, y una frase escrita para leerse si.
 *
 * 📝 El coste, dicho para que nadie lo descubra tarde: una duplicacion dentro
 *    de un parrafo largo **no se detecta**. Se acepta porque el fallo que este
 *    modulo persigue -un prefijo añadido a un valor que ya lo traia- ocurre en
 *    etiquetas cortas, que es donde `Dato` compone texto.
 */
export const MAXIMO_PALABRAS_ETIQUETA = 10

/**
 * Cuantas letras necesita al menos una palabra del grupo para que su
 * repeticion cuente.
 *
 * ⚠️ Sin esto, «de la … de la» o «a 1 … a 1» dispararian sin parar. Exigir una
 * palabra de contenido -«reposo», «bateria»- deja pasar las preposiciones.
 */
const LARGO_PALABRA_CON_PESO = 4

/** Palabras de un texto, en minusculas y sin puntuacion. */
export function palabrasDe(texto: string): string[] {
  return texto.toLowerCase().match(/\p{L}+/gu) ?? []
}

/**
 * Frases de 2 a 4 palabras que aparecen DOS VECES en un mismo trozo corto de
 * texto: «en reposo: 27,5 °C en reposo».
 *
 * Solo mira textos de hasta `LARGO_MAXIMO_ETIQUETA` caracteres: en un parrafo,
 * repetir una frase es prosa, no un fallo.
 *
 * ⚠️ Y **no sustituye a `palabrasDuplicadas`**: una sola palabra repetida no la
 * ve, a proposito. Las dos se usan juntas.
 */
export function frasesRepetidas(texto: string): string[] {
  const palabras = palabrasDe(texto)
  if (palabras.length > MAXIMO_PALABRAS_ETIQUETA) return []

  const encontradas = new Set<string>()

  for (let n = 4; n >= 2; n--) {
    const posiciones = new Map<string, number>()
    for (let i = 0; i + n <= palabras.length; i++) {
      const grupo = palabras.slice(i, i + n)
      // Sin una palabra con peso, la repeticion no significa nada.
      if (!grupo.some((p) => p.length >= LARGO_PALABRA_CON_PESO)) continue

      const clave = grupo.join(' ')
      const antes = posiciones.get(clave)
      if (antes === undefined) {
        posiciones.set(clave, i)
        continue
      }
      // Solapadas no cuentan: «a a a» no son dos apariciones de «a a».
      if (i >= antes + n) encontradas.add(clave)
    }
  }

  // Si ya se aviso de «en reposo», no hace falta avisar tambien de «reposo».
  return [...encontradas].filter(
    (f) => ![...encontradas].some((otra) => otra !== f && otra.includes(f)),
  )
}

/** Un trozo de texto pintado y lo que se le encontro. */
export interface Repeticion {
  texto: string
  duplicadas: string[]
  frases: string[]
}

/**
 * Pasa los dos detectores sobre una lista de textos pintados -normalmente el
 * `innerText` de cada hoja del DOM- y devuelve solo los que fallan.
 */
export function repeticionesEn(textos: readonly string[]): Repeticion[] {
  const salida: Repeticion[] = []
  for (const texto of textos) {
    const duplicadas = palabrasDuplicadas(texto)
    const frases = frasesRepetidas(texto)
    if (duplicadas.length > 0 || frases.length > 0) salida.push({ texto, duplicadas, frases })
  }
  return salida
}
