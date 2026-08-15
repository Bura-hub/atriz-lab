/**
 * NINGUN MODULO DE CLIENTE PUEDE LLEGAR A UN `node:*`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTA PRUEBA EXISTE PORQUE EL 2026-08-15 SE TUMBO LA APLICACION ENTERA
 * ═══════════════════════════════════════════════════════════════════════════
 * `useAgente.ts` (`'use client'`) importo dos constantes de `testigo_robot.ts`,
 * que hace `import { sign } from 'node:crypto'` y calcula su cabecera JWT **al
 * evaluarse el modulo**. El modulo entero viajo al navegador y:
 *
 *     TypeError: Unknown encoding: base64url
 *         at b64u (...)
 *         at __TURBOPACK__module__evaluation__
 *
 * Como revienta al EVALUAR, no se cae el terminal: se cae la **pagina completa**
 * — «Application error: a client-side exception has occurred» — y el mensaje no
 * nombra ningun fichero nuestro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE NO LO VIO, Y ES LA RAZON DE QUE ESTA PRUEBA NO SE SALTE NUNCA
 * ═══════════════════════════════════════════════════════════════════════════
 * `tsc` limpio · `eslint` limpio · **740 pruebas en verde** · 6 controles de
 * contrato ✅. Ninguno carga una pagina.
 *
 * La guarda que si lo habria cazado —`pantallas_reales.test.ts`— estaba entre
 * las **54 saltadas**, porque pide `ATRIZ_VIVAS=1` y un navegador. Y «saltada no
 * es pasada» estaba escrito ese mismo dia, en el CHANGELOG de ese mismo commit.
 *
 * → Por eso esta prueba **no depende de nada**: ni navegador, ni servidor, ni
 *   robot. Lee ficheros y sigue imports. Corre siempre.
 *
 * ⚠️ Lo que NO cubre: un import dinamico (`await import('node:fs')`) dentro de
 *    una funcion, y los paquetes de `node_modules` que a su vez toquen `node:*`.
 *    Se dice en vez de callarlo — una comprobacion de la que se cree que cubre
 *    mas de lo que cubre es peor que no tenerla.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function todosLosFicheros(dir: string): string[] {
  const salida: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) salida.push(...todosLosFicheros(p))
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) salida.push(p)
  }
  return salida
}

/** Resuelve un `@/loquesea` a un fichero real, probando las extensiones. */
function resolverAlias(especificador: string, desde: string): string | null {
  let base: string
  if (especificador.startsWith('@/')) base = join(SRC, especificador.slice(2))
  else if (especificador.startsWith('.')) base = resolve(dirname(desde), especificador)
  else return null                        // paquete de node_modules: fuera de alcance
  for (const suf of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    try {
      const p = base + suf
      if (statSync(p).isFile()) return p
    } catch { /* siguiente */ }
  }
  return null
}

const IMPORTS = /(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g

function importaDe(fichero: string): { esCliente: boolean; nodes: string[]; hijos: string[] } {
  const texto = readFileSync(fichero, 'utf8')
  const nodes: string[] = []
  const hijos: string[] = []
  for (const m of texto.matchAll(IMPORTS)) {
    const esp = m[1]!
    if (esp.startsWith('node:')) nodes.push(esp)
    else {
      const r = resolverAlias(esp, fichero)
      if (r !== null) hijos.push(r)
    }
  }
  return {
    // La directiva tiene que ser lo PRIMERO del fichero (tras comentarios).
    esCliente: /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(texto),
    nodes,
    hijos,
  }
}

/** Devuelve el camino `a -> b -> c` hasta el primer `node:*`, o null. */
function caminoHastaNode(raiz: string): string[] | null {
  const vistos = new Set<string>()
  const cola: { f: string; camino: string[] }[] = [{ f: raiz, camino: [raiz] }]
  while (cola.length > 0) {
    const { f, camino } = cola.shift()!
    if (vistos.has(f)) continue
    vistos.add(f)
    const info = importaDe(f)
    if (info.nodes.length > 0) return [...camino, info.nodes[0]!]
    for (const h of info.hijos) cola.push({ f: h, camino: [...camino, h] })
  }
  return null
}

const corto = (p: string) => p.replace(SRC, 'src').replace(/\\/g, '/')

describe('🔴 lo que es de cliente no puede arrastrar node:*', () => {
  const ficheros = todosLosFicheros(SRC)
  const clientes = ficheros.filter((f) => importaDe(f).esCliente)

  it('hay modulos de cliente que mirar (si no, esta prueba no probaria nada)', () => {
    // El control de la propia prueba: si un cambio en la deteccion de
    // «'use client'» dejara la lista vacia, todo pasaria sin comprobar nada.
    expect(clientes.length).toBeGreaterThan(5)
  })

  it('ninguno llega a un `node:*`, ni por el camino largo', () => {
    const culpables = clientes
      .map((f) => ({ f, camino: caminoHastaNode(f) }))
      .filter((x) => x.camino !== null)
      .map((x) => x.camino!.map(corto).join('\n     -> '))

    expect(culpables, culpables.length === 0 ? '' :
      'Un modulo de cliente alcanza `node:*`. En el navegador eso revienta al '
      + 'EVALUAR el modulo y tumba la pagina entera:\n\n  ' + culpables.join('\n\n  '))
      .toEqual([])
  })
})
