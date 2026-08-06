#!/usr/bin/env node
/**
 * CREA LA PRIMERA CUENTA, desde la máquina donde corre el servidor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUÉ ESTO ES UN GUION Y NO UN «CREA TU CUENTA» EN LA PANTALLA
 * ═══════════════════════════════════════════════════════════════════════════
 * Con cero cuentas nadie puede entrar, y crear una exige sesión: hay que romper
 * el círculo por algún sitio. La salida habitual —permitir crear la PRIMERA sin
 * sesión— abre una ventana en la que **quien llegue primero se queda la
 * aplicación**, y esto vive en la red de un aula con dieciséis personas y sus
 * portátiles. Bastaría con que el servidor arrancara antes de que el administrador
 * abriera el navegador.
 *
 * Un guion que se ejecuta en la propia máquina no tiene esa ventana: para
 * usarlo hay que estar delante del teclado que sirve la aplicación.
 *
 * Uso:
 *     node herramientas/crear-cuenta.mjs <usuario> <contraseña>
 *
 * ⚠️ La contraseña queda en el historial del intérprete de órdenes. Es el precio
 *    de que sea una sola línea; para las siguientes cuentas está la pantalla de
 *    `/usuarios`, que no lo hace. Si te importa, borra esa línea del historial.
 */

import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scrypt = promisify(scryptCb)

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend')
const RUTA = join(RAIZ, 'usuarios.json')

/*
 * 🔴 ESTAS REGLAS SON UNA COPIA, Y ESO ES UNA DEUDA QUE SE ESCRIBE.
 *
 * `src/lib/sesion/credenciales.ts` tiene las mismas, y son la fuente. Aquí no se
 * pueden importar sin arrastrar el transformador de TypeScript a un guion que
 * existe para ser una sola orden. Si cambian allí, hay que cambiarlas aquí.
 *
 * Lo que NO se duplica es lo que importa: el formato de `clave` —`sal:hash` con
 * `scrypt`, 16 bytes de sal y 64 de hash— tiene que coincidir exactamente, y si
 * no coincidiera el fallo sería visible al primer intento de entrar.
 */
const NOMBRE_VALIDO = /^[a-z0-9][a-z0-9._-]{2,31}$/
const MINIMO_CONTRASENA = 10

const [, , usuarioCrudo, contrasena] = process.argv

if (usuarioCrudo === undefined || contrasena === undefined) {
  console.error('Uso: node herramientas/crear-cuenta.mjs <usuario> <contraseña>')
  process.exit(2)
}

const usuario = usuarioCrudo.trim().toLowerCase()

if (!NOMBRE_VALIDO.test(usuario)) {
  console.error('🔴 El nombre va en minúsculas, de 3 a 32 caracteres, y solo admite')
  console.error('   letras, dígitos, punto, guion y guion bajo.')
  process.exit(1)
}
if (contrasena.length < MINIMO_CONTRASENA) {
  console.error(`🔴 La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`)
  process.exit(1)
}
if (contrasena.toLowerCase().includes(usuario)) {
  console.error('🔴 La contraseña no puede contener el nombre de usuario.')
  process.exit(1)
}

let cuentas = []
try {
  const f = JSON.parse(await readFile(RUTA, 'utf8'))
  cuentas = Array.isArray(f.cuentas) ? f.cuentas : []
} catch {
  // No existe todavía: es el caso normal la primera vez.
}

if (cuentas.some((c) => c.usuario === usuario)) {
  console.error(`🔴 Ya existe una cuenta «${usuario}». Este guion no la sobrescribe.`)
  process.exit(1)
}

const sal = randomBytes(16)
const hash = await scrypt(contrasena, sal, 64)
cuentas.push({
  usuario,
  clave: `${sal.toString('hex')}:${hash.toString('hex')}`,
  creada: Date.now(),
})

await writeFile(RUTA, `${JSON.stringify({ cuentas }, null, 2)}\n`, 'utf8')

console.log(`✅ Cuenta «${usuario}» creada en ${RUTA}`)
console.log(`   Cuentas en el fichero: ${cuentas.length}`)
console.log('')
console.log('   Y hace falta ATRIZ_SECRETO en el entorno del servidor, o el inicio')
console.log('   de sesión responderá 500. Genera uno así:')
console.log('       node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
