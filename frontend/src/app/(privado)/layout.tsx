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
import { cookies } from 'next/headers'
import { abrir } from '@/lib/sesion/testigo'
import { COOKIE } from '@/lib/sesion/peticion'
import { secreto } from '@/lib/sesion/almacen'
import { Armazon } from '@/componentes/comun/Armazon'

export default async function LayoutPrivado({ children }: { children: ReactNode }) {
  const s = secreto()
  /*
   * 🔴 SIN SECRETO NO SE DEJA PASAR A NADIE. Es el lado seguro y hay que
   *    escribirlo: sin `ATRIZ_SECRETO` no se puede validar ninguna sesion, y
   *    tratar «no puedo comprobar» como «adelante» convertiria una variable de
   *    entorno olvidada en una aplicacion abierta de par en par.
   */
  const crudo = s === null ? undefined : (await cookies()).get(COOKIE)?.value
  const valido = s !== null && crudo !== undefined && abrir(crudo, s, Date.now()).valido

  if (!valido) {
    // El middleware dejo aqui a donde iba esta peticion, para poder devolver a
    // la persona a su sitio despues de entrar.
    const ruta = (await headers()).get('x-atriz-ruta') ?? '/flota'
    redirect(`/entrar?volver=${encodeURIComponent(ruta)}`)
  }

  return <Armazon>{children}</Armazon>
}
