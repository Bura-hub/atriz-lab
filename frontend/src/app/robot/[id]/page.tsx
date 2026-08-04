/**
 * EL TERMINAL DEL ALUMNO — el producto, y la mitad BLOQUEADA de la aplicacion.
 *
 * No es una pantalla «por hacer»: esta bloqueada por una cadena de dependencias
 * que hay que medir en el aula, y decirlo en voz alta —con la cadena entera y en
 * orden— es mas util que un hueco silencioso o una maqueta que promete algo que
 * no existe.
 *
 * El chasis vive en `componentes/robot/PanelTerminal.tsx`, que es un componente
 * de cliente porque el boton de parada —lo unico que SI funciona aqui— necesita
 * el transporte.
 */

import { notFound } from 'next/navigation'
import { interpretarIdRobot, etiquetaRobot } from '@/lib/interfaz/identidad'
import { PanelTerminal } from '@/componentes/robot/PanelTerminal'

export default async function PaginaTerminal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const destino = interpretarIdRobot(id)
  if (destino === null) notFound()

  return <PanelTerminal etiqueta={etiquetaRobot(destino)} />
}
