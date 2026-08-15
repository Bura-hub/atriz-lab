/**
 * LAS DOS CADENAS DEL APRETON DE MANOS CON EL AGENTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTAN EN UN FICHERO PARA ELLAS SOLAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Las necesitan **los dos lados**: el servidor, que firma el testigo, y el
 * navegador, que lo ofrece como subprotocolo. Vivian en `testigo_robot.ts`, que
 * es donde nacieron y donde parecia que tenian que estar.
 *
 * **Y eso rompio la aplicacion entera el 2026-08-15.** `testigo_robot.ts` hace
 * `import { sign } from 'node:crypto'` y calcula su cabecera JWT **al evaluarse
 * el modulo**:
 *
 *     const CABECERA = b64u(Buffer.from('{"alg":"EdDSA","typ":"JWT"}', 'utf8'))
 *
 * Al importarlo desde `useAgente.ts` —que es `'use client'`— el modulo ENTERO
 * viajo al navegador, y ahi el `Buffer` que pone Next **no conoce la
 * codificacion `base64url`**:
 *
 *     TypeError: Unknown encoding: base64url
 *         at b64u (...)
 *         at __TURBOPACK__module__evaluation__     <- al EVALUAR, no al usar
 *
 * Como revienta al evaluar el modulo, no se cae el terminal: se cae **la pagina
 * completa**, con «Application error: a client-side exception has occurred» y
 * sin una palabra de cual era el modulo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE NO LO VIO, Y ES LA PARTE QUE HAY QUE RECORDAR
 * ═══════════════════════════════════════════════════════════════════════════
 * `tsc` limpio · `eslint` limpio · **740 pruebas en verde** · los 6 controles de
 * contrato ✅. Ninguno carga una pagina en un navegador.
 *
 * La guarda que SI lo habria cazado —`pantallas_reales.test.ts`— estaba entre
 * las **54 saltadas**, porque pide `ATRIZ_VIVAS=1`. O sea: **«saltada no es
 * pasada»**, escrito ese mismo dia en el CHANGELOG, cometido ese mismo dia.
 *
 * → La proteccion estructural esta en `sin_node_en_cliente.test.ts`, que sigue
 *   los imports de cada modulo `'use client'` y prohibe que alguno llegue a un
 *   `node:*`. Esa prueba no se salta nunca.
 *
 * ⚠️ **REGLA: este fichero no importa NADA.** En cuanto importe algo, deja de
 *    ser seguro para el navegador y vuelve el mismo fallo.
 */

/** Prefijo del subprotocolo que lleva el testigo: `atriz.token.<jwt>`. */
export const PREFIJO_TESTIGO = 'atriz.token.'

/**
 * El subprotocolo que el agente devuelve SIEMPRE, incluso al rechazar.
 *
 * 🔴 Si no devolviera ninguno, el navegador cerraria por su cuenta con **1006 y
 *    sin motivo**, y el alumno veria «se cortó la conexión» en vez de «esa
 *    credencial es de otro robot». Verificado contra el agente real de rvr-01.
 */
export const SUBPROTOCOLO_AGENTE = 'atriz.v1'
