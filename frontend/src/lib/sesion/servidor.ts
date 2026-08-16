import { cookies } from 'next/headers'
import { COOKIE } from './peticion'
import { secreto } from './almacen'
import { abrir } from './testigo'

/**
 * ¿HAY SESIÓN VÁLIDA EN ESTA PETICIÓN? Solo para componentes de SERVIDOR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EXISTE: LA MISMA PREGUNTA SE HACÍA EN UN SITIO Y HACÍA FALTA EN TRES
 * ═══════════════════════════════════════════════════════════════════════════
 * `(privado)/layout.tsx` la resolvía a mano. Al arreglar el flujo de entrada
 * —2026-08-16— hicieron falta las otras dos: la portada y `/entrar` tienen que
 * saber si ya hay sesión para **no dejar tirada** a una persona que sí la tiene.
 *
 * Copiar esas cinco líneas tres veces es exactamente cómo dos comprobaciones de
 * seguridad acaban discrepando: basta con que alguien arregle una. Y este
 * proyecto tiene el precedente escrito —`nivelBateria` vive en un solo sitio
 * «para que la semántica se decida UNA vez», después de que dos copias pudieran
 * decir «bien» sobre el mismo `NaN`.
 *
 * 🔴 SIN `ATRIZ_SECRETO` DEVUELVE `false`, y es el lado seguro escrito a
 *    propósito: sin secreto no se puede validar nada, y tratar «no puedo
 *    comprobar» como «adelante» convertiría una variable de entorno olvidada en
 *    una aplicación abierta de par en par.
 *
 * ⚠️ Comprueba la FIRMA, no que la cookie exista. El middleware solo mira lo
 *    segundo —corre en Edge y no tiene `node:crypto`—, así que una cookie
 *    inventada lo pasa y muere aquí.
 */
export async function haySesion(): Promise<boolean> {
  const s = secreto()
  if (s === null) return false
  const crudo = (await cookies()).get(COOKIE)?.value
  return crudo !== undefined && abrir(crudo, s, Date.now()).valido
}
