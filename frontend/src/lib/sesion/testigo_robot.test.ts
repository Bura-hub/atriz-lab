import { generateKeyPairSync, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DURACION_TESTIGO_ROBOT_S, MARGEN_RELOJ_VERIFICADOR_S, PREFIJO_TESTIGO,
  clavePrivadaDe, firmarTestigoRobot,
} from './testigo_robot'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const AHORA_MS = 1_754_860_000_000

const emitir = (cambios: Partial<{ usuario: string; robot: number; ahoraMs: number }> = {}) =>
  firmarTestigoRobot(privateKey, { usuario: 'ana', robot: 7, ahoraMs: AHORA_MS, ...cambios })

/** Lee el cuerpo sin verificar nada — solo para mirarlo en las pruebas. */
const cuerpoDe = (testigo: string) =>
  JSON.parse(Buffer.from(testigo.split('.')[1], 'base64url').toString('utf8'))

describe('firmarTestigoRobot · la forma que el verificador espera', () => {
  it('sale un JWT de tres partes, y la firma cuadra con la clave publica', () => {
    const t = emitir()
    const [cab, cue, firma] = t.split('.')
    expect(t.split('.')).toHaveLength(3)
    expect(JSON.parse(Buffer.from(cab, 'base64url').toString('utf8')))
      .toEqual({ alg: 'EdDSA', typ: 'JWT' })
    // Lo mismo que hace `atriz_testigo.py`: verificar sobre «cabecera.cuerpo».
    expect(verify(null, Buffer.from(`${cab}.${cue}`, 'ascii'), publicKey,
      Buffer.from(firma, 'base64url'))).toBe(true)
  })

  it('lleva los cuatro campos que el verificador sabe leer, y ninguno mas', () => {
    // `atriz_testigo.py` lee sub, rob, exp e iat. Un campo de mas no rompe nada
    // hoy, pero esta prueba existe para que añadirlo sea una decision y no un
    // descuido: el contrato vive en dos lenguajes.
    expect(Object.keys(cuerpoDe(emitir())).sort()).toEqual(['exp', 'iat', 'rob', 'sub'])
  })

  it('🔴 `exp` e `iat` van en SEGUNDOS, no en milisegundos', () => {
    /*
     * LA TRAMPA DE ESTE FICHERO. El testigo de sesion (`testigo.ts`) usa
     * milisegundos; el verificador de la Pi compara contra `time.time()`, que da
     * segundos. Mezclarlos da un testigo que caduca en 1970 o dentro de 50 000
     * años, y las dos formas fallan EN EL ROBOT, lejos de aqui.
     */
    const c = cuerpoDe(emitir())
    expect(c.iat).toBe(Math.floor(AHORA_MS / 1000))
    expect(c.exp - c.iat).toBe(DURACION_TESTIGO_ROBOT_S)
    // Y la comprobacion que de verdad distingue las dos unidades: en segundos el
    // instante cabe en diez cifras; en milisegundos son trece.
    expect(String(c.iat)).toHaveLength(10)
  })

  it('🔴 vive holgadamente mas que el margen de reloj del verificador', () => {
    // Con una vida menor que su margen (60 s), un testigo recien emitido seria
    // indistinguible de uno recien caducado.
    expect(DURACION_TESTIGO_ROBOT_S).toBeGreaterThan(MARGEN_RELOJ_VERIFICADOR_S * 5)
  })

  it('🔴 cabe en un nombre de subprotocolo de WebSocket', () => {
    /*
     * Es lo unico fragil de este transporte: el testigo viaja como nombre de
     * subprotocolo, y ahi solo valen caracteres de «token» HTTP (RFC 7230). Si
     * algun dia se cuela un `+`, un `/` o un `=`, el navegador rechaza la
     * conexion ANTES de abrirla y sin decir por que.
     */
    const nombre = PREFIJO_TESTIGO + emitir()
    expect(nombre).toMatch(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/)
  })
})

