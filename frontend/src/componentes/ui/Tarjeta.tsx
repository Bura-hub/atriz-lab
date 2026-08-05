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

/*
 * 🔴 LA ELEVACIÓN SE DECLARA UNA VEZ: SOMBRA, NO SOMBRA **Y** BORDE.
 *
 * Esta tarjeta era `border border-border` con radio 0 y sin sombra. Ahora es una
 * ficha de papel sobre el fieltro del tablero: radio de 12 px y una sombra
 * teñida del verde del tablero, con desplazamiento y desenfoque de verdad.
 *
 * `craft-floor`: «Declare elevation once, border or shadow. A 1px border under
 * a wide soft shadow is the ghost card.» Por eso **no lleva borde exterior**.
 * La línea interior que separa la cabecera del cuerpo sí se queda: ahí no es
 * elevación, es compartimentación, que es otra cosa.
 */
export function Tarjeta({ titulo, subtitulo, extremo, children }: PropsTarjeta) {
  return (
    <section className="overflow-hidden rounded-lg bg-card text-card-foreground shadow-ficha">
      <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {titulo}
          </h2>
          {subtitulo !== undefined && (
            <p className="mt-1.5 max-w-prose text-xs leading-snug text-muted-foreground">
              {subtitulo}
            </p>
          )}
        </div>
        {extremo}
      </header>
      <div className="border-t border-border/70">{children}</div>
    </section>
  )
}
