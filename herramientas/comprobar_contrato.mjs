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
import { execFileSync } from 'node:child_process'
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

/**
 * 🔴 QUE RAMA DE `Atriz_rvr` SE ESTA COMPARANDO. No es decoracion.
 *
 * Este comprobador lee el ARBOL DE TRABAJO del repositorio hermano, asi que su
 * veredicto depende de en que rama esta ESE repositorio — y eso no aparecia por
 * ningun lado. El 2026-08-04 alguien dejo `Atriz_rvr` en `feat/estado-robot`
 * (una rama sin fusionar, con un topic de mas) y el comprobador dio ROJO
 * diciendo «solo en el ROBOT: /estado_robot», sin mencionar la rama. Costo una
 * investigacion entera, y la salida natural —añadir el topic a `contrato.ts`—
 * habria sido el arreglo EQUIVOCADO: la web habria prometido un topic que `ros2`
 * no publica.
 *
 * → Un comprobador que da un veredicto correcto sobre un arbol equivocado es
 *   peor que uno que falla: parece que sabe lo que compara. Ahora lo dice.
 *
 * `git` puede no estar (un tarball, un CI sin `.git`): eso no es motivo para
 * abortar, se dice «desconocida» y se sigue.
 */
const RAMA_ESPERADA = 'ros2'
let rama = null
try {
  rama = execFileSync('git', ['-C', raizRvr, 'rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
} catch {
  rama = null
}
if (rama === null) {
  console.log('📌 comparando contra Atriz_rvr, rama DESCONOCIDA (no hay git aquí)')
} else if (rama === RAMA_ESPERADA) {
  console.log(`📌 comparando contra Atriz_rvr, rama ${rama}`)
} else {
  console.log(
    `⚠️  comparando contra Atriz_rvr en la rama «${rama}», NO «${RAMA_ESPERADA}» — que es la que\n` +
    '   corre el robot. Si algo sale divergente, MIRA ESTO ANTES de tocar contrato.ts: la web no\n' +
    `   puede prometer lo que ${RAMA_ESPERADA} no publica. Volver con:  git -C ${process.argv[2] ?? '../Atriz_rvr'} checkout ${RAMA_ESPERADA}`,
  )
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
// ACCIONES: FUERA de esta comparacion, y se dice explicitamente por que
// ═══════════════════════════════════════════════════════════════════════
// Punto 4 del encargo. En robot.launch.py el glob de acciones va INLINE
// dentro de la funcion del launch (`_glob(['/navigate_to_pose'])`), no como
// una constante nombrada `NOMBRE = [...]` en columna propia -al contrario que
// LEER/ESCRIBIR/SERVICIOS-, asi que `bloquePython()` no tiene un bloque que
// extraer de ese lado. Comparar aqui daria un falso "coincide" (contra una
// lista vacia) o un error de parseo que no es el problema real -la misma
// clase de fallo silencioso que la guarda de `extraerItems()` ya evita para
// las otras tres listas.
// Es la misma forma que el `opUnsubscribe` que ya se caso en la revision de
// codigo: no rompe nada porque la web todavia no tiene soporte de acciones,
// pero un ✅ que no diga esto se leeria como "los CUATRO globs verificados"
// cuando solo se comparan TRES.
try {
  const accionesWeb = bloqueTs(contrato, 'ACCIONES')
  console.log(
    `⚠️  ACCIONES (${accionesWeb.length} en contrato.ts: ${accionesWeb.join(', ')}) NO se compara ` +
    'contra robot.launch.py: alli el glob de acciones va inline en el launch, sin una constante ' +
    'NOMBRE = [...] que extraer con este mismo patron. Sin soporte de acciones en la web hoy, esto ' +
    'no bloquea nada -pero el ✅ de arriba es de TRES globs (LEER/ESCRIBIR/SERVICIOS), no cuatro.'
  )
} catch (e) {
  fallos++
  console.error(`🔴 no se pudo ni siquiera leer ACCIONES de contrato.ts: ${e.message}`)
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
