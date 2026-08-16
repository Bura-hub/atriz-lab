import { describe, expect, it } from 'vitest'
import { aHex, aHSV, aRGB, desdeHex, enteros, limitar, nombreAproximado, type RGB } from './color_led'

/** Compara COLORES, no objetos: el tono de un gris no esta definido. */
const mismoColor = (a: RGB, b: RGB) =>
  a.rojo === b.rojo && a.verde === b.verde && a.azul === b.azul

describe('el color que se le manda a los LEDs', () => {
  describe('🔴 los canales llegan como ENTEROS, que es lo que el driver exige', () => {
    it('redondea, no trunca', () => {
      // 🔴 `isinstance(v, int)` en el driver. Una rueda produce flotantes todo
      //    el rato, y un 254,6 truncado a 254 es un color distinto del pedido.
      expect(limitar(254.6)).toBe(255)
      expect(limitar(0.4)).toBe(0)
    })

    it('recorta a 0..255 por los dos lados', () => {
      expect(limitar(-30)).toBe(0)
      expect(limitar(999)).toBe(255)
    })

    it('un NaN sale como 0 —un suelo, no una respuesta— y los infinitos recortan', () => {
      // 🔴 El 0 del NaN es lo que hay que mandar cuando no hay nada que mandar.
      //    Por eso `desdeHex` devuelve null: la validacion va ANTES de aqui.
      expect(limitar(NaN)).toBe(0)
      // Los infinitos SI significan algo, y no se meten en el mismo saco.
      expect(limitar(Infinity)).toBe(255)
      expect(limitar(-Infinity)).toBe(0)
    })

    it('`enteros` pasa los tres canales, no solo uno', () => {
      // Sin esto, un fallo en dos de los tres canales pasaria desapercibido.
      expect(enteros({ rojo: 1.5, verde: -4, azul: 300 }))
        .toEqual({ rojo: 2, verde: 0, azul: 255 })
    })
  })

  describe('la ida y vuelta RGB → HSV → RGB', () => {
    it('conserva el color sobre una rejilla entera', () => {
      // 33 valores por canal = 35 937 colores. Si la conversion se tuerce en
      // algun sexto de la rueda, aqui se ve.
      const paso = 8
      let comprobados = 0
      for (let r = 0; r <= 255; r += paso) {
        for (let g = 0; g <= 255; g += paso) {
          for (let b = 0; b <= 255; b += paso) {
            const original = { rojo: r, verde: g, azul: b }
            const vuelta = aRGB(aHSV(original))
            expect(mismoColor(original, vuelta), `${aHex(original)} → ${aHex(vuelta)}`).toBe(true)
            comprobados++
          }
        }
      }
      // 🔴 EL CONTROL: si el bucle no corriera, «todo cuadra» seria trivialmente
      //    cierto. Van 32³ colores.
      expect(comprobados).toBeGreaterThan(30000)
    })

    it('los extremos de cada sexto de la rueda, uno a uno', () => {
      for (const [nombre, c] of [
        ['rojo', { rojo: 255, verde: 0, azul: 0 }],
        ['amarillo', { rojo: 255, verde: 255, azul: 0 }],
        ['verde', { rojo: 0, verde: 255, azul: 0 }],
        ['cian', { rojo: 0, verde: 255, azul: 255 }],
        ['azul', { rojo: 0, verde: 0, azul: 255 }],
        ['magenta', { rojo: 255, verde: 0, azul: 255 }],
      ] as const) {
        expect(mismoColor(aRGB(aHSV(c)), c), nombre).toBe(true)
      }
    })

    it('🔴 un gris no tiene tono, y la vuelta lo conserva igual', () => {
      // El tono de un gris NO esta definido: no hay angulo que lo describa. Se
      // devuelve 0 por convencion, asi que `aHSV` no es inyectiva — y por eso
      // estas pruebas comparan colores y no estructuras.
      for (const v of [0, 40, 128, 200, 255]) {
        const gris = { rojo: v, verde: v, azul: v }
        expect(aHSV(gris).saturacion).toBe(0)
        expect(mismoColor(aRGB(aHSV(gris)), gris)).toBe(true)
      }
    })

    it('el tono sale en grados 0..360, nunca negativo', () => {
      // El sexto del rojo se calcula con un modulo que puede dar negativo.
      const casi = aHSV({ rojo: 255, verde: 0, azul: 40 })
      expect(casi.tono).toBeGreaterThanOrEqual(0)
      expect(casi.tono).toBeLessThan(360)
    })

    it('un tono fuera de rango se envuelve en vez de romperse', () => {
      expect(aRGB({ tono: 360, saturacion: 1, valor: 1 }))
        .toEqual(aRGB({ tono: 0, saturacion: 1, valor: 1 }))
      expect(aRGB({ tono: -60, saturacion: 1, valor: 1 }))
        .toEqual(aRGB({ tono: 300, saturacion: 1, valor: 1 }))
    })
  })

  describe('el hexadecimal escrito a mano', () => {
    it('✅ EL CONTROL POSITIVO: uno valido se lee bien', () => {
      // Sin esto, «rechaza los malos» pasaria con una funcion que rechaza TODO.
      expect(desdeHex('#FF6B35')).toEqual({ rojo: 255, verde: 107, azul: 53 })
    })

    it('acepta con y sin almohadilla, y en cualquier caja', () => {
      const esperado = { rojo: 255, verde: 107, azul: 53 }
      expect(desdeHex('ff6b35')).toEqual(esperado)
      expect(desdeHex('#ff6b35')).toEqual(esperado)
      expect(desdeHex('  #FF6B35  ')).toEqual(esperado)
    })

    it('acepta la forma corta de tres digitos', () => {
      expect(desdeHex('#f0a')).toEqual({ rojo: 255, verde: 0, azul: 170 })
    })

    it('🔴 devuelve null MIENTRAS SE ESCRIBE, sin lanzar', () => {
      // Cada tecla pasa por aqui: `#`, `#f`, `#ff`… Una excepcion en la tercera
      // pulsacion es una pantalla rota mientras alguien teclea bien.
      for (const a_medias of ['', '#', '#f', '#ff', '#ffff', '#fffff']) {
        expect(() => desdeHex(a_medias)).not.toThrow()
        expect(desdeHex(a_medias)).toBeNull()
      }
    })

    it('🔴 ocho digitos (con alfa) se RECHAZAN, no se recortan', () => {
      // Al LED no se le manda transparencia. Recortarla callado dejaria que
      // alguien creyera haberla mandado.
      expect(desdeHex('#ff6b3580')).toBeNull()
    })

    it('lo que no es hexadecimal no cuela', () => {
      for (const malo of ['#gggggg', 'rojo', '#12345z', '255,107,53']) {
        expect(desdeHex(malo), malo).toBeNull()
      }
    })

    it('hex → RGB → hex es la identidad, en minusculas y con almohadilla', () => {
      expect(aHex(desdeHex('#FF6B35')!)).toBe('#ff6b35')
      expect(aHex({ rojo: 0, verde: 0, azul: 0 })).toBe('#000000')
      expect(aHex({ rojo: 5, verde: 5, azul: 5 })).toBe('#050505')  // rellena a dos
    })
  })

  describe('el nombre aproximado, que existe para poder DECIRLO', () => {
    it('nombra los colores obvios', () => {
      expect(nombreAproximado({ rojo: 255, verde: 0, azul: 0 })).toBe('rojo')
      expect(nombreAproximado({ rojo: 0, verde: 255, azul: 0 })).toBe('verde')
      expect(nombreAproximado({ rojo: 0, verde: 0, azul: 255 })).toBe('azul')
    })

    it('distingue negro, blanco y los grises', () => {
      expect(nombreAproximado({ rojo: 0, verde: 0, azul: 0 })).toBe('negro')
      expect(nombreAproximado({ rojo: 255, verde: 255, azul: 255 })).toBe('blanco')
      expect(nombreAproximado({ rojo: 60, verde: 60, azul: 60 })).toBe('gris oscuro')
      expect(nombreAproximado({ rojo: 200, verde: 200, azul: 200 })).toBe('gris claro')
    })

    it('🔴 NUNCA devuelve vacio: es lo que leera un lector de pantalla', () => {
      // Un lienzo no dice nada, y «#FF6B35» tampoco. Si esto devolviera '' en
      // algun rincon de la rueda, ese color seria mudo.
      const paso = 16
      for (let r = 0; r <= 255; r += paso) {
        for (let g = 0; g <= 255; g += paso) {
          for (let b = 0; b <= 255; b += paso) {
            const n = nombreAproximado({ rojo: r, verde: g, azul: b })
            expect(n.length, `${r},${g},${b}`).toBeGreaterThan(2)
          }
        }
      }
    })

    it('un color apagado se dice apagado, no se hace pasar por saturado', () => {
      expect(nombreAproximado({ rojo: 150, verde: 120, azul: 120 })).toContain('apagado')
    })
  })
})
