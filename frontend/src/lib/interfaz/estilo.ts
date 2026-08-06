/**
 * LO QUE ESTA INTERFAZ NO PUEDE PARECER. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTE FICHERO EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * `lenguaje.ts` fija lo que la interfaz no puede DECIR. Esto fija lo que no
 * puede PARECER, y hace falta por la misma razon: hay veinte skills de diseño
 * instaladas y **doce estan escritas para landing pages premium**. Varias
 * prescriben, con estas palabras:
 *
 *   design-taste-frontend-v1:207  «Every card must have an "Active State" that
 *                                  loops infinitely (Pulse, Typewriter, Float)
 *                                  to ensure the dashboard feels "alive"»
 *   stitch-design-taste:95        «Pulse on status dots»
 *   gpt-taste:47                  «Static interfaces are strictly forbidden»
 *
 * 🔴 **Un pulso infinito en un indicador de estado es indistinguible de un
 *    latido real.** En una pantalla que vigila 16 robots, algo que se mueve
 *    siempre parece algo vivo siempre — y este proyecto lleva meses quitando
 *    interfaces que parecen sanas sobre sistemas rotos.
 *
 * Un parrafo en `CLAUDE.md` no basta: la que gobierna de verdad es la que corre.
 * Mismo mecanismo que `buscarFrasesProhibidas`, y por el mismo motivo.
 *
 * ⚠️ **Lo que esto NO puede hacer, y hay que saberlo:** comprueba la AUSENCIA de
 * lo malo, nunca la PRESENCIA de lo bueno. Pasa perfectamente sobre una pantalla
 * completamente rota. El criterio de aceptacion de un cambio visual sigue siendo
 * una persona mirandolo.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Una clase o patron prohibido, con el motivo que lo prohibe. */
export interface Prohibicion {
  /** Se busca tal cual en el fuente, sin distinguir mayusculas. */
  patron: RegExp
  /**
   * Si esta puesta y casa **en la MISMA linea** que `patron`, esa linea no
   * cuenta. Se usa con cuentagotas y cada exencion lleva su motivo escrito
   * encima: una guardia con exenciones vagas deja de proteger.
   */
  exime?: RegExp
  /** Como se nombra en el informe. */
  nombre: string
  porque: string
}

