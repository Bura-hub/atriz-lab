'use client'

/**
 * UN CUADRO DEL COLOR ELEGIDO, PINTADO EN UN LIENZO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE UN LIENZO Y NO `style={{ background }}`
 * ═══════════════════════════════════════════════════════════════════════════
 * `PanelLeds` lo lleva documentado desde que se vio en el navegador, no supuesto:
 * el modo oscuro forzado —Edge lo trae de serie— **reescribe los atributos
 * `style` antes de que React hidrate**, y eso produce un aviso de hidratacion
 * («some attributes of the server rendered HTML didn't match») sobre un
 * componente sano. El diff de React señalaba `--darkreader-inline-bgcolor`.
 *
 * Con los cinco colores fijos eso se resolvia con una CLASE de Tailwind. Con un
 * color libre no hay clase posible —Tailwind compila lo que ve en el fuente, y
 * `#a3f01c` no aparece en ningun fuente—, asi que se pinta.
 *
 * 📝 1×1 estirado por CSS: el color es plano, no hay nada mas que pintar, y asi
 *    no depende de la densidad de la pantalla ni hay que redibujar al ampliar.
 *
 * ⚠️ LO QUE ESTO NO ARREGLA: una extension de tema puede invertir imagenes, y un
 *    lienzo lo es. Si alguien fuerza el modo oscuro, el cuadro puede salir
 *    cambiado — pero eso ya no es un aviso de hidratacion, es el navegador
 *    haciendo lo que le han pedido, y le pasa igual a cualquier solucion.
 *
 * 🔴 Y LLEVA `role="img"` CON SU TEXTO: un lienzo no dice absolutamente nada a un
 *    lector de pantalla. Sin la etiqueta, el color elegido seria invisible para
 *    quien no lo ve — que es justo la persona que mas necesita que se lo digan.
 */

import { useEffect, useRef } from 'react'
import { aHex, nombreAproximado, type RGB } from '@/lib/robot/color_led'

export interface MuestraDeColorProps {
  color: RGB
  /** Tamaño y forma. El borde lo pone quien la usa, no todas lo quieren igual. */
  className?: string
  /**
   * Que se dice de este cuadro.
   *
   * ⚠️ El texto por defecto dice «el color que has ELEGIDO», nunca «el color del
   *    robot»: esta pantalla no puede saber si el LED se encendio. Quien pase
   *    otro texto tiene la misma obligacion.
   */
  etiqueta?: string
}

export function MuestraDeColor({ color, className = '', etiqueta }: MuestraDeColorProps) {
  const lienzo = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = lienzo.current?.getContext('2d')
    if (ctx === undefined || ctx === null) return
    ctx.fillStyle = `rgb(${color.rojo} ${color.verde} ${color.azul})`
    ctx.fillRect(0, 0, 1, 1)
  }, [color])

  return (
    <canvas
      ref={lienzo}
      width={1}
      height={1}
      role="img"
      aria-label={etiqueta ?? `El color que has elegido: ${nombreAproximado(color)}, ${aHex(color)}`}
      className={className}
    />
  )
}
