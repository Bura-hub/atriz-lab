import { describe, expect, it } from 'vitest'
import {
  MAXIMO_PALABRAS_ETIQUETA,
  frasesRepetidas,
  palabrasDe,
  palabrasDuplicadas,
  repeticionesEn,
} from './repeticion'

describe('palabrasDuplicadas — el fallo que se vio en la captura', () => {
  it('🔴 caza «hace hace 7,9 s», que paso 321 pruebas', () => {
    // Salio de que `Dato` prefijaba «hace» a un valor que ya lo traia.
    expect(palabrasDuplicadas('hace hace 7,9 s')).toEqual(['hace hace'])
  })

  it('caza una duplicacion sin acentos en medio', () => {
    expect(palabrasDuplicadas('el el robot')).toEqual(['el el'])
  })

  it('no le importan las mayusculas ni las repeticiones separadas', () => {
    expect(palabrasDuplicadas('Hace HACE algo')).toEqual(['hace hace'])
    expect(palabrasDuplicadas('el robot y el motor')).toEqual([])
  })
})

describe('palabrasDuplicadas — 🔴 `\\b` en JavaScript es ASCII, y eso da falsos positivos', () => {
  /*
   * Estos cuatro casos son la razon de que este modulo use lookarounds Unicode
   * en vez de `\b`. Con `\b` los cuatro gritaban, sobre texto CORRECTO, en tres
   * pantallas distintas de esta aplicacion. Un verificador con falsos positivos
   * se acaba ignorando, y eso es peor que no tenerlo.
   */
  it('🔴 «batería a 8,29 V, a 1,29 V» NO es una duplicacion', () => {
    // Con `\b`: la «a» final de «batería» casaba con la «a» suelta, porque la
    // «í» no es caracter de palabra para `\b` y abre una frontera falsa.
    expect(palabrasDuplicadas('con la batería a 8,29 V, a 1,29 V del umbral')).toEqual([])
  })

  it('🔴 tampoco lo es «la energía a 5 V»', () => {
    expect(palabrasDuplicadas('la energía a 5 V')).toEqual([])
  })

  it('el acento no impide ver una duplicacion de VERDAD', () => {
    // La otra mitad de la comprobacion: arreglar el falso positivo no puede
    // haber creado un falso negativo.
    expect(palabrasDuplicadas('odometría a a 20 grados')).toEqual(['a a'])
    expect(palabrasDuplicadas('temperatura temperatura')).toEqual(['temperatura temperatura'])
  })

  it('texto normal con acentos no dispara', () => {
    expect(palabrasDuplicadas('sin señal de vida')).toEqual([])
    expect(palabrasDuplicadas('la batería se lee en voltios')).toEqual([])
  })
})

describe('frasesRepetidas — la MITAD que un detector de palabras no ve', () => {
  it('🔴 caza «en reposo: 27,5 °C en reposo»', () => {
    // El segundo fallo real del 2026-08-04. No hay ninguna palabra pegada a si
    // misma: son seis caracteres en medio, asi que `palabrasDuplicadas` es
    // ciega a esto por diseño.
    expect(palabrasDuplicadas('en reposo: 27,5 °C en reposo')).toEqual([])
    expect(frasesRepetidas('en reposo: 27,5 °C en reposo')).toEqual(['en reposo'])
  })

  it('exige una palabra con peso: «de la … de la» no cuenta', () => {
    // Sin ese filtro, cualquier etiqueta con dos preposiciones gritaria.
    expect(frasesRepetidas('de la izquierda de la derecha')).toEqual([])
  })

  it('no cuenta apariciones solapadas', () => {
    // «reposo reposo reposo» es UNA duplicacion pegada, no dos apariciones de
    // una frase de dos palabras.
    expect(frasesRepetidas('reposo reposo reposo')).toEqual([])
  })

  it('🔴 calla sobre un parrafo: ahi repetir una frase es prosa', () => {
    const parrafo =
      'La batería se lee en voltios porque el porcentaje miente, y por eso '
      + 'la batería de este robot marcaba 100 % a 8,29 voltios reales.'
    expect(frasesRepetidas(parrafo)).toEqual([])
  })

  it('🔴 y calla sobre la frase REAL del diagnostico que tumbo la primera version', () => {
    /*
     * Este caso no es hipotetico: lo grito el detector al pasarlo por las
     * pantallas renderizadas. La primera version medía CARACTERES con el tope
     * en 90, y esta linea tiene 72 — o sea que pasaba el filtro.
     *
     * Pero es una oracion con dos mitades PARALELAS a proposito. Repetir «un
     * hueco» es la figura, no un fallo. Contar palabras (13 > 10) la deja
     * fuera; contar caracteres no.
     */
    const real = 'Un hueco declarado es honesto; un hueco callado se lee como «todo bien».'
    expect(real.length).toBeLessThan(90)
    expect(palabrasDe(real).length).toBeGreaterThan(MAXIMO_PALABRAS_ETIQUETA)
    expect(frasesRepetidas(real)).toEqual([])
  })

  it('no avisa dos veces de la misma cosa', () => {
    // Si ya dice «en reposo», no repite «reposo» por dentro.
    const hallado = frasesRepetidas('motor en reposo frio, motor en reposo')
    expect(hallado).toEqual(['motor en reposo'])
  })

  it('las etiquetas reales de esta aplicacion no disparan', () => {
    for (const etiqueta of [
      'Temperatura oruga izquierda',
      'Porcentaje que reporta el firmware (no decide nada)',
      'Estado térmico izquierdo (en crudo)',
      'por encima del umbral',
      'Último /motor_status hace 490 ms.',
      '27,5 °C en reposo',
      'hace 25,0 s',
      'no se sabe',
    ]) {
      expect(frasesRepetidas(etiqueta), etiqueta).toEqual([])
      expect(palabrasDuplicadas(etiqueta), etiqueta).toEqual([])
    }
  })
})

describe('repeticionesEn', () => {
  it('devuelve solo los textos que fallan, con lo que se les encontro', () => {
    expect(repeticionesEn([
      'hace 8,4 s',
      'hace hace 7,9 s',
      'en reposo: 27,5 °C en reposo',
    ])).toEqual([
      { texto: 'hace hace 7,9 s', duplicadas: ['hace hace'], frases: [] },
      { texto: 'en reposo: 27,5 °C en reposo', duplicadas: [], frases: ['en reposo'] },
    ])
  })

  it('una pantalla sana no devuelve nada', () => {
    expect(repeticionesEn(['Batería', '8,08 V', 'hace 8,4 s', 'sin fallo'])).toEqual([])
  })
})
