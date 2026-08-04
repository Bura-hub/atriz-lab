/**
 * El panel hondo. Va PRIMERO en el orden de construccion a proposito: es la
 * pantalla que hace visible lo que la capa de datos ya sabe, y la que dira si
 * algo no encaja antes de que haya nada bonito encima.
 *
 * El `Transporte` ya lo abrio `robot/[id]/layout.tsx`: aqui no se conecta nada.
 */

import { PanelDiagnostico } from '@/componentes/robot/PanelDiagnostico'

export default function PaginaDiagnostico() {
  return <PanelDiagnostico />
}
