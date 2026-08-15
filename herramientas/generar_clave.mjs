/**
 * GENERA LA PAREJA DE CLAVES DEL TALLER.
 *
 *     node herramientas/generar_clave.mjs
 *
 * Imprime las dos mitades y NO escribe nada: quien la ejecuta decide dónde va
 * cada una. Escribir la privada en un fichero por su cuenta sería dejarla en un
 * sitio que quizá esté dentro de git.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS DOS MITADES VAN A SITIOS DISTINTOS, Y ESE ES TODO EL PUNTO
 * ═══════════════════════════════════════════════════════════════════════════
 *   · **La PRIVADA** → `ATRIZ_CLAVE` en `frontend/.env.local`, que está fuera de
 *     git. Vive en UN sitio: el portátil que sirve la web.
 *   · **La PÚBLICA** → los 16 robots, en `/etc/atriz/testigo.pub`. No firma
 *     nada, así que una microSD robada no emite testigos.
 *
 * Con un secreto compartido (HMAC) esto no se podría separar: el mismo secreto
 * estaría en los 16 cacharros de un aula, y **quien sacara uno podría emitir
 * testigos para los otros quince**. Es la razón entera de que sea asimétrica.
 *
 * ⚠️ Cambiar la pareja invalida los testigos de todos los robots a la vez, y hay
 *    que repartir la pública otra vez. No es una operación de clase.
 */

import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

const privada = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const publica = publicKey.export({ type: 'spki', format: 'pem' }).toString()

console.log('════════════════════════════════════════════════════════════════')
console.log(' 1 · LA PRIVADA — al final de frontend/.env.local, en UNA línea')
console.log('════════════════════════════════════════════════════════════════')
// En una sola línea con `\n` escapados: es como cabe en un `.env`, y
// `clavePrivadaDe()` los deshace.
console.log(`ATRIZ_CLAVE="${privada.trimEnd().replace(/\n/g, '\\n')}"`)
console.log()
console.log('════════════════════════════════════════════════════════════════')
console.log(' 2 · LA PÚBLICA — a cada robot, en /etc/atriz/testigo.pub')
console.log('════════════════════════════════════════════════════════════════')
console.log(publica.trimEnd())
console.log()
console.log('🔴 La privada NO se guarda en ningún sitio por este guion, y no se')
console.log('   puede recuperar. Si se pierde, se genera otra pareja y se')
console.log('   reparte la pública otra vez a los 16.')
