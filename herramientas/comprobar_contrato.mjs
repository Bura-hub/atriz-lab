#!/usr/bin/env node
/**
 * Compara la lista blanca de `contrato.ts` con la de `robot.launch.py`.
 * Si divergen, GANA EL ROBOT: la web no puede ampliar su propia autorizacion.
 *
 *   node herramientas/comprobar_contrato.mjs ../Atriz_rvr
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Todas las rutas se resuelven contra la RAIZ DEL PROYECTO, no contra el
// directorio de trabajo: npm ejecuta los guiones desde `frontend/`, asi que
// una ruta relativa al CWD apuntaria al sitio equivocado segun quien lo llame.
const raizProyecto = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const raizRvr = resolve(raizProyecto, process.argv[2] ?? '../Atriz_rvr')

const rutaLaunch = join(raizRvr, 'atriz_rvr_bringup/launch/robot.launch.py')
if (!existsSync(rutaLaunch)) {
  console.log(`AVISO: no encuentro ${rutaLaunch}, no se puede comparar. Uso:`)
  console.log('  node herramientas/comprobar_contrato.mjs ../Atriz_rvr')
  process.exit(0)   // aviso, no fallo: en un clon suelto puede no estar
}

const launch = readFileSync(rutaLaunch, 'utf8')
const contrato = readFileSync(join(raizProyecto, 'frontend/src/lib/rosbridge/contrato.ts'), 'utf8')

/**
 * Extrae las cadenas '/loquesea' del CONTENIDO ya capturado de un bloque
 * `NOMBRE = [ ... ]` y aplica la guarda de lista vacia.
 *
 * 🔴 Guarda obligatoria: ninguna de las tres listas (LEER/ESCRIBIR/SERVICIOS,
 * 12/3/8 entradas respectivamente) puede estar legitimamente vacia — es el
 * minimo estructural del sistema. El regex de `bloquePython`/`bloqueTs` NO es
 * voraz (`[\s\S]*?`) y se detiene en el PRIMER `]` que encuentra, sea el
 * cierre real de la lista o uno prematuro escondido en un comentario — p.ej.
 * `# ver tabla[0]`, y el propio `robot.launch.py` ya usa `[0,0,0]` en un
 * comentario unas lineas mas abajo, asi que no es un estilo ajeno al fichero.
 * Sin esta guarda, ese corte da `[]` SIN lanzar excepcion: dos listas vacias
 * se comparan y "coinciden", o si solo se trunca un lado, el OTRO lado queda
 * acusado de "divergir" cuando el fallo real esta en el PARSEO, no en el
 * contenido. Con la politica "gana el robot" eso puede llevar a borrar de la
 * web una entrada legitima. Mejor morir aqui, ruidosamente, diciendo que
 * bloque y de que lado.
 */
function extraerItems(contenidoBloque, origen, nombre) {
  const items = [...contenidoBloque.matchAll(/'(\/[^']+)'/g)].map((x) => x[1]).sort()
  if (items.length === 0) {
    throw new Error(
      `${nombre} en ${origen} parseo a 0 entradas: sospecha de un ']' prematuro ` +
      `(p.ej. dentro de un comentario) cortando el bloque antes de tiempo — no es una lista vacia legitima`
    )
  }
  return items
}

/**
 * Saca el bloque `NOMBRE = [ ... ]` de robot.launch.py.
 *
 * ⚠️ El anclaje lleva `\s*` antes del nombre: en `robot.launch.py` las tres
 * constantes (LEER, ESCRIBIR, SERVICIOS) estan dentro de la funcion del
 * launch, indentadas 4 espacios, no en la columna 0. Un `^NOMBRE` sin eso
 * no encuentra nada — comprobado contra el fichero real, no supuesto.
 */
function bloquePython(fuente, nombre) {
  const m = fuente.match(new RegExp(`^[ \\t]*${nombre}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'))
  if (!m) throw new Error(`no encuentro el bloque ${nombre} en robot.launch.py`)
  return extraerItems(m[1], 'robot.launch.py', nombre)
}

function bloqueTs(fuente, nombre) {
  const m = fuente.match(new RegExp(`export const ${nombre}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'))
  if (!m) throw new Error(`no encuentro ${nombre} en contrato.ts`)
  return extraerItems(m[1], 'contrato.ts', nombre)
}

const pares = [
  ['LEER', 'TOPICS_LECTURA'],
  ['ESCRIBIR', 'TOPICS_ESCRITURA'],
  ['SERVICIOS', 'SERVICIOS'],
]

let fallos = 0
for (const [enPython, enTs] of pares) {
  const a = bloquePython(launch, enPython)
  const b = bloqueTs(contrato, enTs)
  const soloRobot = a.filter((x) => !b.includes(x))
  const soloWeb = b.filter((x) => !a.includes(x))
  if (soloRobot.length || soloWeb.length) {
    fallos++
    console.error(`🔴 ${enPython} / ${enTs} divergen`)
    if (soloRobot.length) console.error(`   solo en el ROBOT: ${soloRobot.join(' ')}`)
    if (soloWeb.length) console.error(`   solo en la WEB:   ${soloWeb.join(' ')}  <-- la web NO puede ampliarse sola`)
  } else {
    console.log(`✅ ${enPython}: ${a.length} entradas, coinciden`)
  }
}
process.exit(fallos ? 1 : 0)
