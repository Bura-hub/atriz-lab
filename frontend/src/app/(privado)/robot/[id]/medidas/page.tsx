/** Lo que el robot esta MIDIENDO ahora. La conexion la abrio el layout.
 *
 * 🔴 ERA `/telemetria`. «Telemetria» dice de donde VIENE el dato; esta
 *    aplicacion existe para que un alumno compare lo que dice la pantalla con lo
 *    que dice su cinta metrica, y el rotulo tiene que nombrar eso.
 *
 * ✅ Desde el 2026-08-16 los LEDs y el origen de la odometria se fueron a
 *    `/acciones`. Antes esta pantalla mezclaba veinticinco lecturas con dos
 *    botones que encienden luces de verdad.
 *
 * 🔴 AQUI PONIA «aqui solo se mira», Y ES FALSO. El selector de modo del sensor
 *    de color llama a `/enable_color`, que **enciende un LED blanco fisico bajo
 *    el chasis** — y es justamente el que se midio 14 min 38 s encendido sin
 *    nadie leyendo. Se queda aqui a proposito, porque en esta pantalla el modo
 *    manda («¿que hay debajo del robot?») y la luz es su consecuencia; lo que no
 *    puede quedarse es la frase que dice que no pasa.
 */

import { PanelTelemetria } from '@/componentes/robot/PanelTelemetria'

export default function PaginaMedidas() {
  return <PanelTelemetria />
}
