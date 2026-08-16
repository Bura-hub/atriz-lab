import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AA, AA_PROYECCION, contraste, luminanciaRelativa, mezclar, tripleteDe, type ParMedido,
} from './contraste'
import { cuerpoDeBloque, resolverToken, tokensDeclarados } from './estilo'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CSS = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')

const BLANCO = 'blanco'
const TINTA_SOBRE_LIMA = 'tinta-sobre-lima'

/** Los colores que no son tokens sino literales escritos en un componente. */
const LITERALES: Record<string, string> = {
  [BLANCO]: '255 255 255',
  // `BaldosaRobot.tsx` pinta la baldosa `MIRAR` con tinta oscura, no blanca: el
  // lima es demasiado claro para blanco encima. Es un literal a proposito.
  [TINTA_SOBRE_LIMA]: '16 18 6',
}

/**
 * 🔴 LOS TOKENS DE `:root`, NO LOS DE LA HOJA ENTERA — Y ESTO NO ES UN DETALLE.
 *
 * `tokensDeclarados()` mete todo en un `Map`, asi que **la ultima declaracion
 * gana**. Y `.proyeccion` va DESPUES de `:root` en el fichero: leer la hoja
 * entera devuelve el valor de PROYECCION para `--muted-foreground`, `--border` y
 * los tres `--sintaxis-*`.
 *
 * Lo encontro esta misma prueba en su primera ejecucion: la comparacion «mesa
 * contra proyeccion» dio **el mismo numero hasta el decimal quince**, que es la
 * firma de estar midiendo dos veces lo mismo. Sin ese control, los pares de
 * arriba habrian pasado igual —los dos valores superan AA— midiendo un color que
 * no es el que ve nadie en la mesa.
 */
const DECL = tokensDeclarados(cuerpoDeBloque(CSS, ':root {'))
const DECL_PROYECCION = tokensDeclarados(cuerpoDeBloque(CSS, '.proyeccion {'))

/** Resuelve un nombre a triplete, mirando primero las anulaciones de proyeccion. */
function color(nombre: string, enProyeccion: boolean): readonly [number, number, number] {
  const literal = LITERALES[nombre]
  if (literal !== undefined) return tripleteDe(literal)!

  const crudo = enProyeccion && DECL_PROYECCION.has(nombre)
    ? DECL_PROYECCION.get(nombre)
    : resolverToken(nombre, DECL)

  const t = tripleteDe(crudo)
  if (t === null) throw new Error(`«${nombre}» no resuelve a un triplete (vale «${crudo}»)`)
  return t
}

/** Todos los tokens declarados que casen un prefijo. */
const conPrefijo = (p: string): string[] =>
  [...DECL.keys()].filter((k) => k.startsWith(p)).sort()

/**
 * 🔴 LOS PARES QUE HAY QUE MEDIR, CON SU MOTIVO.
 *
 * Nace SEMBRADO CON LOS VALORES DE HOY, o sea verde desde el primer commit. Eso
 * es deliberado: la prueba no existe para arreglar la paleta actual —que esta
 * bien— sino para que la SIGUIENTE no pueda romperla en silencio.
 */
const PARES: ParMedido[] = [
  // ── La prosa ──────────────────────────────────────────────────────────────
  ...['--card', '--background', '--muted'].map((sobre) => ({
    tinta: '--foreground', sobre, minimo: AA,
    porque: 'el texto de la aplicacion, sobre las tres superficies que existen',
  })),
  {
    tinta: '--muted-foreground', sobre: '--muted', minimo: AA,
    porque: 'el PEOR caso de la tinta secundaria: rotulos y notas sobre la superficie apagada',
  },
  // ── Identidad: blanco sobre el campo de cada seccion ───────────────────────
  ...conPrefijo('--seccion-').map((sobre) => ({
    tinta: BLANCO, sobre, minimo: AA,
    porque: 'la cabecera de cada pantalla es un campo de color con el titulo en blanco',
  })),
  // ── Los bloques del muro ──────────────────────────────────────────────────
  {
    tinta: BLANCO, sobre: '--bloque-vivo', minimo: AA,
    porque: 'baldosa de bloque, leida a tres metros y proyectada',
  },
  {
    tinta: BLANCO, sobre: '--bloque-ir', minimo: AA,
    porque: 'baldosa de bloque, leida a tres metros y proyectada',
  },
  {
    // 🔴 Este par es el que explica por que el lima lleva tinta oscura: con
    //    blanco encima no llegaria, y la baldosa mas urgente seria la ilegible.
    tinta: TINTA_SOBRE_LIMA, sobre: '--bloque-mirar', minimo: AA,
    porque: 'el lima es demasiado claro para blanco: BaldosaRobot usa tinta oscura a proposito',
  },
  // ── Los estados, que son TEXTO sobre papel ─────────────────────────────────
  ...conPrefijo('--estado-').flatMap((tinta) => (['--card', '--background'] as const).map(
    (sobre) => ({
      tinta, sobre, minimo: AA,
      porque: 'los estados son tinta sobre papel; los tonos «bonitos» bajan de 2:1 aqui',
    }),
  )),
  // ── La parada, y solo la parada ───────────────────────────────────────────
  {
    tinta: BLANCO, sobre: '--destructive', minimo: AA,
    porque: 'el slab de parada de emergencia, el unico rojo de la aplicacion',
  },
  // ── La tinta del codigo, sobre el fondo REAL del editor ────────────────────
  ...conPrefijo('--sintaxis-').map((tinta) => ({
    tinta, sobre: '--card', minimo: AA,
    // El editor vive dentro de `<Tarjeta>` -> `.vidrio` -> `rgb(var(--card))`,
    // con `rgb(var(--vidrio)/0.03)` encima. Se resuelve la mezcla, no se estima.
    encima: { token: '--vidrio', alfa: 0.03 },
    porque: 'el fondo real del editor del Taller, con su velo de vidrio resuelto',
  })),
]

