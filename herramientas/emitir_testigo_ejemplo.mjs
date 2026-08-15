/**
 * EMITE EL TESTIGO DE EJEMPLO QUE CRUZA LOS DOS LENGUAJES.
 *
 *     node herramientas/emitir_testigo_ejemplo.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE EXISTE ESTE FICHERO
 * ═══════════════════════════════════════════════════════════════════════════
 * El testigo del terminal lo **firma Next** (`lib/sesion/testigo_robot.ts`) y lo
 * **verifica Python** (`atriz_migracion/scripts/atriz_testigo.py`), en otra
 * maquina y en otro lenguaje. Cada lado tiene sus pruebas y **las dos pasarian
 * con el contrato roto**: basta con que cada uno sea coherente consigo mismo.
 *
 * Lo unico que cruza de verdad es un testigo REAL emitido por uno y verificado
 * por el otro. Eso es lo que este guion produce.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y POR QUE NO SE VERSIONA LA CLAVE PRIVADA
 * ═══════════════════════════════════════════════════════════════════════════
 * La pareja se genera aqui, se usa y **se tira**. Al fichero solo va la clave
 * PUBLICA, que es la que el robot lleva de todas formas y no firma nada.
 *
 * Este proyecto tiene dos credenciales expuestas en repositorios publicos y una
 * regla que lo prohibe. Una clave privada «de mentira» versionada acabaria
 * pareciendose demasiado a una de verdad el dia que alguien copie el patron.
 *
 * ⚠️ Consecuencia: el testigo del fichero **no se puede volver a emitir igual**.
 *    Regenerarlo cambia la clave publica y el testigo a la vez, que es
 *    exactamente lo que se quiere — los dos van juntos o no van.
 */

import { generateKeyPairSync, sign } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const DESTINO = join(AQUI, 'testigo_ejemplo.json')

const b64u = (b) => Buffer.from(b).toString('base64url')

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

/*
 * 🔴 Se emite A MANO y no llamando a `firmarTestigoRobot()`, a proposito.
 *
 * Si este guion importara la funcion que quiere comprobar, un cambio en ella
 * cambiaria el ejemplo Y el verificador de TypeScript a la vez, y el fichero
 * dejaria de ser un testigo independiente. Aqui se escribe el JWT segun el
 * ESTANDAR, y que coincida con lo que emite la web es justo lo que se prueba.
 */
const ahora = Math.floor(Date.now() / 1000)
const cabecera = b64u('{"alg":"EdDSA","typ":"JWT"}')
const carga = { sub: 'ana', rob: 7, exp: ahora + 600, iat: ahora }
const cuerpo = b64u(JSON.stringify(carga))
const firma = b64u(sign(null, Buffer.from(`${cabecera}.${cuerpo}`, 'ascii'), privateKey))

const ejemplo = {
  _lee_esto:
    'Testigo de ejemplo para cruzar Next (firma) con atriz_testigo.py (verifica). '
    + 'La clave privada se genero, se uso y se tiro: aqui solo esta la publica. '
    + 'Regenerar con: node herramientas/emitir_testigo_ejemplo.mjs',
  clave_publica_pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  testigo: `${cabecera}.${cuerpo}.${firma}`,
  robot: carga.rob,
  sujeto: carga.sub,
  //: El instante en que se emitio. Quien lo verifique DEBE congelar su reloj
  //: aqui: si no, el ejemplo caduca a los diez minutos y la prueba se vuelve
  //: roja sola una tarde cualquiera, sin que nadie haya roto nada.
  emitido_s: ahora,
}

writeFileSync(DESTINO, `${JSON.stringify(ejemplo, null, 2)}\n`, 'utf8')
console.log(`escrito ${DESTINO}`)
console.log(`  robot ${ejemplo.robot} · sujeto ${ejemplo.sujeto} · emitido ${ejemplo.emitido_s}`)
