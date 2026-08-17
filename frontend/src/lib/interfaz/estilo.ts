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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y CONTABA LAS CADENAS DE LOS COMENTARIOS COMO SI FUERAN GLOBS
 * ═══════════════════════════════════════════════════════════════════════════
 * Encontrado el 2026-08-16 al documentar dos globs nuevos: el comentario decia
 * que `lib/` podria tener un mapa `{ vivo: 'bg-…' }`, y esta funcion cogio
 * **`bg-…` como una ruta** y la declaro muerta. La guardia acusaba a quien estaba
 * explicando por que la guardia existe.
 *
 * 📝 Es la CUARTA vez que este proyecto tropieza con la misma forma —«contar un
 *    comentario como si fuera un ajuste»—, y las tres anteriores estan escritas
 *    en `CLAUDE.md`. La leccion que ya estaba: **ancla a la sintaxis exacta, y
 *    salta los comentarios**. `buscarProhibiciones` lo hacia desde hace tiempo
 *    con `lineasDeCodigo()`; esta no.
 */
export function globsMuertos(configTailwind: string, existe: (ruta: string) => boolean): string[] {
  // 🔴 Sobre las lineas de CODIGO, no sobre el fichero: ver la nota de arriba.
  const soloCodigo = lineasDeCodigo(configTailwind).join('\n')
  const bloque = soloCodigo.match(/content:\s*\[([\s\S]*?)\]/)
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

/**
 * 📌 `sintaxis` se añadió el 2026-08-15, al meter la tinta del código del
 *    Taller. Se iba a dejar fuera «documentando el hueco», y eso habría sido
 *    justo lo que este proyecto persigue: una comprobación que se cree que
 *    cubre algo y no lo cubre. Ampliar el patrón es una palabra.
 */
const TOKEN_COLOR = /^\s*(--(?:bloque|estado|seccion|sintaxis)-[a-z0-9-]+)\s*:\s*(\d{1,3}\s+\d{1,3}\s+\d{1,3})\s*;/

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

/* ═════════════════════════════════════════════════════════════════════════
 * TOKENS QUE NO PINTAN NADA
 * ═════════════════════════════════════════════════════════════════════════
 *
 * 🔴 EL 2026-08-07 ESCRIBI `text-[color:var(--estado-bien)]` EN UN COMPONENTE
 *    NUEVO. `--estado-bien` **no existe** —el vocabulario dice `--estado-vivo`—
 *    y los tokens de color de este proyecto son **tripletes RGB**
 *    (`--estado-vivo: 21 122 61`), asi que ademas hay que envolverlos en
 *    `rgb()`. Las dos cosas fallan igual: Tailwind genera la clase, el navegador
 *    descarta la declaracion, y el texto sale del color heredado.
 *
 *    Consecuencia medida en la captura: los estados CIEGO y BLOQUEADO —los dos
 *    mas graves de la pantalla de navegacion— salieron en negro, indistinguibles
 *    de un parrafo cualquiera. **No lo vio `tsc`, ni `eslint`, ni las 538
 *    pruebas**, porque un token inexistente es CSS perfectamente valido.
 *
 * ⚠️ Y ESTA GUARDIA NACIO CON OCHO FALSOS POSITIVOS, que es la razon de que su
 *    codigo parezca retorcido. La primera version acusaba a seis componentes
 *    sanos. Dos cosas hay que hacer, y ninguna es opcional:
 *
 *    1. **RESOLVER LA INDIRECCION.** `--tono-seccion: var(--estado-neutro)` no
 *       es un color: hay que seguir la cadena hasta el literal para saber si es
 *       triplete. Sin esto, `rgb(var(--tono-seccion))` parece un error y es
 *       correcto.
 *    2. **DISTINGUIR ASIGNAR DE PINTAR.** `{'--tono-seccion': 'var(--seccion-navegar)'}`
 *       PASA un valor; no lo pinta, asi que no necesita `rgb()`. Es el patron
 *       que usan las seis pantallas para teñirse.
 *
 *    📝 Un verificador con falsos positivos se acaba ignorando, y eso es peor
 *       que no tenerlo. Esta regla la tiene escrita este proyecto por el
 *       verificador del robot, que llego a acumular ocho fallos propios.
 */

/**
 * El CSS con los comentarios en blanco, **conservando las longitudes**.
 *
 * Se sustituye cada caracter de comentario por un espacio en vez de borrarlo,
 * para que cualquier indice calculado sobre el resultado siga valiendo sobre el
 * original. Los saltos de linea se conservan tal cual: si no, un comentario de
 * veinte lineas movería todo lo de abajo.
 */
export function sinComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (bloque) =>
    bloque.replace(/[^\n]/g, ' '))
}

