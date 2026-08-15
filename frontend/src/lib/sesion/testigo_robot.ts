/**
 * EL TESTIGO PARA EL ROBOT: un JWT Ed25519 que abre el agente de sesion. PURO —
 * sin `fs`, sin red y sin `process.env`: la clave se recibe, no se busca.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTE NO ES EL TESTIGO DE `testigo.ts`, Y LA DIFERENCIA IMPORTA
 * ═══════════════════════════════════════════════════════════════════════════
 * `testigo.ts` protege LA INTERFAZ: va en una cookie, lo firma un HMAC y lo
 * verifica este mismo servidor. **Este protege EL ROBOT**: viaja al agente de
 * sesion de una Pi, que ejecuta codigo de verdad, y lo verifica **otro programa
 * en otra maquina y en otro lenguaje**.
 *
 * De ahi las dos decisiones que no se pueden tocar sin romper al verificador:
 *
 * 1. **Ed25519, no HMAC.** Con un secreto compartido, ese secreto viviria en 16
 *    microSD a las que cualquiera del aula tiene acceso fisico, y **quien sacara
 *    una podria emitir testigos para las otras quince**. Aqui el servidor guarda
 *    la privada y cada robot solo lleva la **publica**, que no firma nada.
 * 2. 🔴 **`exp` e `iat` van en SEGUNDOS**, no en milisegundos como `Carga` de
 *    `testigo.ts`. Lo impone el verificador, que los compara contra
 *    `time.time()` de Python (`atriz_testigo.py:144-155`). Mezclar las dos
 *    unidades da un testigo que caduca en 1970 o dentro de 50 000 años, y las
 *    dos formas fallan **en el robot**, lejos de aqui.
 *
 * El verificador es `atriz_migracion/scripts/atriz_testigo.py`, y sus pruebas
 * viven en `scripts/pruebas/test_atriz_testigo.py`. Este fichero y aquel son
 * **un solo contrato escrito en dos lenguajes**: por eso hay un testigo de
 * ejemplo versionado que los dos leen (ver `testigo_robot.test.ts`).
 */

import { createPrivateKey, sign, type KeyObject } from 'node:crypto'

/** Lo que va firmado. Los cuatro campos que `atriz_testigo.py` sabe leer. */
export interface CargaRobot {
  /** Quien. El agente lo usa para decir «ana esta ejecutando desde hace 40 s». */
  sub: string
  /** A que robot abre. El agente compara con el SUYO y no necesita saber mas. */
  rob: number
  /** Caducidad, en SEGUNDOS desde la epoca. */
  exp: number
  /** Emision, en SEGUNDOS desde la epoca. */
  iat: number
}

/**
 * 🔴 DIEZ MINUTOS, Y NO «LO QUE DURA UNA CLASE» — que es lo que decia el diseño
 * original (`2026-08-10-fase-b-proxy.md`, apartado 3).
 *
 * El motivo es que **el agente valida el testigo UNA VEZ, en el apreton de
 * manos** del WebSocket: viaja en el subprotocolo, que solo existe al abrir. Una
 * vez abierta la conexion, la caducidad ya no interviene.
 *
 * Entonces el testigo no tiene que sobrevivir a la clase: solo al viaje entre
 * pedirlo y conectar. Y como **hoy viaja en claro** —decision tomada, sin TLS—,
 * cada minuto de vida de mas es ventana de fuga gratis.
 *
 * → El cliente pide uno nuevo antes de cada conexion, incluidas las
 *   reconexiones. Es una peticion al MISMO servidor que ya sirvio la pagina, con
 *   la cookie de sesion que el navegador ya manda: no cuesta nada.
 *
 * ⚠️ Y con esto se cierra sola una casilla que el plan dejaba abierta —«que pasa
 *    con una pestaña abierta cuando el testigo caduca»—: no pasa nada, porque el
 *    testigo no gobierna la sesion abierta.
 */
export const DURACION_TESTIGO_ROBOT_S = 10 * 60

/**
 * Margen que el verificador tolera en el reloj, en segundos.
 *
 * ⚠️ NO es un numero de aqui: es `MARGEN_RELOJ_S` de `atriz_testigo.py:58`, y se
 *    repite para poder comprobar en una prueba que la vida del testigo es
 *    holgadamente mayor que el. Un testigo mas corto que el margen seria
 *    indistinguible de uno recien caducado.
 */
