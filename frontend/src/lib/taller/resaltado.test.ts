import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { tokenizar, tokenizarPorLineas, type TipoToken } from './resaltado'

/** El tipo del token que cubre la posicion `pos` del codigo. */
function tipoEn(codigo: string, pos: number): TipoToken {
  let i = 0
  for (const t of tokenizar(codigo)) {
    if (pos < i + t.texto.length) return t.tipo
    i += t.texto.length
  }
  throw new Error(`posicion ${pos} fuera del codigo`)
}

/** Los textos de todos los tokens de un tipo, en orden. */
const textosDe = (codigo: string, tipo: TipoToken) =>
  tokenizar(codigo).filter((t) => t.tipo === tipo).map((t) => t.texto)

/**
 * Las practicas de verdad, del OTRO repositorio.
 *
 * 🔴 Se prueban contra el corpus real y no contra ejemplos inventados por mi:
 *    un tokenizador probado solo con lo que su autor imagino es un doble de si
 *    mismo. Este proyecto lo pago el 2026-08-15 con un campo que se llamaba
 *    `ok` y un doble que lo llamaba `valido` (evidencia 124).
 */
function practicasReales(): { nombre: string; codigo: string }[] {
  const candidatos = [
    fileURLToPath(new URL('../../../../../Atriz_rvr/scripts/estudiantes', import.meta.url)),
    fileURLToPath(new URL('../../../../Atriz_rvr/scripts/estudiantes', import.meta.url)),
  ]
  const dir = candidatos.find(existsSync)
  if (dir === undefined) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.py'))
    .map((f) => ({ nombre: f, codigo: readFileSync(`${dir}/${f}`, 'utf8') }))
}

const PRACTICAS = practicasReales()

/**
 * 🔴 SALTADA NO ES APROBADA.
 *
 * Estas pruebas necesitan el repositorio hermano `Atriz_rvr`. Si no esta, se
 * marcan SALTADAS —vitest las cuenta aparte y se ven en la salida— en vez de
 * hacer `return`, que las contaria como aprobadas. Es la misma regla que este
 * proyecto aplica a `ros2 topic list` y a `comprobar_contrato.mjs`: una
 * comprobacion que no puede fallar no es una comprobacion.
 */
const conCorpus = it.skipIf(PRACTICAS.length === 0)

