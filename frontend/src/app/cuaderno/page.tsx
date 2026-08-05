/**
 * El cuaderno de medidas del alumno. **No abre ninguna conexion**: es lo unico
 * de esta aplicacion que funciona con los robots apagados, y a proposito —las
 * medidas se repasan despues de la practica, cuando el laboratorio esta
 * cerrado—.
 */

import { PanelCuaderno } from '@/componentes/cuaderno/PanelCuaderno'

export default function PaginaCuaderno() {
  return <PanelCuaderno />
}
