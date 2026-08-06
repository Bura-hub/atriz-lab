import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FUENTES_REMOTAS, PROHIBICIONES, buscarProhibiciones, esComentario, ficherosDeEstilo,
  globsMuertos,
} from './estilo'

const RAIZ = dirname(fileURLToPath(import.meta.url))
const FRONTEND = join(RAIZ, '..', '..', '..')
const SRC = join(FRONTEND, 'src')

// ═══════════════════════════════════════════════════════════════════════════
// Las funciones, aisladas
// ═══════════════════════════════════════════════════════════════════════════

describe('buscarProhibiciones', () => {
  it('encuentra un bucle infinito escrito con una utilidad', () => {
    expect(buscarProhibiciones('<span className="animate-pulse" />'))
      .toContain('animate-pulse / animate-bounce / animate-ping')
  })

  it('y escrito en CSS a mano', () => {
    expect(buscarProhibiciones('.punto { animation: pulse 2s ease infinite; }'))
      .toContain('animation: … infinite')
  })

  it('🔴 una animacion con duracion FINITA no se prohibe', () => {
    // La regla no es «nada se mueve»: es «nada se mueve para siempre». Una
    // transicion de 150 ms al aparecer un aviso es funcional -evita un cambio
    // brusco sobre texto que alguien esta leyendo- y no simula vida.
    expect(buscarProhibiciones('.aviso { animation: aparecer 150ms ease-out; }')).toEqual([])
  })

  it('encuentra sombras de relieve y gradientes', () => {
    expect(buscarProhibiciones('class="shadow-lg"')).toContain('shadow-lg / shadow-xl / drop-shadow')
    expect(buscarProhibiciones('class="bg-gradient-to-r"')).toContain('gradientes')
  })

  it('🔴 pero NO en los comentarios: hay que poder explicar la regla', () => {
    // Sin esto, este mismo fichero -y `CLAUDE.md` en un docstring- dispararian
    // la prueba, y la unica salida seria dejar de documentar por que algo esta
    // prohibido. Misma decision que en `buscarFrasesProhibidas`.
    expect(buscarProhibiciones('// prohibido animate-pulse porque simula vida')).toEqual([])
    expect(buscarProhibiciones(' * nada de shadow-xl aqui')).toEqual([])
  })

  it('cada prohibicion trae su motivo escrito', () => {
    for (const p of PROHIBICIONES) {
      expect(p.porque.length, `«${p.nombre}» sin motivo`).toBeGreaterThan(30)
    }
  })
})

describe('esComentario', () => {
  it('reconoce las tres formas que aparecen en este repositorio', () => {
    expect(esComentario('  // asi')).toBe(true)
    expect(esComentario('   * asi')).toBe(true)
    expect(esComentario('  /* asi')).toBe(true)
    expect(esComentario('  const x = 1')).toBe(false)
  })
})

