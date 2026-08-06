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
  const lineas = fuente.split('\n').filter((l) => !esComentario(l))
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
