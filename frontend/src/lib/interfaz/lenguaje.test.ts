import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PARADA_ACTIVA,
  FRASES_PROHIBIDAS, LO_QUE_NO_SE_PUEDE_DECIR, ORDEN_ENVIADA, PARADA_ENVIADA, PARADA_NO_ENVIADA,
  buscarFrasesProhibidas, esLineaDeComentario, normalizar, textoDeConfirmacion,
} from './lenguaje'
import { SERVICIOS, SERVICIOS_SIN_CONFIRMACION } from '../rosbridge/contrato'

// ═══════════════════════════════════════════════════════════════════════════
// Las frases, una por una
// ═══════════════════════════════════════════════════════════════════════════
describe('las frases honestas', () => {
  it('🔴 «orden enviada», y no dice nada del efecto', () => {
    expect(ORDEN_ENVIADA).toBe('orden enviada')
    // El literal, no la constante: una prueba que compara la constante consigo
    // misma pasa aunque alguien cambie su valor por el prohibido. Esa mutacion
    // ya se colo una vez en este repositorio (R2b del informe de la capa 1).
    expect(normalizar(ORDEN_ENVIADA)).not.toContain('confirmad')
    expect(normalizar(ORDEN_ENVIADA)).not.toContain('encendid')
    expect(normalizar(ORDEN_ENVIADA)).not.toContain('cambiad')
  })

  it('🔴 «parada enviada», NUNCA «parada activa»', () => {
    expect(PARADA_ENVIADA).toBe('parada enviada')
    expect(normalizar(PARADA_ENVIADA)).not.toContain('activa')
    expect(buscarFrasesProhibidas(PARADA_ENVIADA)).toEqual([])
  })

  it('cuando la parada NO sale, se dice en mayusculas y sin rodeos', () => {
    expect(PARADA_NO_ENVIADA).toContain('NO SE HA ENVIADO')
  })
})

describe('textoDeConfirmacion — lo decide contrato.ts, no este fichero', () => {
  it('🔴 NINGUNO de los diez servicios se describe como «confirmado»', () => {
    for (const s of SERVICIOS) {
      const t = normalizar(textoDeConfirmacion(s))
      expect(t).not.toContain('confirmad')
      expect(t).not.toContain('garantiz')
    }
  })

  it('los cuatro de respuesta vacia dicen que no llega ni un bit', () => {
    for (const s of SERVICIOS_SIN_CONFIRMACION) {
      expect(textoDeConfirmacion(s)).toContain('vacío')
    }
  })

  it('🔴 los que devuelven `success` citan el caso medido que separa las dos cosas', () => {
    // `undercarriage_white` responde success=true y deja el LED apagado. Es el
    // ejemplo alcanzable desde esta interfaz: /set_led_rgb con led_id=10.
    expect(textoDeConfirmacion('/set_led_rgb')).toContain('undercarriage_white')
    expect(normalizar(textoDeConfirmacion('/set_led_rgb'))).toContain('no dice que el efecto fisico')
  })
})

