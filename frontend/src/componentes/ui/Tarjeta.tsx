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
  /**
   * 🔴 EL PIE, Y EXISTE POR UN DEFECTO QUE SE VIO EN UNA CAPTURA.
   *
   * `children` va **a sangre, sin relleno**, y eso es deliberado: dentro suele
   * ir una `.rejilla` que tiene que llegar de canto a canto para que sus lineas
   * de 1 px sean el borde de la tarjeta. Pero varios paneles cerraban con un
   * parrafo de explicacion como hijo directo, y ese parrafo heredaba el «sin
   * relleno»: **el texto quedaba pegado al canto izquierdo de la ficha**, tres
   * pixeles por fuera de la columna donde vive el titulo.
   *
   * Se veia en telemetria, diagnostico y lidar a la vez, y no lo delata ninguna
   * prueba: el HTML es correcto y el texto se lee. Solo se ve mirando.
   *
   * → La prosa de cierre va aqui. El cuerpo se queda a sangre, que es lo que la
   *   rejilla necesita, y las dos cosas dejan de pelearse por el mismo hueco.
   *
   * ⚠️ **SI AÑADES UN PANEL, ACUERDATE DE ESTO.** El cuerpo a sangre es la causa
   *    recurrente: el mismo defecto aparecio en `PanelEnlace`, en la lista de
   *    huecos del diagnostico, en la tabla de llegadas y en las dos filas del
   *    barrido de `PanelConducir` — cinco sitios, todos encontrados MIRANDO
   *    capturas, ninguno por una prueba. Lo que no sea `.rejilla` pone su propio
   *    `px-5`, o usa `pie`.
   */
  pie?: ReactNode
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
export function Tarjeta({ titulo, subtitulo, extremo, pie, children }: PropsTarjeta) {
  return (
    <section className="vidrio overflow-hidden rounded-ficha text-card-foreground">
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
      {/*
        🔴 EL CUERPO VA A SANGRE, PERO LA PROSA SUELTA NO.

        `children` no lleva relleno a proposito: dentro suele ir una `.rejilla`
        que tiene que llegar de canto a canto para que sus lineas de 1 px SEAN
        el borde de la tarjeta. Pero varios paneles cierran con un parrafo
        condicional -«todavia no ha llegado ningun /odom»- colgando directamente
        de la tarjeta, y ese parrafo heredaba el «sin relleno»: **el texto
        quedaba pegado al canto izquierdo**, unos pixeles por fuera de la
        columna donde vive el titulo. Se veia a la vez en telemetria,
        diagnostico, lidar y LEDs.

        El relleno se le da SOLO a los elementos de prosa de primer nivel -`p`,
        `ul`, `ol`-, que es un conjunto que nunca puede querer ir a sangre. Las
        rejillas y las mallas de datos no se tocan, asi que no hay forma de que
        este arreglo rompa una.
      */}
      <div className="border-t border-[rgb(var(--filo)/0.09)] [&>ol]:px-5 [&>p]:px-5 [&>ul]:px-5 [&>ol:last-child]:pb-4 [&>p:last-child]:pb-4 [&>ul:last-child]:pb-4">
        {children}
      </div>
      {pie !== undefined && (
        /*
          Mismo relleno lateral que la cabecera (`px-5`), para que el texto de
          cierre caiga en la MISMA columna que el titulo. Y separado por su
          propia linea: aqui no es elevacion, es compartimentacion.
        */
        <div className="border-t border-[rgb(var(--filo)/0.09)] px-5 pb-4 pt-3.5 text-xs leading-relaxed text-muted-foreground [&_p+p]:mt-2 [&_p]:max-w-prose">
          {pie}
        </div>
      )}
    </section>
  )
}
