/**
 * «El robot no se mueve y todo parece sano.» La conexion la abrio el layout.
 *
 * Ruta propuesta por el analisis multiagente del documento de plataforma: es la
 * unica pantalla que ataca directamente el modo de fallo mejor documentado del
 * laboratorio, y hasta ahora exigia saberse las trampas de memoria o entrar
 * por SSH.
 */

import { PanelNoObedece } from '@/componentes/robot/PanelNoObedece'

export default function PaginaNoObedece() {
  return <PanelNoObedece />
}
