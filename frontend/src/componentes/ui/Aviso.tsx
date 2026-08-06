/**
 * Un aviso que el usuario TIENE que ver.
 *
 * 🔴 Existe porque `console.error` es MUDO para quien teleopera: el alumno no
 * mira la consola del navegador, asi que un bucle de mando que se corta en
 * silencio le deja empujando el joystick contra un robot que ya no recibe nada
 * -y el sintoma que percibe es un robot roto. `Teleoperacion.alAviso()` y
 * `Transporte.alAviso()` existen para llegar hasta aqui: hay que pintarlos.
 */

import { ReactNode } from 'react'

export type NivelAviso = 'NOTA' | 'ATENCION' | 'ERROR'

const CLASES: Readonly<Record<NivelAviso, string>> = {
  NOTA: 'border-border bg-muted/40 text-muted-foreground',
  ATENCION: 'border-warning/40 bg-warning/10 text-foreground',
  ERROR: 'border-destructive/40 bg-destructive/10 text-foreground',
}

const MARCA: Readonly<Record<NivelAviso, string>> = {
  NOTA: 'Nota',
  ATENCION: 'Atención',
  ERROR: 'Error',
}

export interface PropsAviso {
  nivel: NivelAviso
  titulo?: string
  children: ReactNode
}

/**
 * 📝 `.aparece` son `--t-aviso` -180 ms- de opacidad y 3 px, UNA vez y nunca
 *    mas. No es decoracion: los avisos llegan de forma asincrona sobre texto que
 *    alguien esta leyendo, y un cambio brusco en mitad de una frase se lee peor
 *    que una aparicion suave. Con `prefers-reduced-motion` cae a 0 ms.
 *
 * ⚠️ Este comentario decia «150 ms» y la variable valia **720**, compartida con
 *    la entrada escalonada del muro. Eran dos usos distintos con una sola
 *    duracion, y el numero escrito aqui era el de ninguno de los dos. Hoy son
 *    `--t-aviso` y `--t-entrada`, separadas y documentadas en `globals.css`.
 */
export function Aviso({ nivel, titulo, children }: PropsAviso) {
  return (
    <div className={`aparece border px-3 py-2 text-sm ${CLASES[nivel]}`} role={nivel === 'ERROR' ? 'alert' : undefined}>
      <span className="font-semibold">{titulo ?? MARCA[nivel]}: </span>
      <span className="max-w-prose">{children}</span>
    </div>
  )
}
