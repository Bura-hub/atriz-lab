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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Todas las rutas se resuelven contra la RAIZ DEL PROYECTO, no contra el
// directorio de trabajo: npm ejecuta los guiones desde `frontend/`, asi que
// una ruta relativa al CWD apuntaria al sitio equivocado segun quien lo llame.
const raizProyecto = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/*
 * ⚠️ Se filtran las banderas antes de leer la ruta. Sin esto,
 * `npm run contrato -- --aceptar-campos` tomaria «--aceptar-campos» como el
 * directorio de Atriz_rvr y el guion moriria diciendo que no encuentra el
 * launch — un error que no menciona la bandera y manda a mirar el clon.
 */
const sueltos = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const raizRvr = resolve(raizProyecto, sueltos[0] ?? '../Atriz_rvr')

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
    'NOMBRE = [...] que extraer con este mismo patron. El ✅ de arriba es de TRES globs ' +
    '(LEER/ESCRIBIR/SERVICIOS), no cuatro.\n' +
    '   🔴 Y DESDE EL 2026-08-06 ESTO SI IMPORTA: la web ya manda objetivos de accion ' +
    '(Transporte.enviarObjetivo), asi que una divergencia entre esta lista y la del robot dejaria ' +
    'de ser teorica. El sintoma seria SILENCIO —medido: rosbridge deniega sin mandar un solo ' +
    'op=status—, o sea «la navegacion no responde» buscandose en el sitio equivocado.'
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

// ═══════════════════════════════════════════════════════════════════════
// QUINTA COMPROBACION: los CAMPOS de cada .msg, contra una instantanea
// ═══════════════════════════════════════════════════════════════════════
// 🔴🔴 EL PUNTO CIEGO QUE CASI CUESTA DOS CAMPOS EN PANTALLA.
//
// La comprobacion de arriba mira que el .msg EXISTA. Nunca lee lo que hay
// dentro. El 2026-08-08 el robot anadio `mapa_nombre` y `mapa_edad_s` a
// EstadoNavegacion y escribio: «le toca al PC anadirlos a contrato.ts;
// comprobar_contrato.mjs estara en rojo hasta entonces, que es lo correcto».
// **No lo estuvo:** ejecutado antes de tocar nada, dio todo verde.
//
// 🔴 Y la direccion del fallo es la mala. Si alguien se hubiera fiado de ese
//    rojo que nunca llego, los dos campos NO habrian llegado nunca a la
//    pantalla, con el comprobador en verde — y esos dos campos existen para
//    avisar del fallo de los 41,3 cm, en el que Nav2 declara exito estando a
//    medio metro y no hay ningun otro sintoma.
//
// → Lo que la cierra, y lo propuso el robot: guardar los campos en un fichero
//   VERSIONADO y comparar. Cualquier cambio se pone en rojo hasta que alguien
//   actualice la instantanea, que es exactamente el gesto de «me he enterado».
//   No decide si la pantalla necesita el campo — eso es de una persona—; solo
//   impide que el cambio pase inadvertido.
//
// ⚠️ Lo que esto NO hace, y conviene decirlo para que nadie lea de mas:
//    · No comprueba que la interfaz de TypeScript tenga esos campos. Un campo
//      nuevo aceptado en la instantanea y no usado sigue sin llegar a pantalla.
//    · Solo mira los tipos de `atriz_rvr_msgs` que estan en TIPOS.
const RUTA_CAMPOS = join(raizProyecto, 'herramientas/campos_msg.json')
const aceptar = process.argv.includes('--aceptar-campos')

/**
 * Los campos de un .msg, en orden. Descarta comentarios y CONSTANTES.
 *
 * 📌 Las constantes (`uint8 APAGADO=0`) se descartan a proposito: no viajan en
 *    el mensaje, asi que no son parte de lo que la pantalla puede leer. Un
 *    estado nuevo en el enum SI merece verse — pero eso lo caza el campo
 *    `slam`/`nav` que lo transporta, y meterlas aqui haria saltar la
 *    instantanea por cambios que no afectan al contrato de datos.
 */
