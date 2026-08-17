/**
 * LAS DEPENDENCIAS DE EJECUCIÓN, Y LA GUARDIA QUE LE FALTABA A `motion`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EXISTE ESTE FICHERO
 * ═══════════════════════════════════════════════════════════════════════════
 * `motion` estuvo instalada meses **con cero imports**: entró el mismo día que
 * se escribió la regla «cero dependencias nuevas» y nunca se usó. La revisión de
 * los 23 commits del rediseño la señaló como **lo único que separaba la rama de
 * `main`**, y por un motivo concreto: las guardias de estilo de este repositorio
 * leen **CSS**, así que una animación infinita escrita en JavaScript —
 * `{ repeat: Infinity }`— pasaría por delante de todas ellas sin que nada
 * chistara.
 *
 * Y este proyecto prohíbe las animaciones infinitas sobre dato, enlace o salud
 * por una razón medida, no estética: una interfaz que se mueve sola sobre un
 * robot mudo **parece viva**, que es el modo de fallo que persigue entero.
 *
 * 👤 Decisión (2026-08-17): **desinstalarla**. Tras el rediseño completo no la
 *    importa nadie, así que no se estaba pagando por nada — y `npm i motion` es
 *    un comando el día que haga falta.
 *
 * 🔴 LO QUE ESTA PRUEBA IMPIDE ES QUE VUELVA A ENTRAR DE PUNTILLAS. No basta con
 *    haberla quitado: lo que hizo daño fue que estuviera **sin que nadie lo
 *    notara**. Si vuelve, esta prueba obliga a mirar la guardia primero.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROHIBICIONES } from './estilo'

const RAIZ = dirname(fileURLToPath(import.meta.url))
const FRONTEND = join(RAIZ, '..', '..', '..')
const PAQUETE = JSON.parse(readFileSync(join(FRONTEND, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** Bibliotecas que pueden animar desde JavaScript, o sea fuera del alcance del CSS. */
const ANIMAN_DESDE_JS = ['motion', 'framer-motion', 'gsap', '@react-spring/web', 'react-spring']

describe('dependencias de ejecucion', () => {
  it('el manifiesto se lee y tiene dependencias: si no, lo de abajo no probaria nada', () => {
    // Control: sin esto, un `package.json` ilegible o vacío haría pasar la prueba
    // siguiente por no encontrar nada — el «cero coincidencias» que este proyecto
    // ya se ha creído dos veces.
    expect(Object.keys(PAQUETE.dependencies ?? {}).length).toBeGreaterThan(0)
    expect(PAQUETE.dependencies).toHaveProperty('next')
  })

  /*
   * 🔴 NO prohíbe la biblioteca: prohíbe tenerla SIN la guardia. Si algún día se
   *    necesita de verdad, el camino está escrito — añadir a `PROHIBICIONES` una
   *    regla que cace `repeat: Infinity` y lo equivalente, y esta prueba deja de
   *    estorbar. Una prohibición sin salida se acaba borrando; una con salida se
   *    respeta.
   */
  it('ninguna biblioteca que anime desde JS entra sin una guardia contra lo infinito', () => {
    const instaladas = ANIMAN_DESDE_JS.filter(
      (n) => PAQUETE.dependencies?.[n] !== undefined || PAQUETE.devDependencies?.[n] !== undefined,
    )
    if (instaladas.length === 0) return

    /*
     * 🔴 SE COMPRUEBA EL COMPORTAMIENTO, NO EL NOMBRE — y este fichero nació con
     *    el error contrario. La primera versión buscaba una prohibición cuyo
     *    NOMBRE contuviera «infinit», y ya existe una: «animation: … infinite».
     *    O sea que daba la guardia por puesta… con una regla que solo mira CSS y
     *    **no cubre JavaScript en absoluto**. Un control que no puede fallar,
     *    escrito en el fichero que existe para impedir justamente eso.
     *
     * → Lo que se pregunta ahora es si ALGUNA prohibición casa la cadena que hay
     *   que cazar. Eso no se puede fingir con un nombre bien elegido.
     */
    const hayGuardia = PROHIBICIONES.some((p) => p.patron.test('repeat: Infinity'))
    expect(
      hayGuardia,
      `«${instaladas.join(', ')}» puede animar desde JavaScript, donde las guardias de CSS de este `
      + 'repositorio no llegan: una animación infinita sobre un dato pasaría sin que nada chiste. '
      + 'Antes de instalarla, añade a PROHIBICIONES una regla que cace `repeat: Infinity`.',
    ).toBe(true)
  })

  it('hoy no hay ninguna instalada, que es como quedo tras el rediseño', () => {
    for (const n of ANIMAN_DESDE_JS) {
      expect(PAQUETE.dependencies ?? {}, `${n} volvio a dependencies`).not.toHaveProperty(n)
      expect(PAQUETE.devDependencies ?? {}, `${n} volvio a devDependencies`).not.toHaveProperty(n)
    }
  })
})
