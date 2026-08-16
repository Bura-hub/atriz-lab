/**
 * Las cuentas del laboratorio: crear y ver quién hay. **Nunca el hash.**
 *
 * ⚠️ Sin sesión no se pinta la lista, y no es un adorno de cliente: el endpoint
 *    devuelve 401 sin cookie, así que un navegador que se salte la pantalla no
 *    obtiene nada. Lo de aquí es cortesía —decir por qué está vacío—, no la
 *    cerradura.
 */

import { PanelUsuarios } from '@/componentes/sesion/PanelUsuarios'

export const metadata = { title: 'Usuarios · Plataforma Atriz' }

export default function PaginaUsuarios() {
  return <PanelUsuarios />
}
