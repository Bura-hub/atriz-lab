/**
 * UNA SOLA `Teleoperacion` POR CONEXIÓN, COMPROBADO SOBRE EL FUENTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUÉ ESTO NECESITA UN EJECUTOR Y NO UN COMENTARIO
 * ═══════════════════════════════════════════════════════════════════════════
 * `useTeleoperacion()` **construye una `Teleoperacion` nueva** cada vez que se
 * llama, y cada una arranca su propio `setInterval` a 10 Hz publicando en
 * `/cmd_vel_raw`. Dos instancias son dos bucles sobre la entrada de la capa de
 * seguridad, y —lo que de verdad importa— **dos banderas de parada de
 * emergencia**: dos verdades sobre si el robot está parado.
 *
 * El proyecto ya lo sabía. Subió la teleoperación al proveedor precisamente
 * para hacerlo *«imposible por construcción en vez de por convención»*, y lo
 * dejó escrito en TRES sitios: `BotonParada`, `PanelConducir` y `ContextoRobot`.
 *
 * 🔴 Y aun así `PanelLidar` se quedó fuera de aquella limpieza y **nadie lo vio
 *    durante meses**. Ni `tsc`, ni `eslint`, ni las 1047 pruebas: llamar a un
 *    hook dos veces es código perfectamente válido. Lo que lo escondía es que
 *    el LIDAR no conduce — el bucle de sobra no movía nada, solo existía.
 *
 * 📌 Tres comentarios diciendo «no hagas esto» no impidieron que se hiciera. Es
 *    la lección que este repositorio lleva escrita en todas partes: **la
 *    afirmación la sostiene el ejecutor, no la buena intención de quien
 *    escribe.**
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ficherosDeEstilo, lineasDeCodigo } from './estilo'

const RAIZ = dirname(fileURLToPath(import.meta.url))
const SRC = join(RAIZ, '..', '..')

/**
 * El ÚNICO fichero que puede construir una teleoperación.
 *
 * ⚠️ Si algún día hay un segundo legítimo, se añade aquí **con su motivo**. Una
 *    lista de excepciones que crece sin justificarse convierte la guardia en
 *    decoración, que es justo lo que la guardia persigue.
 */
const DUEÑO = 'ContextoRobot.tsx'

describe('una sola Teleoperacion por conexión', () => {
  it('🔴 solo `ContextoRobot` llama a useTeleoperacion()', () => {
    const culpables: string[] = []
    let mirados = 0
    for (const dir of [join(SRC, 'componentes'), join(SRC, 'hooks'), join(SRC, 'app')]) {
      for (const f of ficherosDeEstilo(dir)) {
        if (f.endsWith('.css') || f.endsWith(DUEÑO)) continue
        mirados++
        // 🔴 Sin comentarios: `BotonParada` y `PanelConducir` EXPLICAN por qué no
        //    hay que llamarlo, y contar esas explicaciones como llamadas es el
        //    error que este proyecto lleva cinco veces cometiendo.
        const codigo = lineasDeCodigo(readFileSync(f, 'utf8')).join('\n')
          /*
           * 🔴 FUERA LA DECLARACIÓN, y esto lo destapó la propia guardia al
           *    estrenarse: acusaba a `useTeleoperacion.ts`, o sea al fichero que
           *    DEFINE el hook. `export function useTeleoperacion(` casa el mismo
           *    patrón que una llamada.
           *
           *    Se quita la declaración en vez de excluir el fichero entero: así
           *    ese fichero SIGUE vigilado —si algún día se llamara a sí mismo
           *    dos veces, se vería—. Excluirlo habría sido un agujero con forma
           *    de excepción.
           */
          .replace(/function\s+useTeleoperacion\s*\(/g, '')
        // La llamada es `useTeleoperacion(`; la IMPORTACIÓN del tipo o del hook
        // no lo es, y por eso se exige el paréntesis.
        if (/\buseTeleoperacion\s*\(/.test(codigo)) culpables.push(f.replace(SRC, ''))
      }
    }
    /*
     * 🔴 EL CONTROL DE TAMAÑO VA **ANTES** DEL VEREDICTO, y el orden importa:
     *    si el barrido no encontrara nada —una ruta mal puesta, una extensión
     *    que cambia—, `culpables` estaría vacío y la prueba pasaría diciendo
     *    «todo bien» sin haber mirado un solo fichero. Cero culpables y cero
     *    ficheros se leen igual en la salida de vitest.
     *    Es el fallo que `piezasHuerfanas` tuvo el mismo día al estrenarse.
     */
    expect(mirados, 'la guardia no ha mirado casi nada: revisa las rutas').toBeGreaterThan(40)
    expect(culpables, `crean una Teleoperacion de más: ${culpables.join(', ')}`).toEqual([])
  })

  /*
   * CONTROL. Sin esto, la prueba de arriba pasaría igual si el barrido de
   * ficheros no encontrara nada —una ruta mal puesta, una extensión que cambia—
   * y «cero culpables» se leería como «todo bien». Es exactamente el fallo que
   * tuvo `piezasHuerfanas` al estrenarse.
   */
  it('control: el dueño SÍ la llama, o esta guardia no está mirando nada', () => {
    const dueño = join(SRC, 'hooks', DUEÑO)
    const codigo = lineasDeCodigo(readFileSync(dueño, 'utf8')).join('\n')
    expect(/\buseTeleoperacion\s*\(/.test(codigo)).toBe(true)
  })
})
