import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FUENTES_REMOTAS, PROHIBICIONES, buscarProhibiciones, colisionesDeColor, colisionesDeTransicion,
  esComentario, ficherosDeEstilo, globsMuertos, gruposDeClases, lineasDeCodigo, partirEnComas,
  tokensDeColor, transicionesDeClases,
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

describe('🔴🔴 lineasDeCodigo: el falso positivo que mordio tres veces en un dia', () => {
  it('salta las lineas INTERIORES de un comentario JSX, que no empiezan por *', () => {
    /*
     * Esta es la forma que mordio: `{(barra)*` abre, las lineas de dentro no
     * llevan ningun marcador, y `esComentario()` -que mira una linea aislada-
     * las daba por codigo. Explicar por que algo esta prohibido disparaba la
     * prohibicion, que es lo contrario de lo que la cabecera de `estilo.ts`
     * promete.
     */
    const fuente = [
      '{/*',
      '  🔴 EL DEGRADADO IBA DE `from-white` A UN GRIS FIJO y era invisible.',
      '     Por eso ahora las paradas salen de variables.',
      '*/}',
      '<h1 className="text-foreground">Flota</h1>',
    ].join('\n')
    expect(buscarProhibiciones(fuente)).toEqual([])
    expect(lineasDeCodigo(fuente)).toEqual(['<h1 className="text-foreground">Flota</h1>'])
  })

  it('y las de un comentario de bloque normal', () => {
    const fuente = '/*\n  antes ponia shadow-xl y se quito\n*/\nconst x = 1'
    expect(buscarProhibiciones(fuente)).toEqual([])
  })

  it('🔴 pero NO deja de mirar el codigo que viene despues del bloque', () => {
    // La comprobacion que impide que este arreglo se convierta en un agujero:
    // si el estado «dentro de un bloque» no se cerrara, la guardia se apagaria
    // desde el primer comentario del fichero hasta el final.
    const fuente = '/*\n  explico shadow-xl\n*/\n<div className="shadow-xl" />'
    expect(buscarProhibiciones(fuente)).toEqual(['shadow-lg / shadow-xl / drop-shadow'])
  })

  it('🔴 un `/*` a media linea NO abre bloque: podria ser una cadena', () => {
    // Conservador a proposito. Un falso NEGATIVO -dejar de vigilar codigo real-
    // es peor que un falso positivo, asi que solo se abre al principio de linea.
    const fuente = 'const r = "/*"\n<div className="shadow-xl" />'
    expect(buscarProhibiciones(fuente)).toEqual(['shadow-lg / shadow-xl / drop-shadow'])
  })

  it('un bloque que abre y cierra en la misma linea no traga lo que sigue', () => {
    const fuente = '/* nada */\n<div className="shadow-xl" />'
    expect(buscarProhibiciones(fuente)).toEqual(['shadow-lg / shadow-xl / drop-shadow'])
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
// La colision de `transition`
// ═══════════════════════════════════════════════════════════════════════════

describe('partirEnComas', () => {
  it('🔴 no parte por las comas de dentro de un cubic-bezier', () => {
    // Con `split(',')` a secas esto darian CUATRO trozos y tres empezarian por
    // un numero, asi que la lista de propiedades saldria vacia y la guardia
    // aprobaria sin haber mirado nada. Es la misma forma que `globsMuertos`
    // parseando a cero: un aprobado sobre una comprobacion que no miro.
    expect(partirEnComas('transform 140ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms ease'))
      .toEqual(['transform 140ms cubic-bezier(0.23, 1, 0.32, 1)', ' opacity 200ms ease'])
  })
})

describe('transicionesDeClases', () => {
  const css = `
    .vidrio { box-shadow: 0 1px 2px red; transition: box-shadow 180ms ease, border-color 180ms ease; }
    .pulsable { transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 180ms ease; }
    .quieta { color: red; }
  `

  it('lee la clase, su orden y las propiedades que transiciona', () => {
    const t = transicionesDeClases(css)
    expect(t.map((x) => x.clase)).toEqual(['vidrio', 'pulsable'])
    expect(t[0].propiedades).toEqual(['box-shadow', 'border-color'])
    expect(t[1].propiedades).toEqual(['transform', 'box-shadow'])
    // El orden es la posicion en el fichero, que es la regla de la cascada.
    expect(t[1].orden).toBeGreaterThan(t[0].orden)
  })

  it('🔴 ignora pseudoclases y descendientes: ahi la especificidad es intencionada', () => {
    const otro = '.a:hover { transition: color 1ms; }\n.b .c { transition: color 1ms; }'
    expect(transicionesDeClases(otro)).toEqual([])
  })
})

describe('gruposDeClases', () => {
  it('saca las clases de las tres formas que usa este repositorio', () => {
    expect(gruposDeClases('<div className="vidrio pulsable p-5" />')).toEqual([
      ['vidrio', 'pulsable', 'p-5'],
    ])
    expect(gruposDeClases('<div className={`vidrio pulsable ${X[y]}`} />')).toEqual([
      ['vidrio', 'pulsable'],
    ])
  })

  it('🔴 borra la interpolacion en vez de adivinarla', () => {
    // Lo que trae `${…}` depende de datos en ejecucion. Perder una clase da un
    // falso NEGATIVO, que es el lado seguro; inventarla daria una alarma sobre
    // codigo sano, y una guardia que grita sin motivo se acaba ignorando.
    expect(gruposDeClases("<div className={`a ${b ? 'pulsable' : ''} c`} />"))
      .toEqual([['a', 'c']])
  })
})

describe('colisionesDeTransicion', () => {
  const vidrio = { clase: 'vidrio', orden: 10, propiedades: ['box-shadow', 'border-color'] }
  const juntas = [['vidrio', 'pulsable']]

  it('🔴 delata a la clase que pierde una propiedad que la ganadora no cubre', () => {
    // Este es EXACTAMENTE el defecto que estuvo en el repositorio: `.pulsable`
    // gana por ir despues y no menciona `box-shadow`, asi que la elevacion del
    // hover de las dieciseis baldosas aparecia de golpe.
    const pulsable = { clase: 'pulsable', orden: 20, propiedades: ['transform', 'border-color'] }
    expect(colisionesDeTransicion([vidrio, pulsable], juntas))
      .toEqual(['«vidrio» pierde box-shadow frente a «pulsable»'])
  })

  it('🔴 y NO se queja cuando la ganadora las cubre todas', () => {
    // La regla no es «dos clases no pueden declarar transition»: eso prohibiria
    // el arreglo correcto. Es que la perdedora no pierda nada.
    const pulsable = {
      clase: 'pulsable', orden: 20,
      propiedades: ['transform', 'border-color', 'box-shadow'],
    }
    expect(colisionesDeTransicion([vidrio, pulsable], juntas)).toEqual([])
  })

  it('una sola clase con transicion no colisiona con nadie', () => {
    expect(colisionesDeTransicion([vidrio], juntas)).toEqual([])
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

  it('🔴🔴 ninguna clase pierde su `transition` frente a otra que viaja con ella', () => {
    /*
     * La guardia contra el defecto que estuvo vivo todo el desarrollo y que no
     * ve ninguna herramienta: `.vidrio` y `.pulsable` declaraban las dos la
     * ABREVIADA, iban juntas en las dieciseis baldosas del muro, y la segunda
     * borraba la primera. La elevacion del hover aparecia de golpe.
     *
     * ⚠️ Se recorren `componentes` Y `app`: el defecto vivia en una baldosa,
     *    pero la combinacion puede escribirse en cualquier pantalla.
     */
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
    const transiciones = transicionesDeClases(css)
    // Si esto baja de 2 no hay ninguna colision POSIBLE y la prueba no mira
    // nada: seria un aprobado vacio, como el `content` que parsea a 0 globs.
    expect(transiciones.length, 'el parseo del CSS no encontro transiciones').toBeGreaterThan(1)

    const grupos: string[][] = []
    for (const dir of [join(SRC, 'componentes'), join(SRC, 'app')]) {
      for (const f of ficherosDeEstilo(dir)) {
        if (f.endsWith('.css')) continue
        grupos.push(...gruposDeClases(readFileSync(f, 'utf8')))
      }
    }
    expect(grupos.length, 'no se leyo ningun className').toBeGreaterThan(20)

    expect(colisionesDeTransicion(transiciones, grupos)).toEqual([])
  })

  it('🔴 la tipografia no se descarga de la red', () => {
    // La F0 -el experimento que bloquea el producto- es si el AP del aula deja
    // pasar el trafico. Una interfaz que necesita a Google para tener letra cae
    // en silencio justo donde va a usarse.
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
    expect(FUENTES_REMOTAS.test(css), 'globals.css importa una fuente remota').toBe(false)
  })

  it('🔴🔴 el vocabulario de color no colisiona entre sus tres ejes', () => {
    /*
     * `--bloque-*` es el ESTADO del robot, `--estado-*` un HECHO confirmado y
     * `--seccion-*` la IDENTIDAD de una pantalla. Dos tokens de ejes distintos
     * con el mismo valor no son un detalle estético: rompen el eje.
     *
     * Ha pasado TRES veces, las tres con la regla escrita tres líneas más
     * arriba en el mismo fichero, y las tres se encontraron mirando píxeles.
     * El ojo humano compara colores que ve juntos; estos nunca se ven juntos.
     */
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
    const tokens = tokensDeColor(css)
    // Que los encuentre de verdad: sin esto, una expresion regular rota daria
    // cero tokens, cero colisiones y verde. Es la trampa del comprobador muerto.
    expect(tokens.length, 'no se leyo ningun token de color').toBeGreaterThan(15)

    const choques = colisionesDeColor(tokens, [
      // Excepción NOMBRADA y documentada en `globals.css`: frenar y estar vivo
      // comparten azul a propósito. Escribirla aquí obliga a justificarla.
      ['--estado-frenando', '--bloque-vivo'],
    ])
    expect(choques, `colisiones de color: ${choques.join(' · ')}`).toEqual([])
  })

  it('🔴 ningun glob de `content` apunta a un directorio que no existe', () => {
    // El comentario del propio tailwind.config.ts lo documenta: un glob roto
    // hace que los componentes se monten SIN NINGUN ESTILO y sin dar error.
    const config = readFileSync(join(FRONTEND, 'tailwind.config.ts'), 'utf8')
    const muertos = globsMuertos(config, (r) => existsSync(join(FRONTEND, r)))
    expect(muertos, `globs que no casan con ningun directorio: ${muertos.join(' ')}`).toEqual([])
  })
})

describe('colisionesDeColor', () => {
  it('pilla las tres colisiones REALES que este repositorio ha tenido', () => {
    // No son ejemplos inventados: los tres pares estuvieron en `globals.css`.
    const css = `
      --bloque-vivo: 30 58 210;
      --seccion-flota: 30 58 210;
      --destructive: 190 42 22;
      --estado-ir: 190 42 22;
      --seccion-conducir: 6 118 140;
      --seccion-entrar: 6 118 140;
    `
    const choques = colisionesDeColor(tokensDeColor(css))
    // `--destructive` no lleva prefijo de eje, asi que ese par NO lo ve esta
    // guardia. Se dice aqui para que el hueco sea declarado y no una sorpresa.
    expect(choques).toHaveLength(2)
    expect(choques.join(' ')).toContain('--seccion-flota')
    expect(choques.join(' ')).toContain('--seccion-entrar')
  })

  it('🔴 un valor citado dentro de un COMENTARIO no cuenta', () => {
    /*
     * Es la trampa que ya mordio tres veces en un dia con `lineasDeCodigo`:
     * documentar una colision arreglada —citando los valores viejos— volveria a
     * dispararla, y entonces la unica salida seria borrar la explicacion.
     */
    const css = `
      /* Antes esto valia --seccion-flota: 30 58 210; y chocaba. */
      --bloque-vivo: 30 58 210;
      --seccion-flota: 22 44 150;
    `
    expect(colisionesDeColor(tokensDeColor(css))).toEqual([])
  })

  it('una excepcion NOMBRADA no cuenta, y solo esa', () => {
    const css = `
      --bloque-vivo: 30 58 210;
      --estado-frenando: 30 58 210;
      --seccion-lidar: 30 58 210;
    `
    const choques = colisionesDeColor(tokensDeColor(css), [['--estado-frenando', '--bloque-vivo']])
    // Los otros dos pares que forma el mismo valor siguen saltando.
    expect(choques).toHaveLength(2)
    expect(choques.every((c) => c.includes('--seccion-lidar'))).toBe(true)
  })
})

describe('🔴 la exencion de degradado, y por que no puede ensancharse', () => {
  it('un titular con bg-clip-text esta eximido: ahi el degradado es TINTA', () => {
    // Las paradas salen de variables, que es lo que exige la OTRA prohibicion.
    const titular = '<h1 className="bg-gradient-to-b from-[rgb(var(--foreground))] '
      + 'to-[rgb(var(--estado-neutro))] bg-clip-text text-transparent">'
    expect(buscarProhibiciones(titular)).toEqual([])
  })

  it('🔴🔴 pero `bg-clip-text` NO absuelve una parada con color literal', () => {
    /*
     * El titular real de tres pantallas, tal y como estuvo hasta hoy. Pasaba la
     * guardia entera —la exencion de degradado lo cubria— y **era invisible**:
     * `from-white` sobre papel es tinta blanca sobre papel blanco. La exencion
     * de degradado dice «aqui es tinta, no relleno», que sigue siendo verdad; lo
     * que no dice es que esa tinta se lea, y eso lo comprueba la otra regla.
     */
    const antes = '<h1 className="bg-gradient-to-b from-white to-[#A8B0C8] bg-clip-text text-transparent">'
    expect(buscarProhibiciones(antes)).toEqual(['parada de degradado con color literal'])
  })

  it('🔴 y NO alcanza al hexadecimal de una muestra de LED', () => {
    // `PanelLeds` pinta el RGB FISICO que va a emitir el robot. Ese literal no
    // debe seguir al tema: seria mentir sobre lo que hace el robot.
    expect(buscarProhibiciones("muestra: 'bg-[#ff0000]'")).toEqual([])
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
      '<h1 className="bg-gradient-to-b from-[rgb(var(--foreground))] bg-clip-text text-transparent">Flota</h1>',
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