describe('LO_QUE_NO_SE_PUEDE_DECIR', () => {
  it('cada hueco viene con su motivo, y ninguno esta vacio', () => {
    expect(LO_QUE_NO_SE_PUEDE_DECIR.length).toBeGreaterThanOrEqual(5)
    for (const h of LO_QUE_NO_SE_PUEDE_DECIR) {
      expect(h.que.length).toBeGreaterThan(0)
      expect(h.porque.length).toBeGreaterThan(20)
    }
  })

  it('están los cinco que el proyecto ha pagado: cancelar_nav2, tiempo de llegada, frenado, LED y avería', () => {
    const todo = normalizar(LO_QUE_NO_SE_PUEDE_DECIR.map((h) => `${h.que} ${h.porque}`).join(' '))
    expect(todo).toContain('cancelar_nav2')
    expect(todo).toContain('no esta medido')
    expect(todo).toContain('collision_monitor_state')
    expect(todo).toContain('led')
    expect(todo).toContain('averia')
  })

  it('🔴🔴 «si la parada está puesta» YA NO es un hueco, y no puede volver a serlo', () => {
    /*
     * Esta prueba pedia `toContain('parada de emergencia')`, o sea que FIJABA
     * como hueco algo que dejo de serlo el 2026-08-04: el driver publica
     * `/estado_robot.parada_emergencia`, `BotonParada` ya la leia, y el flanco se
     * presencio con el robot en marcha desde los dos lados (evidencia 71).
     *
     * O sea que la lista cuyo trabajo es declarar huecos tenia uno FALSO, y la
     * prueba que la protege lo estaba sosteniendo. Es la deriva documental del
     * proyecto con una prueba verde encima — el peor sitio donde puede estar.
     *
     * → Se sustituye por el invariante contrario, que es el que ahora protege:
     *   si alguien vuelve a escribir que no se sabe si la parada esta puesta,
     *   esto falla. Una pantalla que se declara ciega sobre algo que SI ve manda
     *   a mirar el robot sin motivo, y gasta la credibilidad de los avisos que
     *   si importan.
     */
    for (const h of LO_QUE_NO_SE_PUEDE_DECIR) {
      const que = normalizar(h.que)
      expect(
        que.includes('parada') && (que.includes('puesta') || que.includes('activa')),
        `«${h.que}» vuelve a declarar ciega a la interfaz sobre la bandera de parada, y la lee`,
      ).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// La guardia
// ═══════════════════════════════════════════════════════════════════════════
describe('normalizar / esLineaDeComentario / buscarFrasesProhibidas', () => {
  it('normalizar quita acentos y baja a minusculas', () => {
    expect(normalizar('BATERÍA Está ACTIVA')).toBe('bateria esta activa')
  })

  it('reconoce las tres formas de comentario de este repositorio', () => {
    expect(esLineaDeComentario('  // un comentario')).toBe(true)
    expect(esLineaDeComentario('/**')).toBe(true)
    expect(esLineaDeComentario('  * continuacion')).toBe(true)
    expect(esLineaDeComentario('  const x = 1')).toBe(false)
  })

  it('encuentra una frase prohibida en codigo', () => {
    expect(buscarFrasesProhibidas('const t = "LED ENCENDIDO"')).toEqual(['led encendido'])
  })

  it('la encuentra aunque venga acentuada o en otra caja', () => {
    // «está» acentuada y «AVERIADO» en mayusculas: normalizar lo iguala a
    // «robot esta averiado», que es la otra entrada de la lista.
    expect(buscarFrasesProhibidas('const t = "El robot está AVERIADO"')).toContain('robot esta averiado')
    expect(buscarFrasesProhibidas('const t = "un ROBOT AVERIADO"')).toContain('robot averiado')
  })

  it('🔴 pero NO la cuenta dentro de un comentario que explica que esta prohibida', () => {
    // Es el falso positivo exacto que ya hubo que arreglar en el auditor de
    // documentacion de este proyecto: conto como deriva una frase falsa citada
    // precisamente para dejar constancia de que lo era.
    const fuente = [
      '/**',
      ' * 🔴 NUNCA se escribe «parada activa»: el driver no publica su bandera.',
      ' */',
      'export const T = "parada enviada"',
    ].join('\n')
    expect(buscarFrasesProhibidas(fuente)).toEqual([])
  })

  it('un fuente limpio devuelve la lista vacia', () => {
    expect(buscarFrasesProhibidas('export const T = "orden enviada"')).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 EL EFECTO: se recorren los componentes de verdad
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Esta prueba no comprueba una intencion: abre los ficheros de
 * `src/componentes/` y busca dentro. Es la unica forma de que la regla siga
 * valiendo dentro de seis meses, cuando alguien añada una pantalla.
 */
function ficherosDe(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) salida.push(...ficherosDe(ruta))
    else if (/\.tsx?$/.test(entrada.name)) salida.push(ruta)
  }
  return salida
}

const RAIZ = dirname(fileURLToPath(import.meta.url))
/**
 * 🔴 `app/` ENTERO, no dos subdirectorios elegidos a mano.
 *
 * Hasta el 2026-08-04 esta lista era `componentes/` + `app/robot/` +
 * `app/flota/`, y ese recorte dejaba fuera **`app/layout.tsx` y `app/page.tsx`**
 * — o sea la PUERTA DE ENTRADA. Y ahi es donde estaba la mentira:
 *
 *     title: "Atriz Lab - Dashboard"
 *     description: "Laboratorio Remoto de Robotica - Panel de Control"
 *
 * Tres afirmaciones que el proyecto tiene explicitamente decididas al reves:
 * NO es un laboratorio remoto —es un taller PRESENCIAL, decision 17—, no es un
 * panel de control, y no es una consola de administracion. Llevaba ahi desde el
 * primer dia, en la pestaña del navegador, mientras la guardia miraba a otro
 * lado.
 *
 * 📝 La leccion, que es la de siempre en este proyecto: **el punto ciego de una
 * comprobacion tiende a coincidir con donde vive el fallo**, porque los dos
 * salen del mismo descuido. Se vigila el arbol entero y se acabo; `ficherosDe`
 * ya es recursivo, asi que cubre cualquier ruta futura sin tocar nada.
 */
const DIRECTORIOS_VIGILADOS = [
  join(RAIZ, '..', '..', 'componentes'),
  join(RAIZ, '..', '..', 'app'),
]

describe('la guardia sobre los componentes y las rutas de verdad', () => {
  it('hay componentes que vigilar (si esto falla, la prueba no esta mirando nada)', () => {
    // Sin esta comprobacion, un directorio mal escrito daria CERO ficheros y la
    // prueba de abajo pasaria siempre: una comprobacion muerta que cuenta como
    // aprobada, que es un fallo documentado de este proyecto.
    const todos = DIRECTORIOS_VIGILADOS.flatMap(ficherosDe)
    expect(todos.length).toBeGreaterThan(10)
  })

  it('🔴 ninguno enseña una frase que la interfaz no puede decir', () => {
    const culpables: string[] = []
    for (const dir of DIRECTORIOS_VIGILADOS) {
      for (const f of ficherosDe(dir)) {
        const encontradas = buscarFrasesProhibidas(readFileSync(f, 'utf8'))
        if (encontradas.length > 0) culpables.push(`${f}: ${encontradas.join(', ')}`)
      }
    }
    expect(culpables).toEqual([])
  })

  it('la lista de frases prohibidas no se ha vaciado por el camino', () => {
    expect(FRASES_PROHIBIDAS.length).toBeGreaterThanOrEqual(8)
    expect(FRASES_PROHIBIDAS).toContain('led encendido')
    expect(FRASES_PROHIBIDAS).toContain('robot averiado')
    expect(FRASES_PROHIBIDAS).toContain('latencia')
  })

  it('🔴 «parada activa» se quito de la lista, y eso NO es un descuido', () => {
    // Se prohibio cuando el driver no publicaba su bandera de parada. Desde el
    // 2026-08-04 la publica en `/estado_robot.parada_emergencia`, con el flanco
    // false->true presenciado desde los dos lados mientras el robot se movia
    // (evidencia 71). La frase paso de suposicion a dato.
    //
    // Esta prueba existe para que la retirada sea DELIBERADA: si alguien la
    // vuelve a meter sin quitar tambien `PARADA_ACTIVA`, falla y obliga a
    // decidir. Y si el campo desaparece del robot, el camino de vuelta es
    // borrar `PARADA_ACTIVA` y volver a añadirla aqui.
    expect(FRASES_PROHIBIDAS).not.toContain('parada activa')
    expect(PARADA_ACTIVA.toLowerCase()).toContain('parada activa')
  })
})
