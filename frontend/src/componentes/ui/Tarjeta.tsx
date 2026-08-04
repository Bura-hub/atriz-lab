/**
 * La caja de siempre. Usa los tokens de `globals.css` (582 lineas de claro y
 * oscuro que ya existen): aqui NO se inventa un sistema de diseño nuevo.
 */

import { ReactNode } from 'react'

export interface PropsTarjeta {
  titulo: string
  /** Una linea corta bajo el titulo. Para el «por que», no para adornar. */
  subtitulo?: string
  /** Se pinta arriba a la derecha: una insignia de estado, un boton pequeño. */
  extremo?: ReactNode
  children: ReactNode
}

export function Tarjeta({ titulo, subtitulo, extremo, children }: PropsTarjeta) {
  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </h2>
          {subtitulo !== undefined && (
            <p className="text-xs text-muted-foreground mt-1 max-w-prose">{subtitulo}</p>
          )}
        </div>
        {extremo}
      </header>
      {children}
    </section>
  )
}
