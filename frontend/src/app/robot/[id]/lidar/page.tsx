/**
 * Lo que el robot ve. La conexion la abrio el layout.
 *
 * 🔴 Ruta APARTE a proposito: `/scan` es el 83 % del trafico de un robot, asi
 * que la suscripcion tiene que morir al salir de aqui. Si este panel viviera
 * dentro de telemetria, se pagaria siempre.
 */

import { PanelLidar } from '@/componentes/robot/PanelLidar'

export default function PaginaLidar() {
  return <PanelLidar />
}
