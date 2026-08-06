/**
 * EL TESTIGO DE SESIÓN: un `{usuario, exp}` firmado. PURO — sin `fs` y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LO QUE ESTE TESTIGO PROTEGE, Y LO QUE NO
 * ═══════════════════════════════════════════════════════════════════════════
 * Protege **la interfaz**, no el robot. El navegador habla directamente con el
 * `rosbridge` de cada robot y el servidor de Next **no esta en ese camino**:
 * cualquiera del aula abre `ws://rvr-07.local:9090` desde la consola y llama a
 * `/release_emergency_stop` sin pasar por aqui. rosbridge 2.7.0 no tiene
 * autenticacion —`rosauth` no es dependencia, no existe el parametro
 * `authenticate`, y `check_origin()` devuelve `True` incondicionalmente—, asi
 * que no hay forma de que la tenga mientras el navegador hable con el directo.
 *
 * → Lo que si cierra: el **error honesto**. Alguien que libera una parada por
 *   curiosidad, o que se equivoca de robot. Es el riesgo que la duda A4 del
 *   proyecto identifica como el real en un taller presencial.
 * → Lo que cerraria de verdad es la **Fase B**: un proxy en cada robot que
 *   valide este mismo testigo, con rosbridge atado a `127.0.0.1`. Por eso el
 *   testigo se firma con HMAC y lleva caducidad **desde ya**: el dia que llegue
 *   la Fase B solo se muda el verificador del navegador al robot, y esta forma
 *   no cambia.
 *
 * ⚠️ Y por eso la interfaz DICE las dos cosas. Un inicio de sesion que se
 *    presente como control de acceso sin serlo es el estado engañoso que este
 *    proyecto lleva meses quitando de en medio.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Lo que va firmado. Cambiar un campo aqui invalida los testigos existentes. */
export interface Carga {
  usuario: string
  /** Instante de caducidad, en milisegundos desde la época. */
  exp: number
}

/**
 * 🔴 UN RESULTADO DISCRIMINADO, Y `abrir()` NUNCA LANZA.
 *
 * Un testigo llega de fuera —de una cookie que el navegador pudo tocar—, asi
 * que «no vale» es un camino NORMAL, no una excepcion. Con `throw` habria que
 * envolver cada llamada en un `try` y la primera que se olvidara tumbaria la
 * peticion con un 500, que sobre una pagina de inicio de sesion se lee como
 * «el servidor esta roto» en vez de «tu sesion caduco».
 */
export type Apertura =
  | { valido: true; carga: Carga }
  | { valido: false; motivo: 'MAL_FORMADO' | 'FIRMA_NO_CUADRA' | 'CADUCADO' }

/** Ocho horas: una clase. Pasado eso hay que volver a entrar. */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000

/**
 * Base64 apto para una cookie: sin `+`, sin `/` y sin relleno.
 *
 * ⚠️ Se hace a mano y no con `base64url` de Node por una razon tonta y real: el
 *    valor viaja en una cabecera `Set-Cookie`, y `=` es el separador de esa
 *    cabecera. Un relleno mal escapado parte la cookie por la mitad.
 */
function aBase64Url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function firmaDe(cuerpo: string, secreto: string): string {
  return aBase64Url(createHmac('sha256', secreto).update(cuerpo).digest())
}

/** `cuerpo.firma`, listo para meter en una cookie. */
export function firmar(carga: Carga, secreto: string): string {
  const cuerpo = aBase64Url(Buffer.from(JSON.stringify(carga), 'utf8'))
  return `${cuerpo}.${firmaDe(cuerpo, secreto)}`
}

/**
 * Abre un testigo y comprueba las tres cosas, EN ESTE ORDEN.
 *
 * 🔴 LA FIRMA SE COMPRUEBA ANTES QUE LA CADUCIDAD, y no es indiferente: `exp`
 *    va DENTRO de lo firmado, asi que mirar la caducidad primero seria hacer
 *    caso a un numero que todavia no se sabe si escribimos nosotros. Quien
 *    manipule la cookie se pondria una caducidad lejana y la comprobacion
 *    diria «vigente» sobre un testigo inventado.
 *
 * @param ahora inyectado para poder probar la caducidad sin esperar ocho horas.
 */
export function abrir(testigo: string, secreto: string, ahora: number): Apertura {
  const punto = testigo.lastIndexOf('.')
  if (punto <= 0 || punto === testigo.length - 1) return { valido: false, motivo: 'MAL_FORMADO' }

  const cuerpo = testigo.slice(0, punto)
  const firmaRecibida = Buffer.from(testigo.slice(punto + 1), 'utf8')
  const firmaEsperada = Buffer.from(firmaDe(cuerpo, secreto), 'utf8')

  /*
   * 🔴 `timingSafeEqual` LANZA SI LAS LONGITUDES DIFIEREN, asi que la
   *    comparacion de longitud va antes y por separado. No filtra nada util —la
   *    longitud de una firma HMAC-SHA256 es siempre la misma—, pero sin esto una
   *    firma recortada tumbaria la peticion con una excepcion en vez de
   *    devolver «no cuadra».
   */
  if (firmaRecibida.length !== firmaEsperada.length) {
    return { valido: false, motivo: 'FIRMA_NO_CUADRA' }
  }
  if (!timingSafeEqual(firmaRecibida, firmaEsperada)) {
    return { valido: false, motivo: 'FIRMA_NO_CUADRA' }
  }

  let carga: unknown
  try {
    carga = JSON.parse(deBase64Url(cuerpo).toString('utf8'))
  } catch {
    // Firma buena y cuerpo ilegible no deberia poder pasar; si pasa, es un
    // testigo nuestro corrompido, y se trata como lo que es: no vale.
    return { valido: false, motivo: 'MAL_FORMADO' }
  }

  if (!esCarga(carga)) return { valido: false, motivo: 'MAL_FORMADO' }
  if (carga.exp <= ahora) return { valido: false, motivo: 'CADUCADO' }
  return { valido: true, carga }
}

function esCarga(v: unknown): v is Carga {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return typeof c.usuario === 'string' && c.usuario !== ''
    && typeof c.exp === 'number' && Number.isFinite(c.exp)
}
