/**
 * El muro del administrador. Abre 16 WebSockets -uno por robot- y solo paga los dos
 * topics baratos: 7,7 kB/s en total.
 *
 * 🔴 EL MURO NO PIDE SESION, Y NO PODRIA AUNQUE QUISIERA. Desde el 2026-08-06 hay
 * inicio de sesion en la aplicacion, pero lo que protege es **la interfaz**: el
 * navegador abre estos 16 WebSockets contra el rosbridge de cada robot, y ese
 * camino **no pasa por el servidor de Next**. rosbridge 2.7.0 no tiene
 * autenticacion —no es que este sin configurar, no existe—, asi que cualquiera en
 * la red puede abrir los mismos 16 sockets sin cuenta ninguna.
 *
 * Donde si sirve la sesion es en lo que este proceso decide por si mismo: liberar
 * una parada de emergencia. Cerrar el resto es el agente de sesion (Fase B), que
 * todavia no esta escrito.
 */

import { MuroFlota } from '@/componentes/flota/MuroFlota'

export const metadata = {
  title: 'Flota · Atriz Lab',
}

export default function PaginaFlota() {
  return <MuroFlota />
}
