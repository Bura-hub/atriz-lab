/**
 * «El robot no se mueve y todo parece sano.» La conexion la abrio el layout.
 *
 * Ruta propuesta por el analisis multiagente del documento de plataforma: es la
 * unica pantalla que ataca directamente el modo de fallo mejor documentado del
 * laboratorio, y hasta ahora exigia saberse las trampas de memoria o entrar
 * por SSH.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 ABSORBE A `/diagnostico` DESDE EL 2026-08-16
 * ═══════════════════════════════════════════════════════════════════════════
 * Eran dos pestañas para **una sola pregunta**: «algo va mal, ¿qué?». Una
 * miraba el ROBOT —causas, señales de vida— y la otra el ENLACE —socket, ritmos
 * por topic, lo que no se puede decir—.
 *
 * 🔴 Y ese reparto le pedía a la persona justo el diagnóstico que venía a
 *    buscar: para elegir pestaña hay que saber ya si el problema está en el
 *    robot o en el camino, que es **lo que no se sabe**. Con dieciséis robots y
 *    un alumno delante, eso es una moneda al aire.
 *
 * Ahora es una pantalla y dos alturas: primero el veredicto sobre el robot,
 * debajo el estado del camino por el que se ha mirado. El orden importa —lo
 * segundo explica por qué lo primero puede estar equivocado— y por eso van
 * juntas y en ese orden, no en dos sitios.
 *
 * 📝 `PanelDiagnostico` no se reescribe: se monta debajo. Es la pieza que hace
 *    visible lo que la capa de datos ya sabe, y su contenido sigue siendo
 *    correcto; lo que estaba mal era **dónde se llegaba a él**.
 */

import { PanelDiagnostico } from '@/componentes/robot/PanelDiagnostico'
import { PanelNoObedece } from '@/componentes/robot/PanelNoObedece'

export default function PaginaNoObedece() {
  return (
    <>
      <PanelNoObedece />
      <PanelDiagnostico />
    </>
  )
}