describe('🔴 el testigo de ejemplo y este firmante dicen LO MISMO', () => {
  /*
   * EL ESLABON QUE FALTABA, y lo vi al terminar: `emitir_testigo_ejemplo.mjs`
   * escribe el JWT **a mano** —a proposito, para que el ejemplo no dependa de la
   * funcion que quiere comprobar— y el Python del robot lo verifica. Pero eso
   * deja una pregunta sin contestar: ¿emite ESTA funcion lo mismo que el ejemplo?
   *
   * Sin esta prueba, la cadena tenia un hueco justo en el medio: el ejemplo
   * cruzaba a Python, y la web podia emitir otra cosa distinta sin que nada se
   * quejara — hasta el aula.
   */
  const ejemplo = JSON.parse(
    readFileSync(join(__dirname, '../../../../herramientas/testigo_ejemplo.json'), 'utf8'),
  )

  it('la cabecera es byte a byte la misma', () => {
    // Lo firmado es el TEXTO: dos JSON equivalentes con distinto orden de claves
    // dan firmas distintas, y el robot rechazaria sin decir por que.
    expect(emitir().split('.')[0]).toBe(ejemplo.testigo.split('.')[0])
  })

  it('el cuerpo tiene los mismos campos, los mismos tipos y la misma vida', () => {
    const mio = cuerpoDe(firmarTestigoRobot(privateKey, {
      usuario: ejemplo.sujeto, robot: ejemplo.robot, ahoraMs: ejemplo.emitido_s * 1000,
    }))
    const suyo = cuerpoDe(ejemplo.testigo)
    // Iguales enteros: mismo sujeto, mismo robot, mismo iat y mismo exp.
    expect(mio).toEqual(suyo)
  })
})

describe('🔴 lo que NO se emite', () => {
  it('un robot fuera de 1..16 lanza, y lo dice con el valor', () => {
    /*
     * No se emite un testigo invalido: un `rob` que no existe no da un rechazo
     * legible, da un testigo que NUNCA casa con ninguno — y el sintoma seria «el
     * terminal no abre», buscado en el robot en vez de aqui.
     */
    for (const malo of [0, 17, -1, 1.5, Number.NaN]) {
      expect(() => emitir({ robot: malo })).toThrowError(/entero de 1 a 16/)
    }
    expect(() => emitir({ robot: 0 })).toThrowError(/«0»/)
  })

  it('los bordes SI valen: 1 y 16', () => {
    expect(cuerpoDe(emitir({ robot: 1 })).rob).toBe(1)
    expect(cuerpoDe(emitir({ robot: 16 })).rob).toBe(16)
  })

  it('un usuario vacio lanza: el agente lo enseña al siguiente que llega', () => {
    expect(() => emitir({ usuario: '' })).toThrowError(/sin usuario/)
  })
})

describe('clavePrivadaDe', () => {
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  it('acepta un PEM Ed25519 y firma con el', () => {
    const k = clavePrivadaDe(pem)
    expect(k).not.toBeNull()
    expect(firmarTestigoRobot(k!, { usuario: 'ana', robot: 3, ahoraMs: AHORA_MS })).toContain('.')
  })

  it('acepta el PEM con los saltos de linea escapados', () => {
    // Es como cabe en una linea de `.env.local`, que es donde va a vivir.
    expect(clavePrivadaDe(pem.replace(/\n/g, '\\n'))).not.toBeNull()
  })

  it('🔴 devuelve null y NO inventa una clave cuando falta', () => {
    /*
     * Misma decision que `secreto()` con ATRIZ_SECRETO. Generar una al vuelo
     * daria un servidor que arranca y firma testigos que NINGUN robot puede
     * verificar: el fallo aparecería en la Pi, con todo verde aqui.
     */
    expect(clavePrivadaDe(undefined)).toBeNull()
    expect(clavePrivadaDe('')).toBeNull()
    expect(clavePrivadaDe('   ')).toBeNull()
    expect(clavePrivadaDe('esto no es un PEM')).toBeNull()
  })

  it('🔴 rechaza una clave que NO es Ed25519, aunque sea valida', () => {
    // Una RSA firmaria aqui sin quejarse y el robot no la entenderia: el
    // verificador llama a `verify` de una clave Ed25519 y lanza.
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(clavePrivadaDe(rsa)).toBeNull()
  })
})