/**
 * El cuerpo de un bloque CSS, contando llaves.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LO QUE HABIA ANTES FUNCIONABA **POR ACCIDENTE**, Y ES PEOR QUE FRAGIL
 * ═══════════════════════════════════════════════════════════════════════════
 * `estilo.test.ts` troceaba asi:
 *
 *     const cuerpo = css.slice(i, css.indexOf('\n  }\n', i))
 *
 * O sea: «hasta la primera llave de cierre indentada con DOS espacios». Y en
 * `globals.css` **`:root` cierra en la columna 0**, asi que ese `indexOf` no
 * paraba en `:root`: seguia hasta el `  }` del `body` que hay dentro de
 * `@layer base`, decenas de lineas mas abajo. El resultado salia correcto **solo
 * porque entre medias no habia ningun otro `--sintaxis-*`**.
 *
 * 🔴 Y la forma de fallo era la mala: si el selector no aparece, `indexOf`
 *    devuelve **-1**, `slice(i, -1)` se traga el fichero **entero**, y los dos
 *    conjuntos salen iguales por basura. **Aprobado sobre nada**, que es el
 *    patron que este proyecto persigue en once sitios.
 *
 * Esto cuenta llaves sobre el CSS ya sin comentarios, asi que no depende de la
 * indentacion, ni del orden, ni de que el bloque este dentro de un `@layer`.
 *
 * 🔴 Y **lanza** en vez de devolver vacio cuando el selector no aparece o
 *    aparece dos veces: un troceador que no encuentra su bloque no puede
 *    contestar «no hay nada», porque eso es indistinguible de un bloque vacio.
 */
export function cuerpoDeBloque(css: string, selector: string): string {
  const limpio = sinComentarios(css)
  const apariciones = [...limpio.matchAll(
    new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
  )]
  if (apariciones.length !== 1) {
    throw new Error(
      `el selector «${selector}» aparece ${apariciones.length} veces, y tiene que aparecer 1`,
    )
  }

  const abre = limpio.indexOf('{', apariciones[0].index)
  if (abre === -1) throw new Error(`el selector «${selector}» no abre ninguna llave`)

  let profundidad = 0
  for (let i = abre; i < limpio.length; i++) {
    if (limpio[i] === '{') profundidad++
    else if (limpio[i] === '}') {
      profundidad--
      // Se devuelve el trozo del CSS ORIGINAL, no del limpio: quien lo use
      // quiere leer declaraciones, y las longitudes coinciden.
      if (profundidad === 0) return css.slice(abre + 1, i)
    }
  }
  throw new Error(`el bloque de «${selector}» no cierra`)
}

/**
 * Animaciones que apuntan a un `@keyframes` que NO esta en la misma hoja.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EXISTE POR UNA DEPENDENCIA QUE NO SE VEIA DESDE NINGUN LADO
 * ═══════════════════════════════════════════════════════════════════════════
 * `@keyframes entrar` lo generaba **Tailwind**, y Tailwind solo emite un
 * fotograma si su utilidad (`animate-entrar`) aparece en un fichero escaneado.
 * Aparecia en **uno**: la ficha del muro.
 *
 * Pero lo consumian **dos**: esa ficha, y `.escalonado` —la entrada de las seis
 * pestañas del robot—, que lo escribia a mano en su `animation:`. Quitar la
 * utilidad de ese unico sitio dejaba a las seis pestañas **sin animacion, en
 * silencio**: CSS sintacticamente perfecto apuntando a un fotograma inexistente.
 *
 * Ni `tsc`, ni `eslint`, ni el navegador dicen nada de eso. Un `animation` que
 * nombra un fotograma que no existe **no es un error de CSS**: simplemente no
 * anima.
 *
 * ⚠️ Solo mira DENTRO de una hoja. Un `@keyframes` declarado en otro fichero CSS
 *    importado daria un falso positivo — hoy no ocurre (hay una sola hoja) y si
 *    algun dia ocurre, esta linea es donde mirar.
 */
