/**
 * EL BLOQUEO POR INTENTOS FALLIDOS. PURO: sin reloj propio y sin estado global.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTO VIVE EN EL SERVIDOR, Y ES LA DIFERENCIA QUE IMPORTA CON SIVE
 * ═══════════════════════════════════════════════════════════════════════════
 * `SIVE_App/frontend/src/components/LoginPage.js` guarda los intentos fallidos
 * en `localStorage`:
 *
 *     localStorage.setItem('loginFailedAttempts', newFailedAttempts.toString())
 *     if (newFailedAttempts >= 5) blockTemporarily()
 *
 * Eso se salta abriendo la consola y borrando una clave. Su servidor Django
 * ademas lleva su propio contador —`failed_attempts_count` y `locked_until` en
 * `UserProfile`, con respuesta 423—, asi que alli el de navegador es solo un
 * aviso amable. Aqui **no hay dos**: el unico contador que existe es este, y
 * corre en el servidor. Un contador de intentos que el atacante puede poner a
 * cero no cuenta nada.
 *
 * La curva es la de SIVE, a proposito: `min(30 · 2^(n−5), 300)` segundos a
 * partir del quinto fallo, con tope de cinco minutos.
 */

/** Fallos que se perdonan antes de empezar a bloquear. */
export const FALLOS_ANTES_DE_BLOQUEAR = 5

/** Tope del bloqueo. Cinco minutos: molesta a quien prueba, no a quien teclea mal. */
export const BLOQUEO_MAXIMO_S = 300

/** Lo que se recuerda de cada nombre de usuario que ha fallado. */
export interface Intentos {
  fallos: number
  /** Instante en que se puede volver a probar. `0` = no hay bloqueo. */
  bloqueadoHasta: number
}

export const SIN_INTENTOS: Intentos = { fallos: 0, bloqueadoHasta: 0 }

/**
 * Segundos de castigo tras `fallos` fallos.
 *
 * 📝 Devuelve 0 hasta el quinto: los cuatro primeros son gratis porque teclear
 *    mal una contraseña larga es lo normal.
 *
 * 🔴 Y aquí el coste de pasarse no es abstracto: **quien entra es quien libera
 *    una parada de emergencia**. Bloquear al segundo intento deja a esa persona
 *    fuera hasta `BLOQUEO_MAXIMO_S` —cinco minutos— con un robot parado delante
 *    y una clase esperando. Por eso la curva empieza tarde y tiene tope.
 */
export function castigoS(fallos: number): number {
  if (fallos < FALLOS_ANTES_DE_BLOQUEAR) return 0
  return Math.min(30 * 2 ** (fallos - FALLOS_ANTES_DE_BLOQUEAR), BLOQUEO_MAXIMO_S)
}

/** Un fallo más, con su bloqueo ya calculado. */
export function trasFallar(previo: Intentos, ahora: number): Intentos {
  const fallos = previo.fallos + 1
  const castigo = castigoS(fallos)
  return {
    fallos,
    bloqueadoHasta: castigo === 0 ? 0 : ahora + castigo * 1000,
  }
}

/**
 * 🔴 ACERTAR LO REINICIA TODO. Sin esto, quien se equivoca cuatro veces a lo
 *    largo de una mañana acaba bloqueado por un quinto fallo horas después,
 *    habiendo entrado bien tres veces por medio.
 */
export function trasAcertar(): Intentos {
  return SIN_INTENTOS
}

/** Segundos que faltan, o `0` si ya se puede probar. */
export function segundosQueFaltan(i: Intentos, ahora: number): number {
  if (i.bloqueadoHasta <= ahora) return 0
  return Math.ceil((i.bloqueadoHasta - ahora) / 1000)
}