export const MARGEN_RELOJ_VERIFICADOR_S = 60

/** Base64 de URL sin relleno, que es lo que usa JWT (y lo que `_b64u` deshace). */
function b64u(b: Buffer): string {
  return b.toString('base64url')
}

/**
 * 🔴 LA CABECERA VA CON LAS CLAVES EN ESTE ORDEN Y SIN ESPACIOS.
 *
 * No por estetica: lo firmado es el TEXTO, asi que dos JSON equivalentes con
 * distinto orden dan firmas distintas. Se construye a mano una sola vez en vez
 * de dejarlo al `JSON.stringify` de un objeto que alguien podria reordenar.
 */
const CABECERA = b64u(Buffer.from('{"alg":"EdDSA","typ":"JWT"}', 'utf8'))

/**
 * Emite el testigo. `ahoraMs` se pasa —no se lee del reloj— para que las pruebas
 * puedan fijar el instante sin tocar `Date`.
 *
 * 🔴 Lanza si el robot no es un entero de 1 a 16. Un `rob` invalido no produce
 *    un rechazo del agente: produce un testigo que **nunca casa con ninguno**, y
 *    el sintoma seria «el terminal no abre y no dice por que», buscado en el
 *    robot. Se para aqui, que es donde se sabe.
 */
export function firmarTestigoRobot(
  clavePrivada: KeyObject,
  datos: { usuario: string; robot: number; ahoraMs: number },
): string {
  const { usuario, robot, ahoraMs } = datos
  if (!Number.isInteger(robot) || robot < 1 || robot > 16) {
    throw new Error(`el robot tiene que ser un entero de 1 a 16, y llego «${robot}»`)
  }
  if (usuario.length === 0) {
    throw new Error('un testigo sin usuario no sirve: el agente lo enseña al siguiente que llegue')
  }

  // Segundos, no milisegundos. Ver la cabecera de este fichero.
  const iat = Math.floor(ahoraMs / 1000)
  const carga: CargaRobot = { sub: usuario, rob: robot, exp: iat + DURACION_TESTIGO_ROBOT_S, iat }

  const cuerpo = b64u(Buffer.from(JSON.stringify(carga), 'utf8'))
  const firmado = `${CABECERA}.${cuerpo}`
  // `null` como algoritmo es lo que pide Node para Ed25519: la curva ya lo fija.
  const firma = b64u(sign(null, Buffer.from(firmado, 'ascii'), clavePrivada))
  return `${firmado}.${firma}`
}

/**
 * Lee la clave privada de su forma PEM.
 *
 * 🔴 Devuelve `null` en vez de lanzar, y **no inventa una clave**, que es la
 *    misma decision que `secreto()` toma con `ATRIZ_SECRETO`: generar una al
 *    vuelo daria un servidor que arranca y firma testigos que **ningun robot
 *    puede verificar**, y el sintoma aparece en la Pi.
 */
export function clavePrivadaDe(pem: string | undefined): KeyObject | null {
  if (pem === undefined || pem.trim() === '') return null
  try {
    const clave = createPrivateKey(pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem)
    // Un RSA o un EC aqui firmarian sin quejarse y el robot no los entenderia.
    return clave.asymmetricKeyType === 'ed25519' ? clave : null
  } catch {
    return null
  }
}

/**
 * El prefijo del subprotocolo por el que viaja el testigo, y el subprotocolo que
 * el agente contesta siempre. Los dos valores son de `atriz_testigo.py:35-39`.
 *
 * 🔴 **VIVEN EN OTRO FICHERO, Y NO ES ORGANIZACION: ES QUE ESTE MODULO NO PUEDE
 *    LLEGAR AL NAVEGADOR.** Importa `node:crypto` y calcula `CABECERA` al
 *    evaluarse; en el navegador eso revienta con `Unknown encoding: base64url` y
 *    **tumba la pagina entera**. Pasó el 2026-08-15, justo al deduplicar estas
 *    dos constantes trayendolas aqui desde `useAgente.ts`.
 *
 * → El cliente importa de `enlace_agente.ts`, que **no importa nada**. Aqui solo
 *   se reexportan para que siga habiendo una sola fuente de verdad, que era lo
 *   que pedia la auditoria del robot (evidencia 117 §6).
 */
export { PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE } from './enlace_agente'
