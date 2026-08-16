/** Lo que el robot esta MIDIENDO ahora. La conexion la abrio el layout.
 *
 * 🔴 ERA `/telemetria`. «Telemetria» dice de donde VIENE el dato; esta
 *    aplicacion existe para que un alumno compare lo que dice la pantalla con lo
 *    que dice su cinta metrica, y el rotulo tiene que nombrar eso.
 *
 * ✅ Y desde el 2026-08-16 aqui **solo se mira**: los LEDs y el origen de la
 *    odometria se fueron a `/acciones`. Antes esta pantalla mezclaba
 *    veinticinco lecturas con dos botones que encienden luces de verdad.
 */

import { PanelTelemetria } from '@/componentes/robot/PanelTelemetria'

export default function PaginaMedidas() {
  return <PanelTelemetria />
}
