/**
 * QUÉ DECIRLE A QUIEN NO CONSIGUE ENTRAR. PURO, y por eso se puede probar.
 *
 * 📝 La discriminación por estado HTTP viene de
 *    `SIVE_App/frontend/src/components/LoginPage.js`, que separa 401, 423 y 429
 *    en tres mensajes distintos en vez de un «error» genérico. Es acertado: las
 *    tres causas piden cosas distintas de quien está delante —revisar lo que
 *    escribió, esperar, o avisar a alguien— y un mensaje único las esconde.
 */

/** Lo que devuelve el servidor cuando algo va mal. */
export interface RespuestaFallo {
  estado: number
  /** Segundos que faltan, en el 423 y el 429. */
  segundos?: number
}

/**
 * 🔴 EL ÚLTIMO CASO ES EL IMPORTANTE, Y ES EL QUE SIVE NO TIENE.
 *
 * Su `LoginPage` manda cualquier estado no contemplado al mismo mensaje que el
 * 401, así que un 502 de un proxy mal puesto se lee como «te has equivocado de
 * contraseña» — y quien lo lee se pasa diez minutos tecleando una contraseña
 * correcta. Adivinar la causa más probable es justo lo que este proyecto tiene
 * prohibido: un estado desconocido **dice su número** y manda a mirar el
 * servidor.
 */
export function mensajeDeFallo(f: RespuestaFallo): string {
  const s = f.segundos
  switch (f.estado) {
    case 400:
    case 401:
      return 'Usuario o contraseña incorrectos.'
    case 423:
      return s === undefined
        ? 'Esta cuenta está bloqueada temporalmente.'
        : `Esta cuenta está bloqueada temporalmente. Vuelve a probar en ${s} s.`
    case 429:
      return s === undefined
        ? 'Demasiados intentos. Espera antes de volver a probar.'
        : `Demasiados intentos. Espera ${s} s antes de volver a probar.`
    case 500:
      return 'El servidor no puede firmar sesiones. Suele ser que falta ATRIZ_SECRETO en su '
        + 'entorno; hasta que se ponga, no puede entrar nadie.'
    default:
      return `Respuesta inesperada del servidor (código ${f.estado}). No es tu contraseña: `
        + 'mira el servidor.'
  }
}

/**
 * Cuando `fetch` ni siquiera llega.
 *
 * ⚠️ Es un mensaje aparte y no uno de los de arriba porque la causa es de otra
 *    familia: ahí no hay servidor que responda, así que no hay nada que un
 *    cambio de contraseña pueda arreglar.
 */
export const SIN_SERVIDOR = 'No se pudo conectar con el servidor. '
  + 'Comprueba que la aplicación sigue corriendo.'
