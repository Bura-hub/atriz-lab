/**
 * El muro del profesor. Abre 16 WebSockets -uno por robot- y solo paga los dos
 * topics baratos: 7,7 kB/s en total.
 *
 * 🔴 No hay autenticacion, y no es un olvido: rosbridge 2.7.0 **no la tiene** -no
 * es que este sin configurar, no existe-, y el sitio donde se pone es el agente
 * de sesion, que todavia no esta escrito. Un inicio de sesion en la web que no
 * proteja nada seria exactamente el estado engañoso que este proyecto evita.
 */

import { MuroFlota } from '@/componentes/flota/MuroFlota'

export const metadata = {
  title: 'Flota · Atriz Lab',
}

export default function PaginaFlota() {
  return <MuroFlota />
}
