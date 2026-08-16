/**
 * A DONDE SE VUELVE DESPUES DE ENTRAR. Puro: sin `fs`, sin red, sin `crypto`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 UN `?volver=` SIN VALIDAR ES UNA REDIRECCION ABIERTA DE MANUAL
 * ═══════════════════════════════════════════════════════════════════════════
 * La puerta manda a `/entrar?volver=/robot/3/lidar` para devolver a quien iba a
 * algun sitio. Si ese valor se usara tal cual, **un enlace preparado llevaria a
 * cualquier parte despues de entrar**:
 *
 *     /entrar?volver=https://el-que-sea.example
 *
 * Y la forma de esa trampa es exactamente lo que la hace funcionar: la persona
 * ve el dominio de SU laboratorio, escribe su contraseña de verdad, y acaba en
 * otro sitio ya autenticada y confiada. Es de los pocos agujeros que se explotan
 * sin tocar el servidor.
 *
 * Cerrarlo cuesta una funcion pura y sus casos. No hacerlo cuesta la credencial
 * que abre los dieciseis robots.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SE ACEPTA POR LISTA BLANCA, NO POR LISTA NEGRA
 * ═══════════════════════════════════════════════════════════════════════════
 * La tentacion es prohibir lo malo: «que no empiece por `//`, que no lleve
 * `http`». Eso se rompe siempre, porque las formas de escribir una URL absoluta
 * son mas de las que uno recuerda —`//`, `/\`, `\\`, `%2f%2f`, `https:/`—.
 *
 * Aqui se hace al reves: **solo pasa lo que casa una ruta interna reconocible**,
 * y todo lo demas cae al destino por defecto. Un falso rechazo manda al muro,
 * que es una molestia; un falso aceptado manda la sesion a otro sitio.
 */

/** A donde se va cuando no hay destino, o cuando el que hay no vale. */
export const DESTINO_POR_DEFECTO = '/flota'

/**
 * Lo unico que se acepta: barra, y despues caracteres de una ruta interna.
 *
 * ⚠️ La segunda posicion **no puede ser otra barra ni una contrabarra**: `//x` es
 *    una URL sin esquema —el navegador la resuelve como `https://x`— y `/\x` lo
 *    tratan igual varios navegadores. Es el caso que mas se cuela.
 */
const RUTA_INTERNA = /^\/(?![/\\])[\w\-./~%!$&'()*+,;=:@?#[\]]*$/

/**
 * El destino seguro de un `?volver=`, o `/flota`.
 *
 * ⚠️ NO decodifica antes de comprobar, y es deliberado: decodificar `%2f%2f`
 *    convertiria una cadena que HOY no pasa en una que si, y quien la resuelva
 *    despues puede volver a decodificarla. Se valida la forma tal y como llega,
 *    que es la que el navegador va a usar.
 */
export function destinoSeguro(crudo: string | null | undefined): string {
  if (crudo === null || crudo === undefined) return DESTINO_POR_DEFECTO

  const v = crudo.trim()
  if (v === '') return DESTINO_POR_DEFECTO

  // Un esquema en cualquier parte descalifica: `javascript:`, `data:`, `https:`.
  if (v.includes(':') && /^[a-z][a-z0-9+.-]*:/i.test(v)) return DESTINO_POR_DEFECTO

  return RUTA_INTERNA.test(v) ? v : DESTINO_POR_DEFECTO
}
