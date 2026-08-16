import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { destinoSeguro } from '@/lib/sesion/regreso'
import { haySesion } from '@/lib/sesion/servidor'
import { PanelEntrar } from '@/componentes/sesion/PanelEntrar'

export const metadata = { title: 'Entrar · Plataforma Atriz' }

/**
 * LA PANTALLA DE ENTRAR.
 *
 * 🔴 AQUÍ PONÍA que **conserva el raíl** porque *«la sesión no cierra nada: las
 *    diez pantallas siguen abiertas sin entrar, así que quien llega no está
 *    atrapado»*. **Ya no es cierto, y era el argumento entero.** Desde hoy todo
 *    menos la portada vive detrás de la puerta, así que quien llega aquí SÍ
 *    tiene que pasar por aquí — y un raíl con diez destinos que redirigen a esta
 *    misma pantalla sería una promesa falsa repetida diez veces.
 *
 *    Por eso esta pantalla vive en `(publico)`, que no monta `Armazon`.
 *
 * ⚠️ SUSPENSE ALREDEDOR, y no es ceremonia: `PanelEntrar` lee `?volver=` con
 *    `useSearchParams`, y en Next 15 eso obliga a renderizar en cliente. Sin el
 *    límite, **toda la rama se sale del prerenderizado** y `next build` lo dice
 *    con un error que no menciona este fichero.
 */
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 CON SESIÓN, AQUÍ NO SE ENTRA: SE VUELVE A DONDE IBAS
   * ═══════════════════════════════════════════════════════════════════════════
   * 👤 Reportado por el usuario el 2026-08-16: *«si le doy entrar me deja en una
   *    pestaña /entrar y no sigue al resto»*. Exacto. `PanelEntrar` pintaba un
   *    aviso —«Ya has entrado como X»— y **ahí se acababa**: ni un enlace, ni
   *    una redirección. Un final de camino con aspecto de página.
   *
   * Y no era un olvido de copy: la pantalla no puede resolverlo sola. Cuando ese
   * aviso se escribió, `useSesion` solo traía el nombre y no había a dónde
   * mandar a nadie; el `?volver=` lo lee el cliente **después** de hidratar.
   * Aquí, en el servidor, se sabe antes de pintar un byte.
   *
   * → El destino pasa por `destinoSeguro`, igual que tras iniciar sesión. Un
   *   `?volver=` sin validar es una redirección abierta, y este es el sitio
   *   exacto donde se explota: la persona ve el dominio de su laboratorio y
   *   acaba en otro ya autenticada.
   *
   * ⚠️ Y esto hace que `/entrar` sea INALCANZABLE con sesión abierta, que es
   *    justo lo que se pidió —*«si ya se tiene cuenta y no se cierra nunca, que
   *    te devuelva al resumen»*—. Para cambiar de cuenta hay que **salir**
   *    primero, y por eso el raíl tiene ese botón bien visible.
   */
  if (await haySesion()) redirect(destinoSeguro(unaCadena((await searchParams).volver)))

  return (
    <Suspense fallback={null}>
      <PanelEntrar />
    </Suspense>
  )
}

/**
 * Un parámetro de consulta puede llegar repetido (`?volver=a&volver=b`), y
 * entonces Next entrega un array. Se queda con el primero.
 *
 * 🔴 NO se junta el array: `destinoSeguro` valida UNA ruta, y darle «/a,/b»
 *    sería inventar un destino que nadie pidió. Y devolver `undefined` ante lo
 *    inesperado deja que el destino por defecto haga su trabajo.
 */
function unaCadena(v: string | string[] | undefined): string | null {
  if (typeof v === 'string') return v
  return Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null
}
