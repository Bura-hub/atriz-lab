/**
 * LAS CUENTAS DEL LABORATORIO. PURO: sin `fs`, sin red y sin estado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 UNA SOLA CLASE DE CUENTA, Y NO ES UN ATAJO
 * ═══════════════════════════════════════════════════════════════════════════
 * No hay `rol`. Quien tiene cuenta puede liberar una parada y crear otras
 * cuentas; los dieciseis alumnos usan la aplicacion **sin entrar**, igual que
 * hasta ahora.
 *
 * Se planteo un campo `rol` con dos valores y se descarto por una razon de este
 * repositorio: hoy solo habria uno en uso, y un campo con un unico valor no es
 * una jerarquia — es la promesa de una que no existe. Cuando haga falta separar
 * «administrar» de «operar» se añade, y entonces significara algo.
 *
 * 📝 La decision de fondo: en un laboratorio de 16 robots con un profesor
 *    presente, la persona que libera una parada y la que da de alta a un monitor
 *    son la misma.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  clave: string, sal: Buffer, largo: number
) => Promise<Buffer>

/** Lo que se guarda por cuenta. **Nunca** la contraseña en claro. */
export interface Cuenta {
  usuario: string
  /** `sal:hash`, los dos en hexadecimal. */
  clave: string
  /** Milisegundos desde la época. Se enseña en la tabla; el hash no. */
  creada: number
}

const LARGO_HASH = 64
const LARGO_SAL = 16

/** Mínimo de la contraseña. Corto a propósito: ver `revisarAlta`. */
export const MINIMO_CONTRASENA = 10

/** Lo que se acepta como nombre: letras sin acento, dígitos, punto y guiones. */
const NOMBRE_VALIDO = /^[a-z0-9][a-z0-9._-]{2,31}$/

/**
 * Por qué NO se puede dar de alta, o `null` si se puede.
 *
 * 🔴 Devuelve el MOTIVO y no un booleano: la pantalla tiene que poder decir qué
 *    falla. Un «datos inválidos» a secas obliga a adivinar, y quien da de alta a
 *    un monitor con la clase empezando no está para adivinar.
 *
 * ⚠️ El mínimo son 10 caracteres y NO se exige mayúscula, dígito ni símbolo
 *    —SIVE pide 12 con las cuatro familias—. Es deliberado: esas reglas empujan
 *    a `Laboratorio2026!`, que es peor que una frase larga, y aquí las cuentas
 *    las crea a mano una persona que está en la sala. La longitud es lo único
 *    que de verdad cuesta romper.
 */
export function revisarAlta(usuario: string, contrasena: string): string | null {
  const u = usuario.trim().toLowerCase()
  if (u === '') return 'Hace falta un nombre de usuario.'
  if (!NOMBRE_VALIDO.test(u)) {
    return 'El nombre va en minúsculas, de 3 a 32 caracteres, y solo admite letras, dígitos, punto, guion y guion bajo.'
  }
  if (contrasena.length < MINIMO_CONTRASENA) {
    return `La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`
  }
  // Una contraseña que es el propio nombre pasa cualquier regla de forma y no
  // protege de nada: es lo primero que prueba quien la adivina.
  if (contrasena.toLowerCase().includes(u)) {
    return 'La contraseña no puede contener el nombre de usuario.'
  }
  return null
}

/** El nombre tal y como se guarda y se compara: recortado y en minúsculas. */
export function normalizar(usuario: string): string {
  return usuario.trim().toLowerCase()
}

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
