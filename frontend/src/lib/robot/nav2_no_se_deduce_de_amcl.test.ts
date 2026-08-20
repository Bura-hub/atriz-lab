/**
 * `/amcl_pose` NO PUEDE SER LA PRUEBA DE QUE Nav2 ESTA LEVANTADO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LA PANTALLA ACUSABA A UN Nav2 SANO, Y EL CASO ERA EL MAS NORMAL QUE HAY
 * ═══════════════════════════════════════════════════════════════════════════
 * `PanelNavegar` tenia `const puedeNavegar = hayPose`, o sea que deducia «hay a
 * quien mandar un objetivo» de que llegara `/amcl_pose`. El razonamiento sonaba
 * bien —AMCL y el servidor de accion salen del MISMO launch— y es falso:
 *
 *   🔴 **`/amcl_pose` no llega con el robot quieto.** AMCL solo publica tras
 *      moverse `update_min_d` (0,15 m). Medido por la Pi el 2026-08-20:
 *      **20 s suscrito, cero mensajes, con el robot perfectamente sano.**
 *
 * Consecuencia: un profesor que arranca Nav2 y abre la pantalla **sin mover el
 * robot** veia el mapa deshabilitado y un cartel diciendo que su Nav2 «parece
 * SLAM». Reposo presentado como averia.
 *
 * 📌 Y lo caro no es el fallo, es que ya se sabia a medias: `pose_inicial.ts` lo
 *    tiene escrito y el rotulo de la pose ya avisaba de que «no llega con el
 *    robot quieto». **Lo sabia el texto y no lo sabia la guarda.**
 *
 * ✅ La fuente buena es `/estado_navegacion`: la publica el supervisor a 1 Hz,
 *    va TRANSIENT_LOCAL —llega enseguida, sin esperar a que el robot se mueva—
 *    y trae los seis estados. `hayPose` se conserva solo como prueba POSITIVA
 *    alternativa: si llegan poses, AMCL esta vivo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTA PRUEBA LEE EL FUENTE EN VEZ DE RENDERIZAR
 * ═══════════════════════════════════════════════════════════════════════════
 * En este repositorio no hay libreria de render de componentes, y el patron ya
 * establecido para atar invariantes de un `.tsx` es leerlo (`estilo.test.ts`,
 * `sin_node_en_cliente.test.ts`). Lo que se ata aqui es exactamente lo que se
 * rompio: **que la guarda no vuelva a colgar de `/amcl_pose` a solas.**
 *
 * ⚠️ Lo que NO cubre: que la logica nueva sea correcta en ejecucion. Eso lo
 *    daria un render, o el robot. Se dice en vez de callarlo.
 *
 * 🔴 Y si el fichero no aparece, esta prueba **FALLA**, no se salta: una
 *    comprobacion que se salta cuando no encuentra su fuente no distingue «todo
 *    bien» de «no he mirado». Es la leccion de `TOPE_SEGUNDOS`, escrita en
 *    CLAUDE.md.
 */

import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PANEL = join(SRC, 'componentes', 'robot', 'PanelNavegar.tsx')
const DIAGNOSTICO = join(SRC, 'componentes', 'robot', 'navegar', 'DiagnosticoMapa.tsx')

function leerFuente(ruta: string): string {
  expect(existsSync(ruta), `no encuentro ${ruta}: si el fichero se movio, MUEVE esta prueba con el`).toBe(true)
  return readFileSync(ruta, 'utf8')
}

/** El cuerpo de la funcion, sin los comentarios: lo que de verdad se ejecuta. */
function sinComentarios(txt: string): string {
  return txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('Nav2 levantado no se deduce de /amcl_pose', () => {
  it('`puedeNavegar` NO cuelga de `hayPose` a solas', () => {
    const codigo = sinComentarios(leerFuente(PANEL))
    const m = /const\s+puedeNavegar\s*=\s*([^\n]+)/.exec(codigo)
    expect(m, 'ya no existe `puedeNavegar` en PanelNavegar: si se renombro, actualiza esta prueba').not.toBeNull()

    const derecha = (m?.[1] ?? '').trim()
    /*
     * 🔴 Esto es el defecto EXACTO que se arreglo, escrito tal cual estaba.
     *    Si alguien lo revierte «para simplificar», esta linea se pone roja.
     */
    expect(derecha, 'volvio `puedeNavegar = hayPose`: /amcl_pose NO llega con el robot quieto').not.toMatch(/^hayPose\b\s*$/)
  })

  it('y se apoya en `/estado_navegacion`, que es el topic que existe para contestarlo', () => {
    const codigo = sinComentarios(leerFuente(PANEL))
    expect(codigo).toMatch(/useEstadoNavegacion\s*\(/)
    expect(codigo, 'nadie mira el estado de `nav`').toMatch(/nav2Funcionando/)
  })

  /*
   * 🔴 EL CONTROL NEGATIVO, y sin el las dos de arriba no valen: hay que
   *    comprobar que este detector SABE ponerse rojo. Se le da el codigo
   *    defectuoso tal cual era y tiene que rechazarlo.
   */
  it('CONTROL: el detector rechaza el codigo defectuoso original', () => {
    const defectuoso = sinComentarios('const hayPose = pose !== null\n  const puedeNavegar = hayPose\n')
    const m = /const\s+puedeNavegar\s*=\s*([^\n]+)/.exec(defectuoso)
    expect(m).not.toBeNull()
    expect((m?.[1] ?? '').trim()).toMatch(/^hayPose\b\s*$/)
  })

  it('el cartel de «parece SLAM» ya no afirma nada desde el silencio de /amcl_pose', () => {
    const txt = leerFuente(DIAGNOSTICO)
    /*
     * El texto que lee la persona: antes decia «esto se deduce de que no llegue
     * /amcl_pose». Esa frase era la afirmacion falsa, y no puede volver.
     */
    expect(txt, 'volvio la deduccion desde el silencio de /amcl_pose')
      .not.toMatch(/esto se deduce de que no\s*\n?\s*llegue/)
    // Y tiene que seguir diciendo POR QUE ese silencio no significa nada.
    expect(txt, 'ya no explica que /amcl_pose calla con el robot quieto')
      .toMatch(/no llega con el robot quieto/)
  })
})
