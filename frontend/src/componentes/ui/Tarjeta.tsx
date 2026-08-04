/**
 * La caja de siempre. Usa los tokens de `globals.css`: aqui NO se inventa un
 * sistema de diseño nuevo.
 *
 * 📝 Sin `rounded-lg`: `--radio` vale 0 y un instrumento no redondea. La clase
 *    se quita del todo en vez de dejarla apuntando a un token de cero, para que
 *    el marcado diga lo que hace.
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
    <section className="border border-border bg-card text-card-foreground">
      <header className="flex items-start justify-between gap-3 border-b border-border px-3 py-2">
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
      <div className="p-1">{children}</div>
    </section>
  )
}