export const PROHIBICIONES: readonly Prohibicion[] = [
  {
    patron: /\banimate-(pulse|bounce|ping)\b/i,
    nombre: 'animate-pulse / animate-bounce / animate-ping',
    porque:
      'son bucles INFINITOS. Sobre un indicador de estado son indistinguibles de un latido ' +
      'real, y esta interfaz vigila 16 robots que pueden estar mudos',
  },
  {
    patron: /animation:\s*[a-z-]+[^;]*\binfinite\b/i,
    /*
     * ⚠️ LA ÚNICA EXENCIÓN DE ESTE FICHERO, y va nombrada una por una para que
     *    no se pueda ensanchar sin tocar esta línea.
     *
     * El motivo de la prohibición es concreto: **sobre un INDICADOR DE ESTADO**
     * un bucle infinito es indistinguible de un latido real, y esta interfaz
     * vigila 16 robots que pueden estar mudos. Los dos orbes de `.luz-ambiente`
     * no son un indicador: están en el fondo fijo, detrás de todo, desenfocados
     * 100 px, y **no cuelgan de ningún dato ni de ningún robot**. No hay nada
     * que puedan afirmar en falso.
     *
     * 🔴 Y donde el motivo SÍ aplica, la prohibición sigue entera: nada que
     *    represente un valor, un enlace o una salud puede animarse en bucle. La
     *    regla de al lado —no animar la llegada de un dato, porque `/odom` llega
     *    a 16,5 Hz y sería un estroboscopio sobre cifras que alguien está
     *    leyendo— no se toca.
     *
     * 📝 Decisión del usuario, pedida dos veces: el movimiento del fondo es lo
     *    que hace que la aplicación no se lea como una hoja quieta. Se apaga
     *    solo con `prefers-reduced-motion`.
     */
    exime: /\brespirar-[ab]\b/,
    nombre: 'animation: … infinite',
    porque: 'lo mismo, escrito en CSS a mano en vez de con una utilidad',
  },
  {
    /*
     * 🔴🔴 UNA PARADA DE DEGRADADO CON UN COLOR LITERAL NO SIGUE AL TEMA, Y ASI
     *    ES COMO TRES TITULARES SE VOLVIERON INVISIBLES.
     *
     * Los tres decian `bg-gradient-to-b from-white to-[#A8B0C8] bg-clip-text`:
     * blanco en la altura de mayuscula apagandose hacia la linea base. Sobre el
     * pozo casi negro era «luz que cae desde arriba» y funcionaba. Al pasar el
     * tema a papel **nada los toco** —son literales, no variables— y quedo
     * tinta blanca sobre papel blanco.
     *
     * Es la misma familia que `.pozo-interior`, que se quedo en `rgb(0 0 0/0.2)`
     * y sobre una tarjeta blanca es un bloque gris. Un cambio de tema alcanza a
     * todo lo que pasa por una variable **y a nada mas**.
     *
     * ⚠️ La regla se acota a las PARADAS DE DEGRADADO (`from-`, `via-`, `to-`)
     *    con hexadecimal, `white` o `black`, que son las que siempre tienen que
     *    seguir al fondo. Deliberadamente NO alcanza a `bg-[#ff0000]` de
     *    `PanelLeds`: ahi el hexadecimal es el RGB **fisico** que va a emitir el
     *    LED del robot. Ese no debe seguir al tema — seria mentir sobre lo que
     *    hace el robot.
     *
     * 🔴 Y NO tiene exencion, ni siquiera con `bg-clip-text`: un titular con
     *    degradado sigue estando obligado a leerse sobre su fondo. Era
     *    exactamente el caso que fallo.
     */
    patron: /\b(?:from|via|to)-(?:\[#[0-9a-f]{3,8}\]|white\b|black\b)/i,
    nombre: 'parada de degradado con color literal',
    porque:
      'un literal no sigue al tema. `from-white` sobre el pozo negro era luz cayendo; al ' +
      'pasar la base a papel se quedo igual y el titular se volvio invisible. Las paradas ' +
      'salen de `--foreground`, `--estado-neutro` y compañia, que si cambian con el tema',
  },
  {
    patron: /\bshadow-(lg|xl|2xl)\b|\bdrop-shadow\b/i,
    nombre: 'shadow-lg / shadow-xl / drop-shadow',
    porque:
      'profundidad que no es informacion. En un instrumento la jerarquia la dan la linea de ' +
      '1 px y el tamaño, no una sombra que sugiere relieve donde no hay ninguno',
  },
  {
    /*
     * 🔴 SE PROHIBE EL DEGRADADO COMO **RELLENO**, NO COMO TINTA DE UN TITULAR.
     *
     * La regla nacio contra los rellenos de la maqueta borrada: tarjetas y
     * botones con degradado, donde el color SIGNIFICA -no se sabe, vivo, mirar,
     * ir- y un degradado lo diluye en algo que ya no se lee como estado. Eso
     * sigue prohibido y es lo que este patron persigue.
     *
     * ⚠️ Lo que se exime, y solo eso: `bg-gradient-* … bg-clip-text` en un
     *    TITULAR de pantalla. Ahi el degradado no colorea una superficie ni
     *    compite con ningun estado — es la tinta de una palabra. `craft-floor`
     *    lo lista como refuso por defecto, no como prohibicion («the brief's own
     *    words can earn any of them»), y la direccion elegida lo pide
     *    explicitamente.
     *
     * La exencion exige `bg-clip-text` EN LA MISMA linea: sin el, el degradado
     * pinta el fondo del elemento y vuelve a ser un relleno.
     */
    patron: /\bbg-gradient-|--gradient-|\bgradient-(primary|success|warning|destructive)\b/i,
    exime: /bg-clip-text/,
    nombre: 'gradientes',
    porque:
      'decoracion. Aqui el color SIGNIFICA -no se sabe, vivo, mirar, ir, frenando- y un ' +
      'degradado lo diluye en algo que ya no se puede leer como estado. Un titular con ' +
      '`bg-clip-text` esta eximido: ahi es tinta, no relleno',
  },
]

/**
 * Devuelve los nombres de las prohibiciones que aparecen en `fuente`.
 *
 * ⚠️ **Los comentarios se saltan**, igual que en `buscarFrasesProhibidas`: tiene
 * que seguir siendo posible EXPLICAR por que algo esta prohibido sin que la
 * explicacion dispare la prueba. Lo contrario haria que el codigo no pudiera
 * documentar sus propias reglas.
 */
export function buscarProhibiciones(fuente: string): string[] {
  const lineas = lineasDeCodigo(fuente)
  /*
   * 🔴 LA EXENCION SE COMPRUEBA **LINEA A LINEA**, y esto no es un detalle.
   *
   * Sobre el fichero entero, una sola linea eximida absolveria a TODAS las
   * demas: bastaria con tener un titular con `bg-clip-text` en cualquier parte
   * del componente para que sus botones pudieran llevar degradado sin que nadie
   * se enterara. Una guardia que se puede desactivar por accidente no es una
   * guardia.
   */
  return PROHIBICIONES.filter((p) => lineas.some(
    (l) => p.patron.test(l) && !(p.exime !== undefined && p.exime.test(l)),
  )).map((p) => p.nombre)
}

/** Comentarios de una linea de JS/TS y de CSS, y lineas de bloque `*`. */
export function esComentario(linea: string): boolean {
  const l = linea.trim()
  return l.startsWith('//') || l.startsWith('*') || l.startsWith('/*') || l.startsWith('#')
}

/**
 * Las lineas de FUENTE, quitando los comentarios — **incluidas las lineas de
 * dentro de un bloque que no empiezan por `*`**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE `esComentario()` SOLA NO BASTA, Y A QUIEN MORDIO
 * ═══════════════════════════════════════════════════════════════════════════
 * `esComentario()` mira una linea AISLADA y reconoce cuatro formas: `//`, `*`,
 * `/*` y `#`. Pero en este repositorio abundan los comentarios JSX asi:
 *
 *     {(barra)*
 *       🔴 EL DEGRADADO IBA DE `from-white` A UN GRIS FIJO...
 *          y sobre papel el titular era invisible.
 *     *(barra)}
 *
 * Las lineas interiores **no empiezan por `*`**, asi que `esComentario()` dice
 * que son codigo — y si explican una prohibicion, la disparan. La guardia acusa
 * a quien esta documentando por que algo esta prohibido, que es exactamente lo
 * que la cabecera de este fichero promete que se puede hacer.
 *
 * 📝 No es teorico: mordio tres veces en un mismo dia. A mi al escribir el
 *    comentario del degradado de los titulares, y a DOS agentes distintos
 *    trabajando en ficheros distintos, que informaron del mismo falso positivo
 *    sin saber el uno del otro. Un falso positivo que se repite convierte la
 *    guardia en algo que se salta, y una guardia que se salta no protege.
 *
 * ⚠️ **SE ABRE SOLO AL PRINCIPIO DE LINEA**, y es deliberado: un `/*` en mitad
 *    de una linea puede estar dentro de una cadena o de una expresion regular,
 *    y tratarlo como comentario haria que la guardia dejara de mirar codigo de
 *    verdad. Un falso NEGATIVO es peor que un falso positivo, asi que la regla
 *    se queda en el caso conservador — que ademas es el unico que aparece aqui.
 */
export function lineasDeCodigo(fuente: string): string[] {
  const salida: string[] = []
  let dentroDeBloque = false

  for (const linea of fuente.split('\n')) {
    const l = linea.trim()

    if (dentroDeBloque) {
      // La linea que CIERRA tampoco es codigo: lo que venga detras de `*​/` en
      // esa misma linea es un caso que este repositorio no usa.
      if (l.includes('*/')) dentroDeBloque = false
      continue
    }

    // `{/*` es la forma JSX; `/*` la de JS y CSS. Un bloque que abre y cierra
    // en la misma linea no deja nada dentro que vigilar.
    if ((l.startsWith('/*') || l.startsWith('{/*')) && !l.includes('*/')) {
      dentroDeBloque = true
      continue
    }

    if (!esComentario(l)) salida.push(linea)
  }

  return salida
}

/** Todos los `.ts`, `.tsx` y `.css` de un arbol. */
export function ficherosDeEstilo(dir: string): string[] {
  const salida: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) salida.push(...ficherosDeEstilo(ruta))
    else if (/\.(tsx?|css)$/.test(e.name)) salida.push(ruta)
  }
  return salida
}