function camposDeMsg(texto) {
  const campos = []
  for (const bruta of texto.split('\n')) {
    const linea = bruta.split('#')[0].trim()
    if (!linea) continue
    // `tipo nombre` · `tipo nombre valorPorDefecto` · `tipo NOMBRE=valor`
    const m = /^(\S+)\s+([A-Za-z_]\w*)\s*(=)?/.exec(linea)
    if (!m || m[3]) continue          // sin nombre, o con `=`: es una constante
    campos.push(`${m[1]} ${m[2]}`)
  }
  return campos
}

const instantaneaViva = {}
for (const [, tipo] of propios) {
  const nombreMsg = tipo.split('/').pop()
  const rutaMsg = join(raizRvr, 'atriz_rvr_msgs/msg', `${nombreMsg}.msg`)
  if (!existsSync(rutaMsg)) continue          // ya lo grito la comprobacion 4
  instantaneaViva[nombreMsg] = camposDeMsg(readFileSync(rutaMsg, 'utf8'))
}

if (aceptar) {
  writeFileSync(RUTA_CAMPOS, `${JSON.stringify(instantaneaViva, null, 2)}\n`)
  console.log(`📸 instantanea de campos actualizada: ${RUTA_CAMPOS}`)
  console.log('   🔴 Actualizarla NO anade los campos a la pantalla. Mira si alguno')
  console.log('      hace falta en contrato.ts, useTopic.ts y en algun componente.')
} else if (!existsSync(RUTA_CAMPOS)) {
  fallos++
  console.error(`🔴 CAMPOS: no existe la instantanea ${RUTA_CAMPOS}`)
  console.error('   creala con: npm run contrato -- --aceptar-campos')
} else {
  const guardada = JSON.parse(readFileSync(RUTA_CAMPOS, 'utf8'))
  const cambios = []
  for (const msgNombre of new Set([...Object.keys(guardada), ...Object.keys(instantaneaViva)])) {
    const antes = guardada[msgNombre] ?? null
    const ahora = instantaneaViva[msgNombre] ?? null
    if (antes === null) { cambios.push(`   ${msgNombre}: es NUEVO en el contrato`); continue }
    if (ahora === null) { cambios.push(`   ${msgNombre}: ya no esta en TIPOS`); continue }
    for (const c of ahora) if (!antes.includes(c)) cambios.push(`   ${msgNombre}: 🆕 '${c}'`)
    for (const c of antes) if (!ahora.includes(c)) cambios.push(`   ${msgNombre}: ❌ se fue '${c}'`)
  }
  if (cambios.length) {
    fallos++
    console.error('🔴 CAMPOS: el robot ha cambiado el contenido de un .msg')
    for (const c of cambios) console.error(c)
    console.error('   👉 mira si la pantalla los necesita. Si ya lo has hecho (o no hacen falta):')
    console.error('      npm run contrato -- --aceptar-campos')
  } else {
    const n = Object.values(instantaneaViva).reduce((s, c) => s + c.length, 0)
    console.log(
      `✅ CAMPOS: ${n} campos en ${Object.keys(instantaneaViva).length} .msg, ` +
      'iguales a la instantanea (constantes excluidas: no viajan en el mensaje)'
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 6 · EL TALLER — el contrato con el AGENTE DE SESION
// ═══════════════════════════════════════════════════════════════════════
/*
 * 🔴 NACE DE UNA AUDITORIA, Y DE LA MISMA FAMILIA QUE YA MORDIO UNA VEZ.
 *
 * El robot lo dijo con estas palabras (evidencia 117 §6): «comprobar_contrato
 * NO cubre el taller — 0 menciones de taller/testigo/9443/agente: la misma
 * familia que la ceguera de campos de .msg que ya mordio una vez».
 *
 * Tenia razon. Este guion vigilaba la lista blanca de rosbridge y los campos de
 * los `.msg`, y el taller abrio un contrato NUEVO —otro puerto, otro protocolo,
 * otro lenguaje al otro lado— que no vigilaba nadie. Y ese contrato ya se ha
 * movido una vez sin que la web se enterara: el agente gano el rechazo
 * `AGENTE_PARANDO` en la auditoria y `protocolo.ts` no lo conocia.
 *
 * ⚠️ Lo que esto NO puede hacer: comprobar el COMPORTAMIENTO. Solo mira que los
 *    nombres y las constantes que los dos lados escriben por separado sigan
 *    diciendo lo mismo. Es exactamente el alcance del control de campos, y con
 *    la misma limitacion.
 */
const rutaNucleo = join(raizRvr, 'scripts/agente/agente_nucleo.py')
// 🔴 `enlace_agente.ts`, NO `testigo_robot.ts`. Las dos constantes se mudaron
//    ahi el 2026-08-15 porque `testigo_robot.ts` importa `node:crypto` y no
//    puede llegar al navegador. La comprobacion de abajo AVISA si no las
//    encuentra: sin eso, mover el fichero habria dejado este control mudo y en
//    verde, que es como se pierden los controles sin que nadie se entere.
const rutaTestigoTs = join(raizProyecto, 'frontend/src/lib/sesion/enlace_agente.ts')
const rutaProtocoloTs = join(raizProyecto, 'frontend/src/lib/taller/protocolo.ts')

if (!existsSync(rutaNucleo)) {
  console.log(
    '⚠️  TALLER: no encuentro `scripts/agente/agente_nucleo.py` en el robot, asi que ' +
    'este control NO se ha hecho. No es un ✅: es que falta con que comparar.'
  )
} else {
  const nucleo = readFileSync(rutaNucleo, 'utf8')
  const protocoloTs = readFileSync(rutaProtocoloTs, 'utf8')
  const testigoTs = readFileSync(rutaTestigoTs, 'utf8')
  const problemas = []

  // 6a · Las señales. Son el instrumento de la practica 99: si el agente
  //      recorta la lista y la web sigue ofreciendo el boton, el alumno pulsa
  //      algo que se rechaza en silencio.
  const senalesPy = [...(nucleo.match(/^SENALES\s*=\s*\(([^)]*)\)/m)?.[1] ?? '')
    .matchAll(/'([A-Z]+)'/g)].map((m) => m[1]).sort()
  const senalesTs = [...(protocoloTs.match(/export const SENALES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '')
    .matchAll(/'([A-Z]+)'/g)].map((m) => m[1]).sort()
  if (senalesPy.join() !== senalesTs.join()) {
    problemas.push(`señales: el agente dice [${senalesPy}] y la web [${senalesTs}]`)
  }

  /*
   * 6b · Los codigos de rechazo, y SOLO EN UNA DIRECCION.
   *
   * 🔴 LA PRIMERA VERSION DE ESTE CONTROL ERA UN FALSO POSITIVO, y se corrigio
   *    antes de subirlo. Marcaba en rojo los diez codigos del agente que la web
   *    «no menciona» — pero la web NO NECESITA mencionarlos: pinta el `motivo`
   *    que manda el agente, tal cual, para cualquier rechazo que no trate
   *    aparte. Un codigo nuevo del agente **ya se ve** sin tocar nada.
   *
   *    Y un comprobador que grita por algo que funciona se acaba ignorando, que
   *    es exactamente lo que este repositorio persigue en su propio verificador
   *    —once falsos positivos documentados—.
   *
   * → Lo que SI es un fallo es la direccion contraria: un codigo sobre el que la
   *   web RAMIFICA y que el agente ya no emite. Eso es una rama muerta que
   *   nadie ejecuta, y la pantalla se comporta distinto de como se lee.
   */
  const rechazosPy = new Set([
    ...[...nucleo.matchAll(/_rechazo\(\s*[a-z]+\s*,\s*'([A-Z_]+)'/g)].map((m) => m[1]),
    ...[...readFileSync(join(raizRvr, 'scripts/agente/agente_sesion.py'), 'utf8')
      .matchAll(/'codigo':\s*'([A-Z_]+)'/g)].map((m) => m[1]),
  ])
  //: Los que la web trata APARTE, no los que enseña. Se buscan como literal.
  const ramificaWeb = [...new Set([
    ...[...protocoloTs.matchAll(/codigo === '([A-Z_]+)'/g)].map((m) => m[1]),
    ...[...readFileSync(join(raizProyecto, 'frontend/src/componentes/robot/PanelTerminal.tsx'), 'utf8')
      .matchAll(/codigo !== '([A-Z_]+)'|codigo === '([A-Z_]+)'/g)].map((m) => m[1] ?? m[2]),
    ...[...readFileSync(join(raizProyecto, 'frontend/src/lib/taller/sesion_taller.ts'), 'utf8')
      .matchAll(/codigo === '([A-Z_]+)'/g)].map((m) => m[1]),
  ])]
  const ramasMuertas = ramificaWeb.filter((c) => !rechazosPy.has(c))
  if (ramasMuertas.length) {
    problemas.push(
      `la web ramifica sobre codigos que el agente YA NO manda: ${ramasMuertas.join(', ')} ` +
      '(rama muerta: la pantalla se comporta distinto de como se lee)'
    )
  }

  // 6c · El tope de codigo. Si divergen, el alumno manda 64 KiB que el agente
  //      rechaza, o la web corta antes de tiempo.
  const topePy = Number(nucleo.match(/TOPE_CODIGO_BYTES\s*=\s*(\d+)\s*\*\s*1024/)?.[1] ?? 0) * 1024
  const topeTs = Number(protocoloTs.match(/TOPE_CODIGO_BYTES\s*=\s*(\d+)\s*\*\s*1024/)?.[1] ?? 0) * 1024
  if (topePy !== topeTs) {
    problemas.push(`tope de codigo: el agente ${topePy} B y la web ${topeTs} B`)
  }

  // 6d · El subprotocolo y el prefijo del testigo. Estan en el verificador de
  //      Python (`atriz_testigo.py`) y en la web; si divergen, el navegador no
  //      abre y el motivo no aparece por ninguna parte.
  const rutaTestigoPy = join(raizRvr, '../atriz_migracion/scripts/atriz_testigo.py')
  if (existsSync(rutaTestigoPy)) {
    const testigoPy = readFileSync(rutaTestigoPy, 'utf8')
    for (const [nombre, re] of [
      ['PREFIJO_TESTIGO', /PREFIJO_TESTIGO\s*=\s*'([^']+)'/],
      ['SUBPROTOCOLO', /SUBPROTOCOLO\s*=\s*'([^']+)'/],
    ]) {
      const py = testigoPy.match(re)?.[1]
      const enTs = nombre === 'SUBPROTOCOLO' ? 'SUBPROTOCOLO_AGENTE' : nombre
      const ts = testigoTs.match(new RegExp(`${enTs}\\s*=\\s*'([^']+)'`))?.[1]
      /*
       * 🔴 NO ENCONTRARLA ES UN PROBLEMA, NO UN MOTIVO PARA CALLAR.
       *
       * Antes esto era `if (py !== undefined && ts !== undefined && py !== ts)`,
       * o sea que renombrar la constante —o moverla de fichero, que es justo lo
       * que paso el 2026-08-15— dejaba este control **mudo y en verde**. Es la
       * familia que este proyecto persigue: una comprobacion que se cree que
       * cubre algo y no lo cubre.
       */
      if (py === undefined) problemas.push(`${nombre}: no la encuentro en atriz_testigo.py`)
      else if (ts === undefined) problemas.push(`${enTs}: no la encuentro en enlace_agente.ts`)
      else if (py !== ts) problemas.push(`${nombre}: el robot '${py}' y la web '${ts}'`)
    }
  }

  if (problemas.length) {
    fallos++
    console.error('🔴 TALLER: el contrato con el agente de sesion ha divergido')
    for (const p of problemas) console.error(`   ${p}`)
    console.error('   👉 gana el ROBOT: es quien ejecuta. Alinea la web.')
  } else {
    console.log(
      `✅ TALLER: señales (${senalesTs.length}), rechazos, tope de codigo y subprotocolo ` +
      'coinciden con el agente. ⚠️ Nombres y constantes, NO comportamiento'
    )
  }
}

process.exit(fallos ? 1 : 0)
