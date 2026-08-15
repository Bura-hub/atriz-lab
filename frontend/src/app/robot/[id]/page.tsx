/**
 * EL TERMINAL DEL ALUMNO — el producto.
 *
 * Fue la mitad BLOQUEADA de la aplicacion desde el 2026-08-04 hasta el
 * 2026-08-14: no una pantalla «por hacer», sino una bloqueada por una cadena de
 * tres eslabones que se dibujaba entera y en orden, porque decirlo en voz alta
 * es mas util que un hueco silencioso o una maqueta que promete lo que no hay.
 *
 * Los tres estan: el punto de acceso del aula quedo descartado como riesgo, el
 * agente de sesion esta escrito, y esta pantalla lo usa.
 *
 * ⏳ **Lo que falta ya no es un eslabon, es una medida**: el PTY del agente no ha
 *    tocado un robot. Y eso NO se dice aqui, se dice EN LA PANTALLA — que es
 *    donde lo lee quien va a pulsar Ejecutar.
 *
 * Vive en `componentes/robot/PanelTerminal.tsx`, que es un componente de cliente
 * porque necesita dos sockets: el del robot y el del agente.
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
