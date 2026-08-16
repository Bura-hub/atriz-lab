/**
 * DAR DE ALTA A UNA CLASE ENTERA. Puro: sin `fs`, sin `node:crypto`, sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE HACE FALTA, Y NO ES COMODIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * Desde la Fase B (2026-08-15) **sin sesion no se abre un socket con ningun
 * robot**. O sea que los dieciseis alumnos, que hasta entonces usaban la
 * aplicacion sin cuenta, ahora **necesitan una**. Y `/usuarios` solo sabia crear
 * de una en una.
 *
 * Dieciseis formularios a mano cada semestre no es un inconveniente: es la
 * garantia de que alguien acabe compartiendo una cuenta, y con ella se pierde lo
 * unico que la identidad aporta — saber quien tiene que robot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA CONTRASEÑA SE ENSEÑA UNA SOLA VEZ, Y SE DICE
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se guarda es el hash (`credenciales.ts`, scrypt con sal por cuenta), asi
 * que **nadie puede volver a consultarla**, ni el profesor. La pantalla la enseña
 * una vez para imprimirla o copiarla, y lo advierte antes de generar nada.
 *
 * Es la decision correcta y tiene coste: quien pierda su papel necesita un
 * reseteo. Por eso el reseteo existe en la misma pantalla — sin el, esto seria
 * una trampa.
 */

import { MINIMO_CONTRASENA, normalizar, revisarAlta } from './reglas'

/**
 * Las palabras de las que salen las contraseñas.
 *
 * 🔴 SIN ACENTOS NI EÑES, y no es descuido: estas contraseñas se teclean en el
 *    portatil del aula, a veces con una distribucion de teclado que no es la de
 *    quien las genero, y a veces copiadas de un papel por alguien con prisa. Una
 *    `ñ` o una tilde convierte «no me entra» en un problema de teclado que nadie
 *    diagnostica.
 *
 * 🔴 Y NINGUNA PALABRA SE PARECE A OTRA EN UNA LETRA. Se leen en voz alta y se
 *    copian a mano; pares como «casa/caza» producen fallos que se atribuyen a la
 *    contraseña y no a la lectura.
 *
 * 📝 Son palabras corrientes en español a proposito. Una frase de cuatro
 *    palabras de esta lista da mas de 60 bits, y se recuerda; `Lab2026!` da
 *    menos y no se recuerda. Es el mismo argumento que `revisarAlta` ya escribe
 *    para no exigir simbolos.
 */
const PALABRAS: readonly string[] = [
  'arbol', 'barco', 'cielo', 'dedal', 'enero', 'fuego', 'gato', 'hilo',
  'isla', 'jarra', 'kilo', 'lluvia', 'mundo', 'nube', 'ocaso', 'piedra',
  'queso', 'rueda', 'sierra', 'trigo', 'uva', 'valle', 'yema', 'zorro',
  'ancla', 'bruma', 'cobre', 'duna', 'espiga', 'faro', 'grillo', 'hierba',
  'imprenta', 'jungla', 'lienzo', 'monte', 'nieve', 'olivo', 'puerto', 'rama',
  'salto', 'tinta', 'urna', 'vela', 'zumo', 'cabra', 'diente', 'estufa',
  'flecha', 'granja', 'huerto', 'joya', 'llave', 'melon', 'nido', 'ombligo',
  'pluma', 'raiz', 'seta', 'torre', 'vaso', 'yunque', 'abeja', 'brisa',
]

/** Cuantas palabras lleva una contraseña generada. */
export const PALABRAS_POR_FRASE = 4

/**
 * Una contraseña de `PALABRAS_POR_FRASE` palabras separadas por guiones.
 *
 * @param aleatorio  inyectable. En produccion se le pasa uno de `node:crypto`;
 *                   en las pruebas, uno determinista. **No usa `Math.random`**:
 *                   una contraseña generada con un generador predecible es una
 *                   contraseña que no protege, y este fichero no puede saber cual
 *                   le pasan — por eso lo exige y no lo elige.
 */
export function frase(aleatorio: (tope: number) => number): string {
  const partes: string[] = []
  for (let i = 0; i < PALABRAS_POR_FRASE; i++) partes.push(PALABRAS[aleatorio(PALABRAS.length)])
  return partes.join('-')
}

/** Una cuenta que el lote va a crear. */
export interface Alta {
  usuario: string
  contrasena: string
}

/** Lo que el lote haria, ANTES de tocar nada. */
export interface PlanDeLote {
  /** Las que se crearian, en orden. */
  nuevas: string[]
  /** Las que NO, porque el nombre ya existe. */
  choques: string[]
  /** Por que el plan entero no vale, o `null`. */
  error: string | null
}

export interface PeticionDeLote {
  /** `alumno` -> `alumno-01`, `alumno-02`… */
  prefijo: string
  desde: number
  hasta: number
  /** Los nombres que ya hay, normalizados. */
  existentes: readonly string[]
}

/** Cuantas cuentas se pueden pedir de una vez. */
export const TOPE_LOTE = 60

/**
 * Que haria el lote, sin hacerlo.
 *
 * 🔴 SE CALCULA ANTES Y SE ENSEÑA. Un alta masiva que falla a la mitad deja la
 *    clase partida en dos —unos con cuenta y otros no— y sin forma de saber
 *    donde se corto. Enseñar el plan permite ver los choques **antes**, que es
 *    cuando se pueden resolver.
 *
 * ⚠️ Los choques NO son un error: dar de alta `alumno-01..16` cuando ya existen
 *    del 1 al 8 es exactamente lo que hace quien amplia el grupo a mitad de
 *    semestre. Se saltan y se dicen.
 */
export function planDeLote(p: PeticionDeLote): PlanDeLote {
  const vacio = { nuevas: [], choques: [] }

  if (!Number.isInteger(p.desde) || !Number.isInteger(p.hasta)) {
    return { ...vacio, error: 'El desde y el hasta tienen que ser numeros enteros.' }
  }
  if (p.desde < 1 || p.hasta < p.desde) {
    return { ...vacio, error: 'El rango va de un numero a otro mayor o igual, empezando en 1.' }
  }
  if (p.hasta - p.desde + 1 > TOPE_LOTE) {
    return { ...vacio, error: `De una vez se pueden crear como mucho ${TOPE_LOTE} cuentas.` }
  }

  const prefijo = normalizar(p.prefijo)
  // 🔴 Se valida el nombre COMPLETO, no el prefijo: `revisarAlta` exige un largo
  //    minimo y un juego de caracteres, y un prefijo que pasa suelto puede dar un
  //    nombre que no pasa —o al reves—. Se comprueba lo que de verdad se va a
  //    guardar, con una contraseña de juguete que cumple para aislar el motivo.
  const muestra = `${prefijo}-${String(p.desde).padStart(2, '0')}`
  const motivo = revisarAlta(muestra, 'x'.repeat(MINIMO_CONTRASENA))
  if (motivo !== null) return { ...vacio, error: motivo }

  const ya = new Set(p.existentes.map(normalizar))
  const nuevas: string[] = []
  const choques: string[] = []
  for (let n = p.desde; n <= p.hasta; n++) {
    const nombre = `${prefijo}-${String(n).padStart(2, '0')}`
    if (ya.has(nombre)) choques.push(nombre)
    else nuevas.push(nombre)
  }
  return { nuevas, choques, error: null }
}
