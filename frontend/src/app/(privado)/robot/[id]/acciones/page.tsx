/**
 * LO QUE SALE HACIA EL ROBOT. La conexión la abrió el layout.
 *
 * 🔴 PESTAÑA PROPIA DESDE EL 2026-08-16, por decisión del usuario. Estas tres
 *    piezas vivían al final de Telemetría —la pantalla más larga de la
 *    aplicación— bajo el rótulo «Salidas directas», o sea a un scroll de 25
 *    datos de distancia. Aquí no se lee: **se pulsa, y enciende o mueve algo de
 *    verdad**. En un frontal de banco las salidas van en su propia zona, no
 *    entre los indicadores.
 */

import { PanelAcciones } from '@/componentes/robot/PanelAcciones'

export default function PaginaAcciones() {
  return <PanelAcciones />
}
