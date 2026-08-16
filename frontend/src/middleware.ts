/**
 * LA PUERTA. Sin sesion, a `/entrar` — y con el sitio al que ibas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ESTO **NO** VERIFICA LA FIRMA, Y ES LA DECISION CLAVE DE TODA LA FASE
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo natural seria abrir el testigo aqui y comprobarlo. **No se puede, y forzarlo
 * seria peor que no hacerlo.**
 *
 * `testigo.ts` usa `node:crypto` —`createHmac`, `timingSafeEqual`— y el
 * middleware de Next corre en runtime **Edge**, donde eso no existe. Se comprobo
 * en `node_modules/next@15.5.6`: existe `loadNodeMiddleware` en el servidor pero
 * **no hay ninguna opcion `nodeMiddleware` en el esquema de configuracion ni en
 * los `.d.ts`**. Apoyarse en eso seria apoyarse en una bandera experimental no
 * documentada de esta version.
 *
 * La alternativa era reescribir la verificacion con WebCrypto. Se rechaza: serian
 * **DOS implementaciones de la comprobacion de firma** —y `timingSafeEqual` no
 * existe en Edge, asi que habria que reimplementar tambien la comparacion en
 * tiempo constante—. Dos verificadores de firma es exactamente lo que
 * `peticion.ts` existe para evitar, y el segundo siempre es el que se queda
 * viejo.
 *
 * → **Reparto: el middleware hace UX, el layout hace autoridad.**
 *   · Aqui: ¿hay cookie? Si no, redirige **y guarda a donde ibas**.
 *   · En `(privado)/layout.tsx`, que es un componente de SERVIDOR: se abre el
 *     testigo de verdad y se comprueba la firma. Una cookie inventada pasa esta
 *     puerta y **muere en la siguiente**.
 *
 * 🔴 O sea que esto NO es una medida de seguridad: es lo que evita pintar una
 *    pantalla que no va a funcionar. La seguridad la ponen el layout y cada
 *    ruta de API. Escribirlo asi evita que alguien lea este fichero y crea que
 *    la aplicacion esta protegida aqui.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ `/api/*` QUEDA FUERA DEL `matcher`, Y ES DELIBERADO
 * ═══════════════════════════════════════════════════════════════════════════
 * Una API tiene que contestar **401 en JSON**, nunca un 307 a HTML. Un `fetch()`
 * sigue la redireccion sin preguntar, recibe la pagina de entrar, e intenta
 * parsearla como JSON: el fallo llega al navegador como «el servidor devuelve
 * basura», que manda a buscar al sitio equivocado.
 *
 * Cada ruta de `/api/sesion/**` ya comprueba la sesion por su cuenta con
 * `sesionDe`, que es donde tiene que estar.
 */

import { NextRequest, NextResponse } from 'next/server'

/** El mismo nombre que usa `peticion.ts`. Aqui no se puede importar: es Edge. */
const COOKIE = 'atriz_sesion'

/** Lo unico que se sirve sin sesion. */
const PUBLICAS = new Set(['/', '/entrar'])

export function middleware(pet: NextRequest) {
  const { pathname, search } = pet.nextUrl
  if (PUBLICAS.has(pathname)) return NextResponse.next()

  if (pet.cookies.get(COOKIE)?.value !== undefined) {
    /*
     * Hay cookie. **No se sabe si vale** —la firma la comprueba el layout— pero
     * se deja pasar y se le dice a la pagina a donde iba, para que el layout
     * pueda componer el `volver` sin volver a leer la URL.
     */
    const r = NextResponse.next()
    r.headers.set('x-atriz-ruta', pathname + search)
    return r
  }

  /*
   * 🔴 A `/` Y NO A `/entrar` DESDE EL 2026-08-16. La portada y la entrada se
   *    fundieron en una sola pantalla (decision del usuario): eran dos paginas
   *    para una sola cosa. `/entrar` sigue existiendo y redirige aqui, pero
   *    mandar al alias añadiria un salto a cada peticion sin sesion — o sea a
   *    TODAS las de un alumno que abre la aplicacion por la mañana.
   */
  const destino = new URL('/', pet.url)
  destino.searchParams.set('volver', pathname + search)
  /*
   * 307 y no 302: conserva el metodo. Con un 302 un `POST` a una ruta protegida
   * se convertiria en `GET /entrar`, y quien lo mandara veria un exito vacio en
   * vez de un rechazo.
   */
  return NextResponse.redirect(destino, 307)
}

export const config = {
  /*
   * Fuera: `/api` (ver arriba), los estaticos de Next, el favicon y cualquier
   * fichero con extension — una fuente o un `.png` no se redirigen a una pagina
   * de entrar, se sirven o no existen.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
