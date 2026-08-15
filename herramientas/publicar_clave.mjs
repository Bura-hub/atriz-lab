/**
 * ¿QUÉ CLAVE PÚBLICA ESPERAN LOS ROBOTS DE ESTE SERVIDOR?
 *
 *     cd frontend && node ../herramientas/publicar_clave.mjs
 *
 * Deriva la mitad pública de la `ATRIZ_CLAVE` que hay en `.env.local` y la
 * imprime. **No guarda nada**: la pública es un derivado, y un derivado
 * versionado se queda rancio en cuanto alguien regenera la pareja — y entonces
 * el fichero del repositorio dice una cosa y el servidor firma con otra.
 *
 * Sirve para dos preguntas que se hacen de verdad:
 *
 *   · Al desplegar: qué copiar a `/etc/atriz/testigo.pub` de cada robot.
 *   · Al depurar un `4403` («la firma no es válida»): comparar esta salida con
 *     la del robot es lo que separa «el testigo está mal» de «el robot tiene la
 *     clave de OTRO servidor», que se ven igual desde el navegador.
 */

import { readFileSync } from 'node:fs'
import { createPublicKey } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ENV = join(AQUI, '..', 'frontend', '.env.local')

let crudo
try {
  crudo = readFileSync(ENV, 'utf8')
} catch {
  console.error(`🔴 No encuentro ${ENV}.`)
  console.error('   La clave vive ahí. Se genera con: node herramientas/generar_clave.mjs')
  process.exit(1)
}

// `ATRIZ_CLAVE="..."` en una línea, con los saltos escapados.
const linea = crudo.split('\n').find((l) => l.trimStart().startsWith('ATRIZ_CLAVE='))
if (linea === undefined) {
  console.error('🔴 No hay ATRIZ_CLAVE en .env.local, así que este servidor NO puede firmar')
  console.error('   testigos y el terminal no abriría en ningún robot.')
  console.error('   Se genera con: node herramientas/generar_clave.mjs')
  process.exit(1)
}

const valor = linea.slice(linea.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
const pem = valor.replace(/\\n/g, '\n')

let publica
try {
  const clave = createPublicKey({ key: pem, format: 'pem' })
  if (clave.asymmetricKeyType !== 'ed25519') {
    console.error(`🔴 ATRIZ_CLAVE no es Ed25519, es «${clave.asymmetricKeyType}».`)
    console.error('   El verificador del robot solo entiende Ed25519.')
    process.exit(1)
  }
  publica = clave.export({ type: 'spki', format: 'pem' }).toString()
} catch (e) {
  console.error(`🔴 ATRIZ_CLAVE no se puede leer como clave PEM: ${e.message}`)
  process.exit(1)
}

console.log('Esta es la clave pública que espera cada robot en /etc/atriz/testigo.pub:')
console.log()
console.log(publica.trimEnd())
