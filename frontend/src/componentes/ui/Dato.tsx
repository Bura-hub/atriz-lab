/**
 * Un valor con su etiqueta, y -si hace falta- su ANTIGUEDAD al lado.
 *
 * 🔴 LA REGLA QUE ESTE COMPONENTE HACE CUMPLIR: **una temperatura sin su
 * antiguedad no se pinta**. El sondeo termico del driver va cada 30 s, asi que
 * una temperatura que no cambia puede ser el MISMO dato repetido en vez de una
 * temperatura estable. Por eso `antiguedad` es una prop y no un adorno opcional
 * que se olvida.
 *
 * 🔴 Y cuando el valor es «no se sabe», se pinta ATENUADO y en cursiva: tiene
 * que distinguirse de un cero a un metro de distancia.
 */

import { ReactNode } from 'react'
import { SIN_DATO } from '@/lib/interfaz/formato'

export interface PropsDato {
  etiqueta: string
  /** Ya formateado. Si vale `SIN_DATO` se pinta atenuado. */
  valor: string
  /** «hace 12,4 s» o «no se sabe». Se pinta pegado al valor, nunca lejos. */
  antiguedad?: string
  /** El valor MEDIDO en el robot con el que comparar, si lo hay. */
  referencia?: string
  /** Una nota corta. Para lo que el numero no dice por si mismo. */
  nota?: ReactNode
  /** Numeros grandes para mirar de lejos (el muro del profesor). */
  grande?: boolean
}

export function Dato({ etiqueta, valor, antiguedad, referencia, nota, grande }: PropsDato) {
  const desconocido = valor === SIN_DATO
  return (
    <div className="py-1.5">
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={[
            'font-mono tabular-nums',
            grande === true ? 'text-2xl font-semibold' : 'text-base',
            desconocido ? 'italic text-muted-foreground font-normal' : 'text-foreground',
          ].join(' ')}
        >
          {valor}
        </span>
        {antiguedad !== undefined && (
          <span className="text-xs text-muted-foreground">· dato de {antiguedad}</span>
        )}
        {referencia !== undefined && (
          <span className="text-xs text-muted-foreground">· medido en el robot: {referencia}</span>
        )}
      </div>
      {nota !== undefined && <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{nota}</p>}
    </div>
  )
}
