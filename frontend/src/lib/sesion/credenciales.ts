/**
 * HASHEAR Y COMPROBAR UNA CONTRASEÑA. **Solo servidor.**
 *
 * 🔴 Este fichero importa `node:crypto`, así que NO puede entrar en un
 *    componente de cliente ni indirectamente. Las reglas que la pantalla también
 *    necesita —`revisarAlta`, `normalizar`, `MINIMO_CONTRASENA`, `Cuenta`— viven
 *    en `reglas.ts`, y **este módulo no las reexporta a propósito**: un
 *    reexportador cómodo aquí volvería a arrastrar `node:crypto` hasta el
 *    navegador la próxima vez que alguien importe del sitio equivocado, que es
 *    exactamente cómo se rompió la primera vez.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  clave: string, sal: Buffer, largo: number
) => Promise<Buffer>

const LARGO_HASH = 64
const LARGO_SAL = 16

/**
 * `sal:hash` con `scrypt`.
 *
 * 🔴 SAL POR CUENTA, y por eso dos personas con la misma contraseña tienen
 *    hashes distintos: sin sal, ver dos iguales en el fichero ya delata que
 *    comparten contraseña, y una tabla precalculada valdría para las dos.
 */
export async function hashear(contrasena: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL)
  const hash = await scrypt(contrasena, sal, LARGO_HASH)
  return `${sal.toString('hex')}:${hash.toString('hex')}`
}

/**
 * ¿Es esta la contraseña de esa cuenta?
 *
 * 🔴 `timingSafeEqual` Y NO `===`: comparar dos hashes con `===` termina en el
 *    primer byte distinto, así que **el tiempo de respuesta filtra cuántos bytes
 *    acertaste**. Es la misma familia de fallo que el resto de este proyecto —
 *    algo que funciona y dice de más sin que se note.
 *
 * ⚠️ Nunca lanza. Un `clave` corrupto en el fichero devuelve `false`, no un 500.
 */
export async function verificar(contrasena: string, guardada: string): Promise<boolean> {
  const [salHex, hashHex] = guardada.split(':')
  if (salHex === undefined || hashHex === undefined) return false

  let esperado: Buffer
  try {
    esperado = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (esperado.length !== LARGO_HASH) return false

  const calculado = await scrypt(contrasena, Buffer.from(salHex, 'hex'), LARGO_HASH)
  return timingSafeEqual(calculado, esperado)
}