/**
 * 🔴 LOS GLOBS DE `content` DE TAILWIND, QUE FALLAN EN SILENCIO.
 *
 * Lo dice el comentario del propio `tailwind.config.ts`: un glob que no casa
 * hace que esos componentes **compilen, se monten y salgan SIN NINGUN ESTILO**,
 * sin dar error. Hoy hay uno muerto (`./src/pages`, que no existe).
 *
 * Es la misma familia que todo lo demas de este proyecto: algo que devuelve
 * exito y no hace nada.
 */
export function globsMuertos(configTailwind: string, existe: (ruta: string) => boolean): string[] {
  const bloque = configTailwind.match(/content:\s*\[([\s\S]*?)\]/)
  if (bloque === null) throw new Error('no encuentro el bloque `content` en tailwind.config.ts')
  const globs = [...bloque[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2])
  if (globs.length === 0) {
    // Misma guarda que `extraerItems` del comprobador de contrato: cero
    // entradas no es una lista vacia legitima, es un parseo que se corto.
    throw new Error('el bloque `content` parseo a 0 globs: sospecha de un ] prematuro')
  }
  // De `./src/app/**/*.{js,ts,jsx,tsx,mdx}` interesa `./src/app`.
  return globs.filter((g) => {
    const raiz = g.split('*')[0].replace(/\/+$/, '')
    return raiz !== '' && !existe(raiz)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LA COLISION DE `transition`, QUE NO LA VE NINGUNA HERRAMIENTA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * `transition` es una propiedad ABREVIADA. Dos clases de la misma capa y la
 * misma especificidad que la declaran **no se suman: gana la ultima escrita y la
 * otra se pierde entera**, incluidas las propiedades que la ganadora ni menciona.
 *
 * Paso de verdad, y estuvo asi desde que se escribio el tema:
 *
 *   .vidrio   { transition: box-shadow …, border-color …; }   <- declarada antes
 *   .pulsable { transition: transform …, background-color …; }
 *   <Link className="vidrio pulsable …">                       <- las dieciseis
 *
 * Resultado: **la elevacion del hover aparecia de golpe** en todo el muro. Ni el
 * navegador avisa, ni el linter, ni la comprobacion de tipos: las dos reglas son
 * correctas por separado. Solo se ve mirando **que clases viajan juntas**.
 *
 * ⚠️ Y la regla NO es «dos clases no pueden declarar `transition`»: eso seria
 *    falso. Es que **la perdedora no puede transicionar nada que la ganadora no
 *    transicione tambien**. Con `box-shadow` añadida a `.pulsable`, el par
 *    `vidrio pulsable` es correcto y esta comprobacion lo deja pasar.
 *
 * ⚠️ Limite conocido: solo mira selectores de UNA clase escueta (`.x {`). Los
 *    pseudoelementos y los descendientes (`.proyeccion .vidrio`) quedan fuera —
 *    ahi la especificidad distinta es intencionada, no un accidente.
 */
export interface TransicionDeClase {
  clase: string
  /** Posicion en el fichero. **La mayor gana**, que es la regla de la cascada. */
  orden: number
  /** Las propiedades que lista su `transition`, en orden. */
  propiedades: string[]
}

/**
 * Parte por comas de PRIMER NIVEL.
 *
 * 🔴 Un `split(',')` a secas no vale: `cubic-bezier(0.23, 1, 0.32, 1)` lleva
 *    tres comas dentro, asi que trocearia una sola transicion en cuatro y las
 *    tres ultimas empezarian por un numero. La lista de propiedades saldria
 *    vacia y la comprobacion aprobaria sin mirar nada.
 */
export function partirEnComas(valor: string): string[] {
  const partes: string[] = []
  let nivel = 0
  let actual = ''
  for (const ch of valor) {
    if (ch === '(') nivel += 1
    else if (ch === ')') nivel -= 1
    if (ch === ',' && nivel === 0) {
      partes.push(actual)
      actual = ''
    } else actual += ch
  }
  partes.push(actual)
  return partes
}

/** Las clases de un CSS que declaran la abreviada `transition`, con su orden. */
export function transicionesDeClases(css: string): TransicionDeClase[] {
  const salida: TransicionDeClase[] = []
  // `(^|\})` ancla en un limite de regla; `\s*\{` justo tras el nombre descarta
  // `.a .b`, `.a:hover` y `.a::before`, que no son colisiones accidentales.
  for (const m of css.matchAll(/(?:^|\})\s*\.([a-z][\w-]*)\s*\{([^{}]*)\}/gim)) {
    const decl = /(?:^|[;\s])transition\s*:([^;]*)/i.exec(m[2])
    if (decl === null) continue
    const propiedades = partirEnComas(decl[1])
      .map((p) => p.trim().split(/\s+/)[0])
      .filter((p) => /^[a-z][a-z-]*$/.test(p))
    salida.push({ clase: m[1], orden: m.index ?? 0, propiedades })
  }
  return salida
}

/**
 * Los conjuntos de clases que viajan juntas en un mismo `className`.
 *
 * ⚠️ Las interpolaciones `${…}` se BORRAN, no se intentan resolver: lo que traen
 *    depende de datos en ejecucion. Perder una clase produce un falso negativo,
 *    que es el lado seguro; inventarla produciria una alarma sobre codigo sano.
 */
export function gruposDeClases(fuente: string): string[][] {
  const grupos: string[][] = []
  for (const m of fuente.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const clases = (m[1] ?? m[2] ?? m[3] ?? '')
      .replace(/\$\{[^}]*\}/g, ' ')
      .split(/\s+/)
      .filter((c) => c !== '')
    if (clases.length > 1) grupos.push(clases)
  }
  return grupos
}

/**
 * Los pares que se pisan de verdad: la clase PERDEDORA transiciona algo que la
 * ganadora no. Devuelve una linea por par, nombrando lo que se pierde.
 */
export function colisionesDeTransicion(
  transiciones: readonly TransicionDeClase[],
  grupos: readonly string[][],
): string[] {
  const porNombre = new Map(transiciones.map((t) => [t.clase, t]))
  const salida = new Set<string>()
  for (const g of grupos) {
    const enJuego = [...new Set(g)]
      .map((c) => porNombre.get(c))
      .filter((t): t is TransicionDeClase => t !== undefined)
      .sort((a, b) => a.orden - b.orden)
    if (enJuego.length < 2) continue
    const gana = enJuego[enJuego.length - 1]
    for (const pierde of enJuego.slice(0, -1)) {
      const perdidas = pierde.propiedades.filter((p) => !gana.propiedades.includes(p))
      if (perdidas.length > 0) {
        salida.add(`«${pierde.clase}» pierde ${perdidas.join(', ')} frente a «${gana.clase}»`)
      }
    }
  }
  return [...salida].sort()
}

/**
 * 🔴 LA TIPOGRAFIA NO PUEDE VENIR DE LA RED.
 *
 * `globals.css` importaba Inter y JetBrains Mono desde `fonts.googleapis.com`.
 * El experimento que hoy BLOQUEA el producto (la F0) es precisamente si el punto
 * de acceso del aula deja pasar el trafico entre clientes; una interfaz de
 * laboratorio que necesita dos peticiones a Google para tener letra **cae en
 * silencio** justo donde va a usarse.
 */
export const FUENTES_REMOTAS = /@import\s+url\(\s*['"]?https?:\/\//i

/* ═══════════════════════════════════════════════════════════════════════════
   EL VOCABULARIO DE COLOR NO PUEDE COLISIONAR
   ═══════════════════════════════════════════════════════════════════════════
   Esta interfaz reparte el color en tres ejes con significados distintos:

     · `--bloque-*`   el ESTADO del robot en el muro (vivo · mirar · ir)
     · `--estado-*`   un HECHO confirmado sobre un dato
     · `--seccion-*`  la IDENTIDAD de una pantalla — dónde estás

   Que dos tokens de ejes distintos valgan lo mismo no es feo: **rompe el eje**.
   Una baldosa que «pide algo» no puede destacar sobre una banda de su propio
   color, y una pantalla de administrar cuentas no puede ir vestida del color
   que significa «el robot va a moverse».

   🔴 HA PASADO TRES VECES, Y LAS TRES CON LA REGLA ESCRITA AL LADO:
     1. `--seccion-flota` valía exactamente `--bloque-vivo`.
     2. `--estado-ir` valía exactamente `--destructive`.
     3. `--seccion-entrar`/`--seccion-usuarios` nacieron sobre `--seccion-conducir`
        y `--estado-ir`, con un comentario que decía «comprobado» al lado.

   Las tres se encontraron mirando píxeles, no leyendo el fichero. Un ojo humano
   compara dos colores que ve juntos; estos nunca se ven juntos. Por eso lo tiene
   que medir el ejecutor. */

/** Un token de color del vocabulario, ya normalizado. */
export interface TokenDeColor {
  nombre: string
  /** `R G B` con un solo espacio, para poder comparar por igualdad. */
  valor: string
}

const TOKEN_COLOR = /^\s*(--(?:bloque|estado|seccion)-[a-z0-9-]+)\s*:\s*(\d{1,3}\s+\d{1,3}\s+\d{1,3})\s*;/

/**
 * Los tokens de los tres ejes tal y como están escritos en `globals.css`.
 *
 * ⚠️ Solo mira LÍNEAS DE CÓDIGO. Los valores viejos citados dentro de un
 *    comentario —que es como se documenta una colisión ya arreglada— no cuentan;
 *    si contaran, explicar el fallo lo reintroduciría.
 */
export function tokensDeColor(css: string): TokenDeColor[] {
  const salida: TokenDeColor[] = []
  for (const linea of lineasDeCodigo(css)) {
    const m = TOKEN_COLOR.exec(linea)
    if (m !== null) salida.push({ nombre: m[1], valor: m[2].replace(/\s+/g, ' ') })
  }
  return salida
}

/**
 * Pares de tokens que comparten valor exacto, descontando los permitidos.
 *
 * 📝 `permitidos` existe por un caso real y documentado: `--estado-frenando`
 *    vale a propósito lo mismo que `--bloque-vivo` —frenar y estar vivo son el
 *    mismo azul deliberadamente—. Una excepción **nombrada** es distinta de una
 *    colisión: obliga a escribir por qué, y la prueba sigue vigilando el resto.
 */
export function colisionesDeColor(
  tokens: readonly TokenDeColor[],
  permitidos: readonly (readonly [string, string])[] = [],
): string[] {
  const exento = new Set(permitidos.map(([a, b]) => [a, b].sort().join('|')))
  const salida: string[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j < tokens.length; j += 1) {
      const a = tokens[i]
      const b = tokens[j]
      if (a.valor !== b.valor) continue
      if (exento.has([a.nombre, b.nombre].sort().join('|'))) continue
      salida.push(`${a.nombre} y ${b.nombre} valen los dos «${a.valor}»`)
    }
  }
  return salida
}
