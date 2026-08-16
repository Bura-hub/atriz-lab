'use client'

/**
 * LA RANURA DE LA PARADA DE EMERGENCIA — y el portal que la llena.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL DEFECTO Nº1 DE LA AUDITORÍA, Y LLEVABA MESES DOCUMENTADO SIN CERRARSE
 * ═══════════════════════════════════════════════════════════════════════════
 * `RailNavegacion` tiene una ranura `parada` desde que existe, con un párrafo
 * explicando por qué hace falta. **Nunca se rellenó.** Y `Armazon` explicaba por
 * qué no se podía:
 *
 *   *«`BotonParada` necesita el `Transporte`, que solo existe POR DEBAJO de este
 *   armazón, dentro de `ProveedorRobot`. Llevarla al raíl exige un portal desde
 *   dentro del proveedor, y eso es un cambio con su propio riesgo sobre un
 *   mecanismo de seguridad que este proyecto ha visto fallar cuatro veces.»*
 *
 * El diagnóstico era correcto entero. La consecuencia, medida: la parada vivía
 * en la franja del marco, **y esa franja hace scroll**. En seis de las siete
 * pestañas, con la página bajada, el botón que para el robot **no está en
 * pantalla** — justo cuando el robot se está moviendo, que es cuando se mira
 * hacia abajo a los datos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUÉ UN PORTAL Y NO SUBIR EL PROVEEDOR
 * ═══════════════════════════════════════════════════════════════════════════
 * La alternativa era montar `ProveedorRobot` por encima del armazón. Se
 * descarta: el proveedor **es la frontera de la conexión** —un WebSocket por
 * robot, y cambiar de robot desmonta la teleoperación vieja antes de abrir la
 * nueva—. Subirlo lo pondría por encima del raíl, o sea por encima de rutas que
 * no son de ningún robot, y habría que inventar qué hace ahí.
 *
 * 🔴 Un portal **no mueve el componente en el árbol de React**: solo cambia
 *    dónde acaba su DOM. `useRobot()`, `useSesion()` y la `Teleoperacion` siguen
 *    llegando por contexto exactamente igual — es literalmente para lo que
 *    existen los portales. La garantía de «UNA sola teleoperación por conexión»
 *    no se toca: sigue siendo la del proveedor, pasada como prop.
 */

import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * El identificador del hueco. Vive aquí y no en cada lado para que no pueda
 * haber dos cadenas que se separen — que es como se pierde un portal en
 * silencio: el `getElementById` devuelve `null` y no pasa nada visible.
 */
export const ID_RANURA_PARADA = 'ranura-parada'

/** El hueco, en el raíl. Existe siempre, aunque no haya robot que lo llene. */
export function RanuraParada() {
  return <div id={ID_RANURA_PARADA} className="shrink-0 empty:hidden" />
}

/**
 * Manda `children` al hueco del raíl.
 *
 * 🔴 DEVUELVE `null` HASTA QUE HAY NODO, y las dos razones cuentan:
 *
 *   · En el servidor no hay `document`. Un `createPortal` en el render del
 *     servidor revienta la página entera — y esta página es la del robot.
 *   · Y el nodo puede no existir todavía en el primer render del cliente. Este
 *     componente vive DENTRO de `MarcoRobot`, que React monta de dentro afuera:
 *     el efecto corre cuando el árbol ya está en el DOM.
 *
 * ⚠️ SI EL HUECO NO EXISTE, ESTO NO PINTA NADA Y NO AVISA. Es la firma de fallo
 *    que este proyecto persigue —algo que falla y parece que funciona— aplicada
 *    a la parada de emergencia, que es lo peor donde puede pasar. Por eso hay
 *    una comprobación en el navegador (`pantallas_reales.test.ts`) que exige que
 *    el botón esté **dentro del `<nav>`** en las seis pestañas: si el portal se
 *    rompe, esa prueba se pone roja en vez de dejar un robot sin freno.
 */
export function EnLaRanuraDeParada({ children }: { children: ReactNode }) {
  const [nodo, setNodo] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setNodo(document.getElementById(ID_RANURA_PARADA))
  }, [])

  return nodo === null ? null : createPortal(children, nodo)
}
