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

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { ProveedorRobot, useRobot } from '@/hooks/ContextoRobot'
import { urlDeRobot } from '@/lib/rosbridge/transporte'
import { DestinoRobot, destinoParaTransporte, etiquetaRobot, segmentoRobot } from '@/lib/interfaz/identidad'
import { InsigniaEnlace } from './EstadoEnlace'

interface Pestana {
  href: string
  texto: string
  bloqueada?: boolean
}

function pestanas(segmento: string): Pestana[] {
  const base = `/robot/${segmento}`
  return [
    { href: base, texto: 'Terminal', bloqueada: true },
    { href: `${base}/telemetria`, texto: 'Telemetría' },
    { href: `${base}/conducir`, texto: 'Conducir' },
    { href: `${base}/diagnostico`, texto: 'Diagnóstico' },
  ]
}

function CabeceraRobot({ destino }: { destino: DestinoRobot }) {
  const { conectado } = useRobot()
  const ruta = usePathname()
  const segmento = segmentoRobot(destino)
  const url = urlDeRobot(destinoParaTransporte(destino))

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold">{etiquetaRobot(destino)}</h1>
            {/* La URL, siempre visible: es lo que distingue «me equivoqué de
                robot» de «este robot no responde». */}
            <code className="text-xs text-muted-foreground">{url}</code>
          </div>
          <div className="flex items-center gap-3">
            <InsigniaEnlace />
            <span className="text-xs text-muted-foreground">
              socket {conectado ? 'abierto' : 'cerrado'}
            </span>
            <Link href="/flota" className="text-xs text-primary underline focus-ring">
              ver los 16
            </Link>
          </div>
        </div>

        <nav className="mt-3 flex flex-wrap gap-1" aria-label="Pestañas del robot">
          {pestanas(segmento).map((p) => {
            const activa = ruta === p.href
            return (
              <Link
                key={p.href}
                href={p.href}
                aria-current={activa ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm focus-ring ${
                  activa
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p.texto}
                {p.bloqueada === true && <span className="ml-1.5 text-xs opacity-70">(bloqueado)</span>}
              </Link>
            )
          })}
        </nav>
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
      <div className="min-h-screen bg-background text-foreground">
        <CabeceraRobot destino={destino} />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-5">{children}</main>
      </div>
    </ProveedorRobot>
  )
}
