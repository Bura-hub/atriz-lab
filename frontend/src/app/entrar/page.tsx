import { PanelEntrar } from '@/componentes/sesion/PanelEntrar'

export const metadata = { title: 'Entrar · Plataforma Atriz' }

/**
 * LA PANTALLA DE ENTRAR.
 *
 * ⚠️ Y CONSERVA EL RAÍL, al contrario que casi cualquier pantalla de acceso.
 *    No es un descuido: aquí **la sesión no cierra nada**. Las nueve pantallas
 *    siguen abiertas sin entrar, así que quien llega no está atrapado — puede
 *    irse al muro o al cuaderno y seguir trabajando. Quitar el raíl daría a
 *    entender que hay que pasar por aquí, que es justo lo que no ocurre.
 */
export default function Entrar() {
  return <PanelEntrar />
}
