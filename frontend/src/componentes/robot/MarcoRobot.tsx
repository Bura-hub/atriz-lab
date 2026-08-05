'use client'

/**
 * El marco del espacio de trabajo de UN robot: abre su conexion y la mantiene
 * mientras se navega entre sus pestañas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE ESTO ES UN COMPONENTE DE CLIENTE Y EL `layout.tsx` NO
 * ═══════════════════════════════════════════════════════════════════════════
 * Los `layout.tsx` del App Router son **componentes de servidor por defecto**, y
 * un WebSocket solo puede vivir en el cliente. `ProveedorRobot` usa `useMemo`,
 * `useEffect` y `useState`; sin el `'use client'` de arriba, Next falla en
 * ejecucion con un error que **no menciona WebSockets** y manda a buscar donde no
 * es.
 *
 * → El `layout.tsx` se queda con lo que si es de servidor: leer `params`,
 *   interpretarlo y responder 404 si no nombra ningun robot. Lo que cruza la
 *   frontera es un objeto plano (`DestinoRobot`), que se serializa sin problema.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y POR QUE EL PROVEEDOR VA AQUI Y NO MAS ARRIBA
 * ═══════════════════════════════════════════════════════════════════════════
 * `robot/[id]/layout.tsx` es la frontera exacta del ciclo de vida de la
 * conexion: navegar entre `/telemetria`, `/conducir` y `/diagnostico` **no**
 * desmonta el layout, asi que el WebSocket no se corta al cambiar de pestaña;
 * navegar a otro robot **si** lo desmonta, porque cambia el segmento `[id]`, y
 * la limpieza de `useTransporte` cierra el socket viejo antes de abrir el nuevo.
 *
 * Con `/robot?id=` no habria pasado nada de eso: cambiar de robot no desmontaria
 * nada y la conexion vieja se quedaria viva -que es justo el fallo que la capa de
 * datos ya pago dos veces.
 */

import { ReactNode } from 'react'
import { ProveedorRobot, useRobot } from '@/hooks/ContextoRobot'
import { urlDeRobot } from '@/lib/rosbridge/transporte'
import { DestinoRobot, destinoParaTransporte, etiquetaRobot } from '@/lib/interfaz/identidad'
import { InsigniaEnlace } from './EstadoEnlace'

/*
 * 🔴 LAS PESTAÑAS YA NO VIVEN AQUI. Se fueron al raíl
 * (`componentes/comun/RailNavegacion.tsx`), que es la unica navegacion de la
 * aplicacion. Antes habia DOS: esta barra para las seis pestañas del robot, y
 * nada para movese entre el muro, el cuaderno y la portada — de ahi que el
 * cuaderno no tuviera ni un enlace de salida.
 *
 * ⚠️ Y con ellas se fue una decision razonada que hay que volver a tomar: esta
 *    barra ponia «Por que no obedece» ENTRE conducir y diagnostico a proposito
 *    —«es donde alguien la busca, justo despues de intentar mover el robot»— y
 *    el rail la pone la tercera. El documento de diseño (§4) las lista en un
 *    TERCER orden. Los tres se contradicen y el conflicto sigue abierto.
 *
 * Lo que se queda aqui es lo que el rail NO tiene y esta pantalla si necesita:
 * el nombre del robot, su URL, y si el socket esta abierto.
 */

function CabeceraRobot({ destino }: { destino: DestinoRobot }) {
  const { conectado } = useRobot()
  const url = urlDeRobot(destinoParaTransporte(destino))

  return (
    /*
      LA MISMA BARRA QUE EL MURO. Un alumno que llega desde el muro tiene que
      reconocer que sigue en el mismo sitio: el campo de color es lo que da esa
      continuidad, y por eso ocupa la cabecera entera y no un filete.

      Al irse las pestañas al raíl, el campo se queda con una sola fila: el
      relleno inferior pasa de cero —lo daban las lengüetas— a `pb-5`, para que
      la barra no quede pegada al contenido.
    */
    <header className="relative z-10 bg-pozo-alto/70 shadow-barra backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {etiquetaRobot(destino)}
            </h1>
            {/* La URL, siempre visible: es lo que distingue «me equivoqué de
                robot» de «este robot no responde». */}
            <code className="font-mono text-xs text-muted-foreground">{url}</code>
          </div>
          <div className="flex items-center gap-3">
            <InsigniaEnlace sobreBarra />
            {/*
              «socket abierto/cerrado» y no «robot conectado»: lo que el
              navegador sabe es el estado de SU WebSocket. Un socket abierto
              contra un robot mudo sigue diciendo «abierto», y eso es exacto.
            */}
            <span className="text-xs text-muted-foreground">
              socket {conectado ? 'abierto' : 'cerrado'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export interface PropsMarcoRobot {
  destino: DestinoRobot
  children: ReactNode
}

export function MarcoRobot({ destino, children }: PropsMarcoRobot) {
  return (
    <ProveedorRobot robot={destinoParaTransporte(destino)}>
      <div className="relative min-h-screen bg-background text-foreground">
        {/* La misma luz que el muro: continuidad de mundo entre pantallas. */}
        <div className="luz-ambiente" aria-hidden="true" />
        <CabeceraRobot destino={destino} />
        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6">{children}</main>
      </div>
    </ProveedorRobot>
  )
}