describe('globsMuertos', () => {
  const config = `content: [
    './src/app/**/*.tsx',
    './src/pages/**/*.tsx',
  ],`

  it('señala el glob cuyo directorio no existe', () => {
    expect(globsMuertos(config, (r) => r === './src/app')).toEqual(['./src/pages/**/*.tsx'])
  })

  it('🔴 un bloque que parsea a CERO globs LANZA, no devuelve vacio', () => {
    // Misma guarda que `extraerItems` del comprobador de contrato: cero entradas
    // no es una lista vacia legitima, es un parseo cortado por un ] prematuro.
    // Devolver [] seria un aprobado sobre una comprobacion que no miro nada.
    expect(() => globsMuertos('content: [],', () => true)).toThrow(/0 globs/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La guardia sobre el arbol de verdad
// ═══════════════════════════════════════════════════════════════════════════

describe('la guardia visual sobre el codigo real', () => {
  it('hay ficheros que vigilar (si esto falla, la prueba no esta mirando nada)', () => {
    expect(ficherosDeEstilo(join(SRC, 'componentes')).length).toBeGreaterThan(10)
  })

  /**
   * 🔴 LA GUARDIA SE ENCUENTRA A SI MISMA, Y HAY QUE EXCLUIRLA EXPLICITAMENTE.
   *
   * `estilo.ts` contiene las expresiones regulares —o sea, las cadenas
   * prohibidas literalmente— y este fichero contiene los casos de prueba, que
   * son esas mismas cadenas otra vez. Sin esta exclusion la prueba falla SIEMPRE
   * y señala como culpable al codigo escrito para vigilar.
   *
   * Es la misma forma que el `pkill -f` que este proyecto documenta dos veces:
   * **el patron se encuentra a si mismo**. Alli la solucion fue el corchete;
   * aqui es nombrar los dos ficheros, porque saltarse los comentarios no basta
   * -las cadenas viven en codigo, no en comentarios-.
   *
   * ⚠️ Y por eso la exclusion es por NOMBRE EXACTO y no por directorio: dejar
   *    fuera `lib/interfaz/` entero silenciaria de paso cualquier violacion
   *    futura de sus otros nueve ficheros.
   */
  const PROPIOS = ['estilo.ts', 'estilo.test.ts']

  it('🔴 ningun fichero de la interfaz usa lo prohibido', () => {
    // ⚠️ `src/components/` (con C, en ingles) queda FUERA a proposito: son 1125
    //    lineas de maqueta huerfana que nadie importa y que se borran en la
    //    ultima fase. Incluirlas ahora seria bloquear el trabajo con deuda que
    //    ya esta condenada.
    const culpables: string[] = []
    for (const dir of [join(SRC, 'componentes'), join(SRC, 'app'), join(SRC, 'lib')]) {
      for (const f of ficherosDeEstilo(dir)) {
        if (PROPIOS.some((n) => f.endsWith(n))) continue
        const malas = buscarProhibiciones(readFileSync(f, 'utf8'))
        if (malas.length > 0) culpables.push(`${f}: ${malas.join(', ')}`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('🔴 y la exclusion es minima: solo esos dos ficheros', () => {
    // Si alguien la amplia a un directorio, esta prueba lo delata. Una
    // exclusion que crece en silencio convierte la guardia en decoracion.
    expect(PROPIOS).toHaveLength(2)
    expect(ficherosDeEstilo(join(SRC, 'lib', 'interfaz')).length).toBeGreaterThan(8)
  })

  it('🔴 la tipografia no se descarga de la red', () => {
    // La F0 -el experimento que bloquea el producto- es si el AP del aula deja
    // pasar el trafico. Una interfaz que necesita a Google para tener letra cae
    // en silencio justo donde va a usarse.
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
    expect(FUENTES_REMOTAS.test(css), 'globals.css importa una fuente remota').toBe(false)
  })

  it('🔴 ningun glob de `content` apunta a un directorio que no existe', () => {
    // El comentario del propio tailwind.config.ts lo documenta: un glob roto
    // hace que los componentes se monten SIN NINGUN ESTILO y sin dar error.
    const config = readFileSync(join(FRONTEND, 'tailwind.config.ts'), 'utf8')
    const muertos = globsMuertos(config, (r) => existsSync(join(FRONTEND, r)))
    expect(muertos, `globs que no casan con ningun directorio: ${muertos.join(' ')}`).toEqual([])
  })
})

describe('🔴 la exencion de degradado, y por que no puede ensancharse', () => {
  it('un titular con bg-clip-text esta eximido: ahi el degradado es TINTA', () => {
    const titular = '<h1 className="bg-gradient-to-b from-white to-[#A8B0C8] bg-clip-text text-transparent">'
    expect(buscarProhibiciones(titular)).toEqual([])
  })

  it('🔴 un RELLENO con degradado sigue prohibido', () => {
    // Es lo que traia la maqueta borrada: tarjetas y botones con degradado,
    // donde el color SIGNIFICA un estado y el degradado lo diluye.
    expect(buscarProhibiciones('<div className="bg-gradient-to-br from-blue-500 to-cyan-400">'))
      .toEqual(['gradientes'])
  })

  it('🔴🔴 la exencion es POR LINEA: un titular no absuelve al resto del fichero', () => {
    /*
     * Si se comprobara sobre el fichero entero, bastaria con tener un titular
     * eximido en cualquier parte para que todos los rellenos pasaran. Es
     * exactamente la forma de fallo que este proyecto persigue: una guardia que
     * se desactiva por accidente y sigue contando como aprobada.
     */
    const fichero = [
      '<h1 className="bg-gradient-to-b from-white bg-clip-text text-transparent">Flota</h1>',
      '<button className="bg-gradient-to-r from-red-500 to-orange-400">Parar</button>',
    ].join('\n')
    expect(buscarProhibiciones(fichero)).toEqual(['gradientes'])
  })

  it('SOLO DOS prohibiciones tienen exencion, y son estas', () => {
    /*
     * Si alguien añade otra, que sea un acto deliberado y visible en el diff.
     * Esta lista ES ese registro, y por eso la prueba nombra las dos:
     *
     *  · «gradientes» — la de siempre.
     *  · «animation: … infinite» — añadida al pasar el tema a papel claro, y
     *    acotada a `respirar-a` / `respirar-b`, los dos orbes de `.luz-ambiente`.
     *    El motivo de la prohibicion es que sobre un INDICADOR DE ESTADO un
     *    bucle infinito es indistinguible de un latido real; esos dos orbes
     *    estan en el fondo fijo, desenfocados 100 px, y no cuelgan de ningun
     *    dato ni de ningun robot, asi que no hay nada que puedan afirmar en
     *    falso. Donde el motivo si aplica, la prohibicion sigue entera.
     *
     * 🔴 Y la exencion es POR NOMBRE, no por fichero ni por regla: cualquier
     *    otra animacion infinita en `globals.css` sigue fallando.
     */
    // En el orden en que estan DECLARADAS, no alfabetico: si alguien reordena
    // la lista, esta prueba lo dice y obliga a mirar por que.
    const conExencion = PROHIBICIONES.filter((p) => p.exime !== undefined).map((p) => p.nombre)
    expect(conExencion).toEqual(['animation: … infinite', 'gradientes'])
  })

  it('🔴 la exencion del bucle NO absuelve a cualquier animacion infinita', () => {
    // La prueba que impide que la exencion se ensanche sola: otro nombre de
    // animacion en la misma forma tiene que seguir cayendo.
    expect(buscarProhibiciones('animation: latido 2s ease infinite;')).toEqual([
      'animation: … infinite',
    ])
    expect(buscarProhibiciones('animation: respirar-a 23s ease infinite;')).toEqual([])
  })
})
