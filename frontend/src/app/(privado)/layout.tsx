/**
 * LO QUE HAY DETRAS DE LA PUERTA. Componente de SERVIDOR, y eso es lo que vale.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 AQUI SE COMPRUEBA LA FIRMA. EL MIDDLEWARE SOLO MIRA QUE HAYA COOKIE
 * ═══════════════════════════════════════════════════════════════════════════
 * El middleware corre en Edge y no puede usar `node:crypto` (ver `middleware.ts`
 * para el porque entero). Asi que reparte: el middleware evita pintar una
 * pantalla que no va a funcionar, y **la autoridad esta aqui**. Una cookie
 * inventada pasa el middleware y muere en esta linea.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y AL SER DE SERVIDOR, EL HTML PRIVADO NO SE ENVIA NUNCA SIN SESION
 * ═══════════════════════════════════════════════════════════════════════════
 * Es una mejora real sobre lo de antes, y conviene decirla: hasta hoy
 * `sesionDe` solo protegia las rutas de API. **El HTML de las diez pantallas se
 * mandaba siempre**, y lo unico que faltaba eran los datos. Cualquiera en la red
 * podia leer la estructura entera de la aplicacion, sus textos y sus rutas.
 *
 * Ahora el servidor decide antes de renderizar, asi que sin sesion **no sale ni
 * un byte** de una pantalla privada.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { haySesion } from '@/lib/sesion/servidor'
import { Armazon } from '@/componentes/comun/Armazon'

export default async function LayoutPrivado({ children }: { children: ReactNode }) {
  /*
   * 📝 Esto eran cinco líneas a mano hasta el 2026-08-16. Se extrajeron a
   *    `haySesion()` al hacer falta la misma pregunta en la portada y en
   *    `/entrar`: tres copias de una comprobación de seguridad es cómo dos de
   *    ellas acaban discrepando. El razonamiento entero —incluido por qué sin
   *    `ATRIZ_SECRETO` no pasa nadie— vive ahora ahí.
   */
  if (!await haySesion()) {
    // El middleware dejo aqui a donde iba esta peticion, para poder devolver a
    // la persona a su sitio despues de entrar.
    const ruta = (await headers()).get('x-atriz-ruta') ?? '/flota'
    redirect(`/?volver=${encodeURIComponent(ruta)}`)
  }

  return <Armazon>{children}</Armazon>
}
