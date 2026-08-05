'use client'

/**
 * EL ARMAZÓN — lo único que envuelve a todas las pantallas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUÉ RESUELVE
 * ═══════════════════════════════════════════════════════════════════════════
 * Hasta ahora **no había navegación global**. Cada zona montaba su propia
 * carcasa y los enlaces entre ellas eran cinco en toda la aplicación, con tres
 * agujeros reales que el inventario destapó:
 *
 *   · `/cuaderno` no tenía **ni un enlace de salida**: solo se salía con el
 *     botón «atrás» del navegador.
 *   · **la portada no era alcanzable** desde ninguna otra pantalla.
 *   · desde el muro no se llegaba al cuaderno, ni al revés.
 *
 * El raíl los cierra los tres. Este armazón es quien lo pone en todas partes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EL RAÍL VA FIJO Y NO EN UNA FILA FLEXIBLE
 * ═══════════════════════════════════════════════════════════════════════════
 * Las tres zonas traen **su propia carcasa**: `MuroFlota`, `PanelCuaderno` y
 * `MarcoRobot` montan cada una su `min-h-screen`, su `luz-ambiente` y su propio
 * ancho máximo —7xl, 5xl y 6xl—. Meterlas en una fila flexible obligaba a
 * desmontar las tres a la vez, y una de ellas (`MuroFlota`) cuelga de su div
 * raíz el modo proyección.
 *
 * Con el raíl **fijo** y el contenido desplazado por `padding`, las tres siguen
 * intactas: el cambio es aditivo y reversible. **Unificar los cuatro anchos
 * sigue pendiente**, y se dice aquí en vez de hacerlo de tapadillo dentro de
 * otro cambio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ LA PARADA DE EMERGENCIA NO ESTÁ EN EL RAÍL, Y ESO ES UN HUECO CONOCIDO
 * ═══════════════════════════════════════════════════════════════════════════
 * `RailNavegacion` tiene una ranura `parada` para ella, y el documento de
 * diseño (§4) pide que el marco dé la parada **en las seis pestañas**. Hoy vive
 * solo en Conducir y en el Terminal, porque `BotonParada` necesita el
 * `Transporte`, que solo existe **por debajo** de este armazón, dentro de
 * `ProveedorRobot`.
 *
 * Llevarla al raíl exige un portal desde dentro del proveedor, y eso es un
 * cambio con su propio riesgo sobre un mecanismo de seguridad que este proyecto
 * ha visto fallar cuatro veces. **No se hace de paso**: va aparte, con su
 * medición.
 */

import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { RailNavegacion, pestanasDeRobot } from './RailNavegacion'

/**
 * Saca el segmento del robot de la ruta, o `null` si no estamos en uno.
 *
 * Se lee de la ruta y no de `params` porque este componente vive en el layout
 * raíz, por encima de `/robot/[id]`: allí `params` no existe todavía.
 */
export function segmentoDeRuta(ruta: string | null): string | null {
  if (ruta === null) return null
  const m = /^\/robot\/([^/]+)/.exec(ruta)
  return m === null ? null : m[1]
}

export function Armazon({ children }: { children: ReactNode }) {
  const ruta = usePathname()
  const segmento = segmentoDeRuta(ruta)

  return (
    <div className="lg:pl-[272px]">
      {/*
        Fijo en escritorio; por debajo de `lg` vuelve al flujo como tira
        horizontal arriba —el propio raíl lo resuelve—, y entonces el relleno
        de la izquierda no aplica.
      */}
      <div className="lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-[272px]">
        <RailNavegacion
          pestanas={segmento === null ? [] : pestanasDeRobot(segmento)}
        />
      </div>
      {children}
    </div>
  )
}
