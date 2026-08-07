/**
 * QUIÉN SOY. Lo que la interfaz pregunta al cargar para saber si enseñar lo
 * que solo se ve con sesión.
 *
 * 🔴 Y ES EL SERVIDOR QUIEN CONTESTA, releyendo el testigo firmado. La pantalla
 *    no puede decidirlo sola: la cookie es `httpOnly`, así que el navegador ni
 *    siquiera puede leerla. Eso es lo que impide ponerse una sesión a mano.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sesionDe } from '@/lib/sesion/peticion'

/**
 * 🔴🔴 200 CON `usuario: null`, **NO 401** — y este endpoint es el ÚNICO de los
 *      cuatro donde eso es correcto.
 *
 * Devolvía 401 cuando no había sesión, y el consumidor llevaba escrito al lado
 * «401 es la respuesta normal de quien no ha entrado: no es un error». O sea que
 * el código ya sabía que era el caso normal, y aun así usaba un estado de error
 * HTTP para decirlo. Consecuencia medida el 2026-08-07 abriendo las once rutas
 * con un navegador de verdad: **una línea roja en la consola en CADA carga de
 * CADA página**, para el estado en el que están los 16 alumnos todo el rato —
 * ellos no entran nunca.
 *
 * Es la forma exacta del fallo que este proyecto ya pagó en el robot: el nodo
 * del LIDAR escupía 25 errores por segundo en su estado NORMAL y ahogaba
 * cualquier error de verdad (47 291 líneas de journal, el 99 % ruido). Un error
 * permanente en el sitio donde se buscan los errores no es ruido inocente:
 * **entrena a no mirar**.
 *
 * ⚠️ Y no filtra nada. `sesionDe()` no distingue —a propósito— entre no hay
 *    cookie, está mal formada, la firma no cuadra y caducó; la respuesta es la
 *    misma en los cuatro casos, antes y ahora. Lo único que cambia es el número.
 *
 * 🔴 **Las OTRAS rutas conservan su 401**, y no es incoherencia: `/usuarios` es
 *    una puerta —intentar entrar sin llave SÍ es un fallo de autorización— y
 *    esto es una PREGUNTA. «¿Quién soy?» respondido con «nadie» es una respuesta
 *    correcta, no un fallo.
 */
export function GET(pet: NextRequest) {
  return NextResponse.json({ usuario: sesionDe(pet) })
}
