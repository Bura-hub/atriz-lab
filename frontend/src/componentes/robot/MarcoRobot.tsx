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
    // 🔴 El LIDAR va en su PROPIA pestaña, y eso no es organizacion: es coste.
    //    `/scan` es el 83 % del trafico de un robot (~67 kB/s), asi que su
    //    suscripcion tiene que morir al salir. Metido dentro de Telemetria se
    //    pagaria siempre, y con 16 pestañas serian ~8,6 Mbit/s sobre la unica AP.
    { href: `${base}/lidar`, texto: 'LIDAR' },
    { href: `${base}/diagnostico`, texto: 'Diagnóstico' },
  ]
}

function CabeceraRobot({ destino }: { destino: DestinoRobot }) {
  const { conectado } = useRobot()
  const ruta = usePathname()
  const segmento = segmentoRobot(destino)
  const url = urlDeRobot(destinoParaTransporte(destino))

  return (
    /*
      LA MISMA BARRA QUE EL MURO. Un alumno que llega desde el muro tiene que
      reconocer que sigue en el mismo sitio: el campo de color es lo que da esa
      continuidad, y por eso ocupa la cabecera entera y no un filete.

      Las pestañas van DENTRO del campo y montadas sobre el borde inferior, como
      las lengüetas de una carpeta: la activa es del color del suelo y las demás
      se quedan en la chapa.
    */
    <header className="relative z-10 bg-pozo-alto/70 shadow-barra backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
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
            <span className="text-xs text-muted-foreground">
              socket {conectado ? 'abierto' : 'cerrado'}
            </span>
            <Link
              href="/flota"
              className="focus-ring rounded px-1 text-xs text-foreground underline decoration-muted-foreground underline-offset-4 transition-colors hover:decoration-foreground"
            >
              ver los 16
            </Link>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-1" aria-label="Pestañas del robot">
          {pestanas(segmento).map((p) => {
            const activa = ruta === p.href
            return (
              <Link
                key={p.href}
                href={p.href}
                aria-current={activa ? 'page' : undefined}
                className={`focus-ring relative rounded-t-md px-4 py-3 text-sm font-medium transition-colors duration-[var(--t-estado)] ${
                  activa
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.texto}
                {p.bloqueada === true && (
                  <span className="ml-1.5 text-xs opacity-70">(bloqueado)</span>
                )}
                {/*
                  La barra eléctrica de la pestaña activa. Va DENTRO del enlace
                  y no en un elemento flotante: así no hay que medir posiciones
                  ni sincronizar nada, y el subrayado no puede desalinearse.
                */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition-opacity duration-[var(--t-estado)] ${
                    activa ? 'opacity-100' : 'opacity-0'
                  }`}
                />
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
      <div className="relative min-h-screen bg-background text-foreground">
        {/* La misma luz que el muro: continuidad de mundo entre pantallas. */}
        <div className="luz-ambiente" aria-hidden="true" />
        <CabeceraRobot destino={destino} />
        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6">{children}</main>
      </div>
    </ProveedorRobot>
  )
}
