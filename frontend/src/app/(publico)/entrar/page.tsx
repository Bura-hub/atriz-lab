import { Suspense } from 'react'
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
export default function Entrar() {
  return (
    <Suspense fallback={null}>
      <PanelEntrar />
    </Suspense>
  )
}