describe('el contraste, medido y no escrito a mano', () => {
  describe('la formula', () => {
    it('los extremos de WCAG: blanco sobre negro son 21', () => {
      expect(contraste([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5)
    })

    it('un color consigo mismo es 1', () => {
      expect(contraste([21, 122, 61], [21, 122, 61])).toBeCloseTo(1, 5)
    })

    it('es simetrica: da igual cual va delante', () => {
      const a = [30, 58, 210] as const
      const b = [246, 245, 243] as const
      expect(contraste(a, b)).toBeCloseTo(contraste(b, a), 10)
    })

    it('la luminancia del negro es 0 y la del blanco 1', () => {
      expect(luminanciaRelativa([0, 0, 0])).toBeCloseTo(0, 10)
      expect(luminanciaRelativa([255, 255, 255])).toBeCloseTo(1, 10)
    })

    it('mezclar con alfa 0 y 1 son los dos extremos', () => {
      const fondo = [255, 255, 255] as const
      const encima = [15, 16, 32] as const
      expect(mezclar(fondo, encima, 0)).toEqual([255, 255, 255])
      expect(mezclar(fondo, encima, 1)).toEqual([15, 16, 32])
    })

    it('🔴 `tripleteDe` rechaza lo que no es un triplete, no lo adivina', () => {
      // Un token que valga `var(--otro)` o `#ff0000` tiene que dar `null`, no un
      // color inventado: si no, la prueba mediria una cosa que no esta ahi.
      for (const malo of ['#ff0000', 'var(--x)', '1 2', '1 2 3 4', '300 0 0', '', 'a b c']) {
        expect(tripleteDe(malo), malo).toBeNull()
      }
      expect(tripleteDe('21 122 61')).toEqual([21, 122, 61])
    })
  })

  describe('🔴 LOS PARES DE LA PALETA REAL', () => {
    it.each(PARES.map((p) => [`${p.tinta} sobre ${p.sobre}`, p] as const))(
      '%s', (_n, par) => {
        const base = color(par.sobre, false)
        const fondo = par.encima === undefined
          ? base
          : mezclar(base, color(par.encima.token, false), par.encima.alfa)
        const c = contraste(color(par.tinta, false), fondo)
        expect(c, `${c.toFixed(2)}:1 — ${par.porque}`).toBeGreaterThanOrEqual(par.minimo)
      },
    )

    it('✅ EL CONTROL: se midieron pares de verdad, no una lista vacia', () => {
      // Sin esto, un `conPrefijo` roto dejaria la tabla en cuatro entradas y
      // «todo pasa» seria trivialmente cierto. Es el patron de este repositorio.
      expect(PARES.length).toBeGreaterThan(25)
      expect(DECL.size).toBeGreaterThan(30)
      // Y que los prefijos encuentren algo: si el redisenio los renombra, esto
      // avisa en vez de dejar de mirar en silencio.
      expect(conPrefijo('--seccion-').length).toBeGreaterThanOrEqual(9)
      expect(conPrefijo('--estado-').length).toBeGreaterThanOrEqual(4)
      expect(conPrefijo('--sintaxis-').length).toBeGreaterThanOrEqual(3)
    })

    it('✅ Y EL CONTROL EN LA OTRA DIRECCION: la formula sabe reprobar', () => {
      // Un par imposible tiene que fallar. Sin esto, «todos pasan» podria
      // significar que la comparacion esta rota.
      expect(contraste([255, 255, 255], [246, 245, 243])).toBeLessThan(AA)
    })
  })

  describe('🔴 EL MURO SE PROYECTA: en `.proyeccion` el suelo sube a 7:1', () => {
    /*
     * Un proyector LAVA LOS NEGROS: el contraste real cae por debajo del
     * calculado, y por eso `.proyeccion` existe y redefine tinta y borde. Exigir
     * aqui el mismo 4,5 que en la mesa seria medir la escena equivocada.
     */
    const enProyeccion = [...DECL_PROYECCION.keys()].filter((k) => k.startsWith('--sintaxis-'))

    it('el control: proyeccion redefine tinta de codigo', () => {
      expect(enProyeccion.length).toBeGreaterThanOrEqual(3)
    })

    it.each(enProyeccion)('%s sobre el editor, proyectado', (token) => {
      const fondo = mezclar(color('--card', true), color('--vidrio', true), 0.03)
      const c = contraste(color(token, true), fondo)
      expect(c, `${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_PROYECCION)
    })

    it('la tinta secundaria de proyeccion es MAS oscura que la de mesa', () => {
      // No es una cifra: es la direccion del cambio. Si alguien la aclara, el
      // modo proyeccion deja de servir para lo que existe.
      const mesa = contraste(color('--muted-foreground', false), color('--background', false))
      const proy = contraste(color('--muted-foreground', true), color('--background', true))
      expect(proy).toBeGreaterThan(mesa)
    })
  })
})
