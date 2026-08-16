/**
 * DE DONDE SACA EL TRANSPORTE EL TESTIGO QUE rosbridge EXIGE — Fase B (A7).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ES UN INTERRUPTOR Y NO ALGO QUE SE MANDE SIEMPRE
 * ═══════════════════════════════════════════════════════════════════════════
 * Medido el 2026-08-15 contra el 9090 de rvr-01, **sin parchear**, ofreciendo
 * subprotocolos, y repetido en los dos clientes porque este proyecto tiene
 * escrito que no se transfieren:
 *
 *     cliente        rosbridge SIN parchear, ofreciendo `atriz.token.…`
 *     Node           se CUELGA: ni `onopen` ni `onclose` en 8 s
 *     navegador      cierra con **1006**, rapido y sin motivo
 *
 * O sea: **mandar el testigo a un robot sin parchear lo deja inalcanzable**. Y
 * en el navegador el sintoma es un 1006, que es indistinguible de «el robot
 * esta apagado» — y que `rechazo.ts` clasifica, con razon, como reintentable.
 * Resultado: bucle de reconexion sin una sola explicacion.
 *
 * Eso fija el orden del despliegue, y es el contrario del que parecia natural:
 *
 *     web manda testigo + robot SIN parchear  ->  1006 en bucle, mudo      🔴
 *     web SIN testigo   + robot PARCHEADO     ->  4401 CON motivo          ✅
 *
 * **Primero los robots, despues la web.** Y como la web no puede detectarlo
 * sola —el 1006 no se distingue de un robot apagado—, tiene que ser explicito.
 * Los 16 salen de la misma imagen dorada, asi que el interruptor es uno.
 *
 * ⚠️ CONSECUENCIA CONOCIDA, y no es menor: con el interruptor puesto, un robot
 *    alcanzado **por IP** deja de funcionar. `/api/sesion/testigo` se niega a
 *    firmar para una IP a proposito —el testigo lleva `rob` y una IP no tiene
 *    numero que comparar—, asi que ese camino de escape, que existe para cuando
 *    mDNS falla, se queda sin credencial. Aqui se DICE en vez de conectar en
 *    silencio sin testigo y dejar que el robot conteste un 4401 que parece otra
 *    cosa.
 */

/**
 * ¿Exigen testigo los robots de este despliegue?
 *
 * `NEXT_PUBLIC_` para que llegue al navegador. No es un secreto: es un hecho
 * sobre los robots, y el propio robot lo comprueba de todas formas.
 */
export const TESTIGO_EXIGIDO = process.env.NEXT_PUBLIC_ATRIZ_TESTIGO === '1'

/** Lo que el `Transporte` espera en su opcion `testigo`. */
export type ProveedorTestigo = () => Promise<string | null>

/**
 * @param robot     el numero (1-16), o un host/IP si se entro por el override
 * @param exigido   si no, devuelve `undefined` y el transporte abre como antes
 * @param traer     inyectable para las pruebas
 *
 * @returns `undefined` cuando NO hay que mandar testigo. Es distinto de una
 *          funcion que devuelve `null`: `undefined` significa «este despliegue
 *          no lo usa», y `null` significa «lo usa y hoy no se ha podido».
 */
export function proveedorDeTestigo(
  robot: number | string,
  exigido: boolean = TESTIGO_EXIGIDO,
  traer: typeof fetch = fetch,
): ProveedorTestigo | undefined {
  if (!exigido) return undefined

  const numero = typeof robot === 'number' ? robot : Number(robot)
  if (!Number.isInteger(numero) || numero < 1 || numero > 16) {
    /*
     * Se entro por IP o por un host raro. No hay testigo posible, y decirlo es
     * mejor que abrir sin el: el robot contestaria 4401 «no llego ningun
     * testigo», que suena a fallo de sesion cuando el problema es otro.
     */
    return async () => null
  }

  return async () => {
    const r = await traer(`/api/sesion/testigo?robot=${numero}`, { cache: 'no-store' })
    if (!r.ok) return null
    const cuerpo = await r.json() as { testigo?: string }
    return typeof cuerpo.testigo === 'string' ? cuerpo.testigo : null
  }
}
