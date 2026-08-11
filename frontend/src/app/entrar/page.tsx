import { PanelEntrar } from '@/componentes/sesion/PanelEntrar'

export const metadata = { title: 'Entrar · Plataforma Atriz' }

/**
 * LA PANTALLA DE ENTRAR.
 *
 * ⚠️ Y CONSERVA EL RAÍL, al contrario que casi cualquier pantalla de acceso.
 *    No es un descuido: aquí **la sesión no cierra nada**. Las **diez pantallas
 *    del laboratorio** siguen abiertas sin entrar, así que quien llega no está
 *    atrapado — puede irse al muro o al cuaderno y seguir trabajando. Quitar el
 *    raíl daría a entender que hay que pasar por aquí, que es justo lo que no
 *    ocurre.
 *
 * 📝 Decía «las nueve pantallas» y eran diez: la cuenta se quedó atrás al añadir
 *    una ruta. Son **12 en total** — esas diez más `/entrar` y `/usuarios`, que
 *    son las dos que no hablan con ningún robot.
 */
export default function Entrar() {
  return <PanelEntrar />
}
