#!/usr/bin/env node
/**
 * Compara la lista blanca de `contrato.ts` con la de `robot.launch.py`.
 * Si divergen, GANA EL ROBOT: la web no puede ampliar su propia autorizacion.
 *
 *   node herramientas/comprobar_contrato.mjs ../Atriz_rvr
 *
 * Codigo de salida: 0 = coinciden · 1 = divergen · 2 = no se pudo comparar
 * (falta `robot.launch.py`; NO es un aprobado, sigue la convencion del
 * proyecto: probar_lista_blanca.py, verificar_robot.sh, compilar.sh, etc.)
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
  // 🔴 CODIGO 2, no 0. En este proyecto el 2 significa «no concluye», y esto es
  // exactamente eso: no se comparo nada. Salir con 0 seria una comprobacion
  // muerta que cuenta como aprobada — el patron que ya costo caro aqui.
  // Convencion: probar_lista_blanca.py:169 (return 2 cuando el control no
  // responde), verificar_robot.sh:1423, atriz-escaneo.sh:135, compilar.sh:44.
  // Un CI bloquea con != 0 por defecto, asi que no hace falta ninguna bandera.
  console.error(`🔴 NO SE COMPARÓ NADA: no encuentro ${rutaLaunch}. Esto no es un aprobado.`)
  console.error('   Uso: node herramientas/comprobar_contrato.mjs ../Atriz_rvr')
  process.exit(2)
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

/** Saca el contenido del objeto `export const TIPOS: ... = { ... }` de contrato.ts. */
function bloqueTipos(fuente) {
  const m = fuente.match(/export const TIPOS[^=]*=\s*\{([\s\S]*?)\}/m)
  if (!m) throw new Error('no encuentro TIPOS en contrato.ts')
  return m[1]
}

/**
 * Saca pares [topic, tipo] de '/topic': 'paquete/msg/Tipo' dentro del bloque
 * de TIPOS. Misma guarda que `extraerItems`: contrato.ts declara quince
 * tipos, asi que 0 pares es un fallo de parseo (p.ej. un '}' prematuro
 * dentro de un comentario), no una tabla vacia legitima.
 */
function extraerParesTipo(contenidoBloque) {
  const pares = [...contenidoBloque.matchAll(/'(\/[^']+)':\s*'([^']+)'/g)].map((x) => [x[1], x[2]])
  if (pares.length === 0) {
    throw new Error(
      `TIPOS en contrato.ts parseo a 0 pares: sospecha de un '}' prematuro ` +
      `(p.ej. dentro de un comentario) cortando el bloque antes de tiempo`
    )
  }
  return pares
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

// ═══════════════════════════════════════════════════════════════════════
// CUARTA COMPROBACION: los TIPOS propios (atriz_rvr_msgs) existen de verdad
// ═══════════════════════════════════════════════════════════════════════
// Las tres comprobaciones de arriba comparan NOMBRES de topics/servicios
// contra robot.launch.py, pero los TIPOS de contrato.ts no estan en ese
// fichero: viven en los .msg del paquete atriz_rvr_msgs. Un tipo mal escrito
// (p.ej. 'Encoders' en vez de 'Encoder', el fallo real que motivo esta
// comprobacion) NO lo detectaba nada de lo anterior, ni las pruebas de
// vitest si no apuntaban justo a ese topic: rosbridge falla con
// `InvalidClassException: Unable to import msg class ...` y el sintoma se
// confunde con «ese topic no llega», que se busca en el sitio equivocado.
// Solo se verifican los tipos del paquete PROPIO del proyecto (atriz_rvr_msgs)
// -son los unicos que pueden derivar, porque son los unicos que viven en este
// repositorio-: los estandar (nav_msgs, sensor_msgs, geometry_msgs, std_msgs,
// tf2_msgs, nav2_msgs) no estan clonados en ningun sitio y quedan FUERA de
// esta comprobacion. Se dice explicitamente en el mensaje de salida para que
// nadie lea el ✅ como «los quince tipos verificados».
const paresTipo = extraerParesTipo(bloqueTipos(contrato))
const propios = paresTipo.filter(([, tipo]) => tipo.startsWith('atriz_rvr_msgs/'))
const faltantes = []
for (const [topic, tipo] of propios) {
  const nombreMsg = tipo.split('/').pop()   // 'atriz_rvr_msgs/msg/Encoder' -> 'Encoder'
  const rutaMsg = join(raizRvr, 'atriz_rvr_msgs/msg', `${nombreMsg}.msg`)
  if (!existsSync(rutaMsg)) faltantes.push({ topic, tipo, rutaMsg })
}
if (faltantes.length) {
  fallos++
  console.error(`🔴 TIPOS (atriz_rvr_msgs) diverge: hay tipos que no existen como .msg real`)
  for (const { topic, tipo, rutaMsg } of faltantes) {
    console.error(`   ${topic} -> '${tipo}': no existe ${rutaMsg}`)
  }
} else {
  console.log(
    `✅ TIPOS (atriz_rvr_msgs): ${propios.length} de ${propios.length} existen como .msg real ` +
    '(paquetes estandar -nav_msgs/sensor_msgs/geometry_msgs/std_msgs/tf2_msgs/nav2_msgs- ' +
    'no viven en este repositorio y quedan FUERA de esta comprobacion)'
  )
}

process.exit(fallos ? 1 : 0)