export function keyframesHuerfanos(css: string): string[] {
  const limpio = sinComentarios(css)
  const declarados = new Set(
    [...limpio.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
  )
  const usados = new Set(
    // El nombre es el primer identificador de la abreviada `animation:`, y puede
    // venir precedido de la duracion. Se cogen todos los identificadores y se
    // cruzan contra los declarados: lo que no case es una palabra clave (`both`,
    // `infinite`, `ease`…) o una funcion, y esas no estan declaradas.
    [...limpio.matchAll(/animation:\s*([^;]+);/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter((t) => /^[a-z][\w-]*$/i.test(t)),
  )
  return [...usados].filter((u) => !declarados.has(u) && esNombreDeFotograma(u, limpio))
}

/** ¿Es `u` el nombre de un fotograma, o una palabra clave de `animation`? */
function esNombreDeFotograma(u: string, css: string): boolean {
  // Cualquier identificador que aparezca tras `@keyframes` en ALGUNA hoja del
  // mundo es candidato; aqui solo se puede distinguir por descarte, asi que se
  // lista lo que la abreviada `animation` admite como palabra clave.
  const PALABRAS = new Set([
    'normal', 'reverse', 'alternate', 'alternate-reverse',
    'none', 'forwards', 'backwards', 'both',
    'running', 'paused', 'infinite',
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'step-start', 'step-end', 'initial', 'inherit', 'unset', 'revert',
  ])
  return !PALABRAS.has(u) && !css.includes(`--${u}`)
}

/* ═══════════════════════════════════════════════════════════════════════════
   UNA CLASE SIN CONSUMIDOR ES UNA TRAMPA ARMADA
   ═══════════════════════════════════════════════════════════════════════════
   🔴 VAN CUATRO EN ESTA HOJA, y la lista importa porque las cuatro fallaron de
      la misma forma:

     `.filo-estado`   decia colorear el canto de las tarjetas segun el estado.
                      Cero consumidores. Y `estilo.test.ts` llego a AFIRMAR que
                      un componente le inyectaba su token — no lo hacia.
     `.muestra-led`   pintaba la muestra del color pedido. La muestra acabo
                      siendo un `<canvas>` y la regla se quedo sola.
     `.pozo-interior` llevaba `rgb(0 0 0 / 0.2)` del tema OSCURO, o sea un
                      bloque gris medio dentro de una ficha blanca. Nadie lo
                      vio porque no hay ninguna pantalla donde mirarla.
     `.trama-mirar`   el TERCER CODIGO de accesibilidad, que este proyecto
     `.trama-ir`      declara irrenunciable — «una de cada doce personas no
                      distingue el lima del coral, y esto se proyecta»— y que
                      lleva desde siempre **declarado y sin construir**.

   Lo peligroso no es la regla muerta: es que alguien la lea y **crea que el
   sistema ya tiene esa pieza**. La ultima de la lista es el caso puro — el
   proyecto se ha estado diciendo por escrito que tiene triple codificacion.

   📌 Misma familia que todo lo que este repositorio persigue: el `chmod` sobre
      vfat, el `usercfg.txt` de 24.04, el drop-in `99-`. **Configuracion que
      existe y no hace nada.**

   ⚠️ LO QUE ESTA GUARDIA NO PUEDE VER: una clase compuesta en tiempo de
      ejecucion (`trama-${estado}`). Es texto que no existe en el fuente, asi
      que dara un falso positivo — y la respuesta correcta es **no componer
      nombres de clase**, no relajar la guardia. Tailwind exige lo mismo por su
      cuenta: su escaneo tampoco ve una clase que solo existe al ejecutar.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Los nombres de clase que `globals.css` define, sin repetir.
 *
 * Coge el nombre de CADA clase de cada selector, no solo la primera: en
 * `.proyeccion .vidrio` las dos estan definidas y las dos tienen que estar
 * vivas. Y descarta lo que va detras de `>`, `:` o `::`, que no son clases.
 */
export function clasesDefinidas(css: string): string[] {
  const limpio = sinComentarios(css)
  const fuera = new Set<string>()
  /*
   * 🔴 SIN ANCLAR A PRINCIPIO DE LINEA, y la primera version lo hacia: se
   *    escribio `/^\s*([^{}@;]+)\{/gm` y fallaba con TODO el CSS en una linea —
   *    que es como llega un `@media (hover: hover) { .a:hover { … } }` y como
   *    llega cualquier hoja minificada. Un extractor que solo ve el CSS bien
   *    sangrado es un extractor que da la razon a quien lo escribio.
   *
   * Se recorren las llaves de apertura: el SELECTOR es lo que hay desde la
   * frontera anterior (`{`, `}` o `;`) hasta esa llave. Una declaracion no
   * puede confundirse porque acaba en `;`, y una at-rule se descarta sola: su
   * prologo no lleva `.` seguido de letra (`0.2` de un `rgb()` tampoco).
   */
  let desde = 0
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (c === '{') {
      const prologo = limpio.slice(desde, i)
      if (!prologo.trimStart().startsWith('@')) {
        for (const m of prologo.matchAll(/\.([a-z][\w-]*)/gi)) fuera.add(m[1])
      }
      desde = i + 1
    } else if (c === '}' || c === ';') {
      desde = i + 1
    }
  }
  return [...fuera].sort()
}

/**
 * Las clases de `css` que no aparecen en ningun fuente de `fuentes`.
 *
 * 🔴 `exentas` existe y hay que justificar cada entrada AL AÑADIRLA. Una lista
 *    de excepciones que crece sin motivo convierte la guardia en decoracion —
 *    que es justo lo que la guardia persigue.
 */
export function piezasHuerfanas(
  css: string, fuentes: string[], exentas: readonly string[] = [],
): string[] {
  const exenta = new Set(exentas)
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 SIN COMENTARIOS, Y ESTO NO ES HIGIENE: LA PRIMERA VERSION DIO VERDE
   *      SOBRE LAS CUATRO HUERFANAS QUE EXISTE PARA CAZAR
   * ═══════════════════════════════════════════════════════════════════════════
   * Medido el 2026-08-16, al estrenarla. `.rotulo` «tenia consumidor» porque la
   * palabra *rotulo* sale en VEINTE comentarios («el rotulo de `Grupo` lleva el
   * grafito de esta pantalla»). Ninguno es un `className`.
   *
   * 📝 QUINTA vez que este proyecto cuenta un comentario como si fuera un
   *    ajuste, y la leccion ya estaba escrita tres veces en `CLAUDE.md` y una
   *    aqui mismo, doce lineas mas arriba, en `globsMuertos`. La lei el mismo
   *    dia. Por eso ahora se pasa por `lineasDeCodigo()`, que es la funcion que
   *    ya existia para esto.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  const todo = fuentes.map((f) => textoDeCadenas(lineasDeCodigo(f).join('\n'))).join('\n')
  return clasesDefinidas(css)
    .filter((c) => !exenta.has(c))
    // Se busca el nombre con frontera por delante: `trama-ir` no debe casar
    // dentro de `mi-trama-ir`, pero SI dentro de `class="vidrio pulsable"`.
    .filter((c) => !new RegExp(`(^|[^\\w-])${c}(?![\\w-])`).test(todo))
}

/**
 * EL TEXTO DE LOS LITERALES DE CADENA, y nada más.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 SEXTA VEZ DE LA MISMA FAMILIA, Y AHORA UN PASO MÁS ADENTRO
 * ═══════════════════════════════════════════════════════════════════════════
 * `piezasHuerfanas` ya dejó de contar comentarios —esa fue la quinta— pero
 * seguía buscando en **todo el código**. Y catorce de las clases de esta hoja
 * son palabras españolas sueltas, así que una auditoría del 2026-08-17 midió
 * que **seis no podían declararse huérfanas NUNCA**, aunque se borrara su
 * último `className`:
 *
 *     unidad      `{ unidad: 'cm' }`              un nombre de campo
 *     cifra       `const { numero: cifra }`       un nombre de variable
 *     proyeccion  `proyeccion: boolean`           un nombre de propiedad
 *     entrar      `href: '/entrar'`               una RUTA
 *     palanca     `from '@/lib/interfaz/palanca'` un MÓDULO
 *
 * Ya no cuenta comentarios: contaba **código que no es una clase**.
 *
 * 🔴 Y la restricción NO puede ser «solo dentro de `className=`», que es lo
 *    primero que se piensa: varias clases vivas viven en **tablas de estilo**
 *    —`Insignia.tsx`, `PanelInfrarrojos.tsx`, `BaldosaRobot.tsx`— y no en un
 *    `className` directo. Eso las habría declarado huérfanas: un falso
 *    positivo, que en una guardia es peor que el falso negativo, porque se
 *    acaba desactivando.
 *
 * → Lo que queda: **el texto de los literales**, menos los que son rutas de
 *   módulo o de navegación (`@/…`, `./…`, `/…`, `node:…`). Una clase siempre
 *   viaja dentro de una cadena; un nombre de variable, nunca.
 *
 * 🔴 Y el `${…}` de las plantillas NO se sustituye, al contrario que en
 *    `gruposDeClases`. Copiar aquel `replace` fue mi primer intento y **dio dos
 *    falsos positivos inmediatos**: `proyeccion` y `palanca-puno-suelto` viven
 *    justo DENTRO de la sustitución —`${cond ? 'proyeccion' : ''}`—, que es el
 *    modo natural de poner una clase condicional. Borrarla borraba la clase.
 *    El pegado que aquel `replace` evitaba ya lo impide la frontera de palabra
 *    del `RegExp` de arriba.
 */
export function textoDeCadenas(fuente: string): string {
  const trozos: string[] = []
  for (const m of fuente.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    const v = m[1] ?? m[2] ?? m[3] ?? ''
    if (v === '') continue
    // Rutas de módulo y de navegación: nunca son un nombre de clase.
    if (/^[@.]?\//.test(v) || v.startsWith('node:')) continue
    trozos.push(v)
  }
  return trozos.join('\n')
}

/** Un triplete `R G B` como los que declara `globals.css`. No un color CSS. */
const TRIPLETE = /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/

/** `--x: 12 34 56;` de una hoja de estilos, en un mapa. */
export function tokensDeclarados(css: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) m.set(t[1], t[2].trim())
  return m
}

/** Sigue `var(--a)` -> `var(--b)` -> `"21 122 61"`. `undefined` si no existe. */
export function resolverToken(
  nombre: string, decl: Map<string, string>, saltos = 0,
): string | undefined {
  const v = decl.get(nombre)
  if (v === undefined || saltos > 6) return undefined
  const indirecto = v.match(/^var\((--[\w-]+)\)$/)
  return indirecto === null ? v : resolverToken(indirecto[1], decl, saltos + 1)
}

/**
 * Los usos de tokens que **no pintan nada** en un fuente. Tres formas:
 * el token no existe · es triplete y no lleva `rgb()` · lleva `rgb()` sin serlo.
 */
export function tokensQueNoPintan(fuente: string, decl: Map<string, string>): string[] {
  const malos: string[] = []
  fuente.split('\n').forEach((linea, i) => {
    if (esComentario(linea)) return
    // 🔴 Fuera las ASIGNACIONES antes de mirar: ver el punto 2 de arriba.
    const sinAsignar = linea.replace(/'--[\w-]+'\s*:\s*'[^']*'/g, '')
    for (const m of sinAsignar.matchAll(/(rgb\(\s*)?var\((--[\w-]+)\)/g)) {
      const envuelto = m[1] !== undefined
      const val = resolverToken(m[2], decl)
      if (val === undefined) malos.push(`linea ${i + 1}: ${m[2]} NO EXISTE`)
      else if (TRIPLETE.test(val) && !envuelto) {
        malos.push(`linea ${i + 1}: ${m[2]} es el triplete «${val}» y le falta rgb()`)
      } else if (!TRIPLETE.test(val) && envuelto) {
        malos.push(`linea ${i + 1}: ${m[2]} ya es «${val}»; el rgb() sobra`)
      }
    }
  })
  return malos
}
