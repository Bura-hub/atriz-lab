/**
 * QUE EL NÚMERO DE LA CASCADA Y LA HOJA DE ESTILO NO SE SEPAREN.
 *
 * 🔴 `CASCADA_COMPLETA_MS` decide cuándo `MarcoRobot` retira `.escalonado`. Si
 *    alguien alarga la animación en `globals.css` y este número se queda corto,
 *    la clase se retiraría **a media cascada** y las últimas tarjetas se
 *    quedarían congeladas a medio aparecer — un fallo visual que ninguna prueba
 *    de este repositorio puede ver, porque aquí no se renderiza ningún
 *    componente. Así que se comprueba lo único comprobable: que las dos fuentes
 *    del número digan lo mismo.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CASCADA_COMPLETA_MS, DURACION_ENTRADA_MS, RETARDOS_CASCADA_MS } from './cascada'

const RAIZ = dirname(fileURLToPath(import.meta.url))
const CSS = readFileSync(join(RAIZ, '..', '..', 'app', 'globals.css'), 'utf8')

describe('la cascada de entrada, contra globals.css', () => {
  it('los retardos declarados son los de la hoja, en el mismo orden', () => {
    const enLaHoja = [...CSS.matchAll(/\.escalonado\s*>\s*\*\s*>\s*\*:nth-child\([^)]*\)\s*\{\s*animation-delay:\s*(\d+)ms/g)]
      .map((m) => Number(m[1]))

    // 🔴 Sin esto, un cambio que BORRE las reglas dejaría la lista vacía y la
    //    comparación pasaría por comparar nada con nada.
    expect(enLaHoja.length).toBeGreaterThanOrEqual(5)
    expect(enLaHoja).toEqual([...RETARDOS_CASCADA_MS])
  })

  it('`--t-entrada` vale lo que dice DURACION_ENTRADA_MS', () => {
    const m = /--t-entrada:\s*(\d+)ms/.exec(CSS)
    expect(m, 'no encuentro --t-entrada en globals.css').not.toBeNull()
    expect(Number(m?.[1])).toBe(DURACION_ENTRADA_MS)
  })

  it('`.escalonado` sigue animando con `--t-entrada`, y no con otra variable', () => {
    // Si alguien cambia la regla a `--t-aviso`, los dos comprobantes de arriba
    // seguirían pasando y el numero seria falso igual.
    expect(CSS).toMatch(/\.escalonado\s*>\s*\*\s*>\s*\*\s*\{\s*animation:\s*entrar\s+var\(--t-entrada\)/)
  })

  it('la cascada completa es el mayor retardo mas la duracion', () => {
    expect(CASCADA_COMPLETA_MS).toBe(220 + 320)
  })
})