describe('el tokenizador de Python del editor', () => {
  describe('🔴 LA INVARIANTE: no se pierde ni un caracter', () => {
    // El editor pinta estos trozos DEBAJO de un <textarea> transparente. Perder
    // un solo caracter desplaza el color respecto al texto de ahi en adelante, y
    // el desfase crece hacia abajo. Es el fallo mas visible que esto puede tener.
    it.each([
      ['vacio', ''],
      ['solo espacios', '   \n\t\n  '],
      ['una linea', 'robot.avanzar(0.20, 3)'],
      ['comilla sin cerrar', "print('se me olvido"],
      ['docstring sin cerrar', '"""empieza y no acaba'],
      ['acentos y emoji', "# avanza medio metro 📝 «así»\nx = 'ñandú'"],
      ['CRLF', 'a = 1\r\nb = 2\r\n'],
    ])('%s', (_nombre, codigo) => {
      expect(tokenizar(codigo).map((t) => t.texto).join('')).toBe(codigo)
    })

    conCorpus('sobre las practicas REALES del robot', () => {
      for (const { nombre, codigo } of PRACTICAS) {
        expect(tokenizar(codigo).map((t) => t.texto).join(''), nombre).toBe(codigo)
      }
    })

    conCorpus('✅ EL CONTROL: el corpus existe y tiene lo que decimos', () => {
      // Sin esto, la prueba de arriba pasaria con cero ficheros: un bucle sobre
      // una lista vacia no falla nunca.
      expect(PRACTICAS.length).toBeGreaterThanOrEqual(10)
      expect(PRACTICAS.some((p) => p.codigo.includes('"""'))).toBe(true)
      expect(PRACTICAS.some((p) => /f'|f"/.test(p.codigo))).toBe(true)
    })
  })

  describe('lo que tiñe, construccion por construccion', () => {
    it('un comentario llega hasta el final de la linea y no mas', () => {
      const c = '# hola\nx = 1'
      expect(textosDe(c, 'comentario')).toEqual(['# hola'])
      expect(tipoEn(c, 8)).not.toBe('comentario')   // la `x`
    })

    it('🔴 una almohadilla DENTRO de una cadena no abre un comentario', () => {
      // Es el fallo clasico de resolver esto con regex por prioridad.
      const c = "url = 'http://x/#ancla'\ny = 2"
      expect(textosDe(c, 'comentario')).toEqual([])
      expect(textosDe(c, 'cadena')).toEqual(["'http://x/#ancla'"])
    })

    it('🔴 unas comillas DENTRO de un comentario no abren una cadena', () => {
      const c = '# no uses \' ni "\nx = 1'
      expect(textosDe(c, 'cadena')).toEqual([])
      expect(tipoEn(c, 20)).not.toBe('cadena')
    })

    it('un docstring triple cruza lineas enteras', () => {
      const c = 'a = 1\n"""\nesto es texto\nx = 99\n"""\nb = 2'
      const cadenas = textosDe(c, 'cadena')
      expect(cadenas).toHaveLength(1)
      expect(cadenas[0]).toContain('x = 99')
      // Y lo de dentro NO se colorea como codigo.
      expect(textosDe(c, 'numero')).toEqual(['1', '2'])
    })

    it('la barra invertida escapa la comilla siguiente', () => {
      const c = "print('no \\' cerrada todavia')"
      expect(textosDe(c, 'cadena')).toEqual(["'no \\' cerrada todavia'"])
    })

    it('un `\\n` dentro de una cadena no la parte', () => {
      const c = "print('linea\\nsegunda')"
      expect(textosDe(c, 'cadena')).toEqual(["'linea\\nsegunda'"])
    })

    it('numeros enteros, decimales, exponentes y hexadecimales', () => {
      const c = 'a = 6\nb = 5.2\nc = 1e-3\nd = 0x1f\ne = 1_000'
      expect(textosDe(c, 'numero')).toEqual(['6', '5.2', '1e-3', '0x1f', '1_000'])
    })

    it('🔴 un numero pegado a un nombre NO es un numero', () => {
      // `x2` es un identificador. Teñir el `2` lo partiria visualmente en dos.
      expect(textosDe('x2 = 1', 'numero')).toEqual(['1'])
      expect(textosDe('robot.led2 = 5', 'numero')).toEqual(['5'])
    })

    it('las palabras reservadas, y `True/False/None` aparte', () => {
      const c = 'if x is None:\n    return True\nelse:\n    while False:\n        pass'
      expect(textosDe(c, 'palabra_clave')).toEqual(['if', 'is', 'return', 'else', 'while', 'pass'])
      expect(textosDe(c, 'constante')).toEqual(['None', 'True', 'False'])
    })

    it('el nombre que sigue a `def` o `class` es una definicion', () => {
      const c = 'class Patrulla:\n    def avanzar(self):\n        pass'
      expect(textosDe(c, 'definicion')).toEqual(['Patrulla', 'avanzar'])
    })

    it('🔴 y los espacios entre medias no lo rompen', () => {
      expect(textosDe('def   saludar():', 'definicion')).toEqual(['saludar'])
    })

    it('un nombre seguido de parentesis es una llamada', () => {
      const c = 'robot.avanzar(0.20, 3)\nprint(x)'
      expect(textosDe(c, 'llamada')).toEqual(['avanzar', 'print'])
    })

    it('🔴 EL CONTROL: un nombre SIN parentesis no es una llamada', () => {
      // Sin esto, «marca las llamadas» pasaria con algo que marca todo nombre.
      expect(textosDe('velocidad = 0.2', 'llamada')).toEqual([])
      expect(textosDe('import time', 'llamada')).toEqual([])
    })

    it('`with … as …:` sale entero', () => {
      const c = 'with Robot() as robot:'
      expect(textosDe(c, 'palabra_clave')).toEqual(['with', 'as'])
      expect(textosDe(c, 'llamada')).toEqual(['Robot'])
    })

    it('el shebang de la primera linea es un comentario', () => {
      expect(textosDe('#!/usr/bin/env python3\nx = 1', 'comentario'))
        .toEqual(['#!/usr/bin/env python3'])
    })
  })

  describe('⚠️ las f-strings: el limite declarado', () => {
    it('una f-string sale como UNA cadena, sin abrirse por dentro', () => {
      // Decision escrita en la cabecera del modulo: tokenizar el interior es
      // meter un analizador dentro de otro, y ninguna practica lo necesita.
      const c = `print(f'{"rojo":>6} {"verde":>6}')`
      expect(textosDe(c, 'cadena')).toEqual([`f'{"rojo":>6} {"verde":>6}'`])
    })

    it('con especificadores numericos, igual', () => {
      const c = `print(f'{rojo:6d} {rg:5.2f}')`
      expect(textosDe(c, 'cadena')).toEqual([`f'{rojo:6d} {rg:5.2f}'`])
      // Y lo de dentro NO se cuenta como numero suelto.
      expect(textosDe(c, 'numero')).toEqual([])
    })

    it('los otros prefijos tambien: r, b, rb', () => {
      for (const p of ['r', 'b', 'rb', 'fr', 'R', 'B']) {
        expect(textosDe(`x = ${p}'abc'`, 'cadena'), p).toEqual([`${p}'abc'`])
      }
    })

    it('🔴 EL CONTROL: una letra pegada a una comilla NO siempre es prefijo', () => {
      // `perfil'` no existe en Python, pero `x = perfil` seguido de otra cosa si.
      // Lo que importa es que una `f` DENTRO de un nombre no abra una cadena.
      const c = "perfil = 1\ntexto = 'ok'"
      expect(textosDe(c, 'cadena')).toEqual(["'ok'"])
    })
  })

  describe('el troceado por lineas, que es lo que pinta el espejo', () => {
    it('devuelve una entrada por linea, incluidas las VACIAS', () => {
      // 🔴 Si se comieran las vacias, el color subiria respecto al texto.
      const lineas = tokenizarPorLineas('a = 1\n\n\nb = 2')
      expect(lineas).toHaveLength(4)
      expect(lineas[1]).toEqual([])
      expect(lineas[2]).toEqual([])
    })

    it('parte un docstring de varias lineas en varias entradas', () => {
      const lineas = tokenizarPorLineas('"""\nuno\ndos\n"""')
      expect(lineas).toHaveLength(4)
      for (const l of lineas) {
        for (const t of l) expect(t.tipo).toBe('cadena')
      }
    })

    it('🔴 y sigue sin perder caracteres al partir', () => {
      const codigo = 'def f():\n    """doc\n    sigue"""\n    return 1\n'
      const rehecho = tokenizarPorLineas(codigo)
        .map((l) => l.map((t) => t.texto).join(''))
        .join('\n')
      expect(rehecho).toBe(codigo)
    })

    conCorpus('sobre las practicas reales, tampoco', () => {
      for (const { nombre, codigo } of PRACTICAS) {
        const rehecho = tokenizarPorLineas(codigo)
          .map((l) => l.map((t) => t.texto).join(''))
          .join('\n')
        expect(rehecho, nombre).toBe(codigo)
      }
    })
  })
})
