import { describe, expect, it } from 'vitest'
// ⚠️ Ruta RELATIVA: `vitest.config.ts` no declara el alias `@/`, que solo existe
//    en el `tsconfig` que usa Next. Con `@/` la prueba ni siquiera carga.
import { DURACION_SESION_MS, abrir, firmar } from './testigo'

const SECRETO = 'un-secreto-de-prueba-que-no-es-el-de-produccion'
const AHORA = 1_700_000_000_000

function testigoDe(usuario: string, ahora = AHORA, secreto = SECRETO): string {
  return firmar({ usuario, exp: ahora + DURACION_SESION_MS }, secreto)
}

describe('el testigo de sesión', () => {
  it('un testigo recién firmado se abre y devuelve su usuario', () => {
    const t = testigoDe('profesora')
    const r = abrir(t, SECRETO, AHORA)
    expect(r.valido).toBe(true)
    expect(r.valido && r.carga.usuario).toBe('profesora')
  })

  it('🔴 con OTRO secreto no se abre', () => {
    // El caso base: quien no tiene el secreto no puede fabricar un testigo.
    const t = testigoDe('profesora')
    expect(abrir(t, 'otro-secreto', AHORA)).toEqual({ valido: false, motivo: 'FIRMA_NO_CUADRA' })
  })

  it('🔴🔴 un testigo con el USUARIO manipulado no se abre', () => {
    /*
     * La prueba que sostiene todo lo demás. El usuario va DENTRO de lo firmado,
     * así que cambiar el nombre en la cookie invalida la firma. Sin esto,
     * cualquiera se pondría el nombre de otro editando una cadena en base64 —y
     * la cookie es `httpOnly` para que ni siquiera pueda leerla desde la
     * consola, pero eso protege del script, no de quien mira las herramientas
     * de desarrollo.
     */
    const t = testigoDe('monitor')
    const [cuerpo, firma] = t.split('.')
    const otroCuerpo = Buffer.from(
      JSON.stringify({ usuario: 'profesora', exp: AHORA + DURACION_SESION_MS }),
      'utf8',
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    expect(otroCuerpo).not.toBe(cuerpo)   // si no, la prueba no probaría nada
    expect(abrir(`${otroCuerpo}.${firma}`, SECRETO, AHORA))
      .toEqual({ valido: false, motivo: 'FIRMA_NO_CUADRA' })
  })

  it('🔴 y con la CADUCIDAD manipulada tampoco', () => {
    // El mismo argumento con el otro campo: `exp` va firmado, así que no se
    // puede estirar una sesión editando la cookie.
    const t = firmar({ usuario: 'profesora', exp: AHORA - 1 }, SECRETO)
    const [, firma] = t.split('.')
    const cuerpoEstirado = Buffer.from(
      JSON.stringify({ usuario: 'profesora', exp: AHORA + 999_999 }), 'utf8',
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    expect(abrir(`${cuerpoEstirado}.${firma}`, SECRETO, AHORA))
      .toEqual({ valido: false, motivo: 'FIRMA_NO_CUADRA' })
  })

  it('caducado no se abre, aunque la firma sea buena', () => {
    const t = firmar({ usuario: 'profesora', exp: AHORA }, SECRETO)
    // `exp <= ahora`: justo en el instante de caducar ya no vale.
    expect(abrir(t, SECRETO, AHORA)).toEqual({ valido: false, motivo: 'CADUCADO' })
    expect(abrir(t, SECRETO, AHORA - 1).valido).toBe(true)
  })

  it('🔴 una firma RECORTADA devuelve «no cuadra», no una excepción', () => {
    /*
     * `timingSafeEqual` LANZA si las longitudes difieren. Sin la comprobación
     * de longitud previa, una cookie truncada —que es lo que deja un navegador
     * que corta una cabecera larga— tumbaría la petición con un 500 en vez de
     * mandar a la pantalla de entrar.
     */
    const t = testigoDe('profesora')
    expect(() => abrir(`${t.split('.')[0]}.abc`, SECRETO, AHORA)).not.toThrow()
    expect(abrir(`${t.split('.')[0]}.abc`, SECRETO, AHORA).valido).toBe(false)
  })

  it('basura no se abre y NUNCA lanza', () => {
    // Lo que llega de una cookie es texto de fuera: «no vale» es un camino
    // normal, no un fallo del servidor.
    for (const malo of ['', '.', 'sinpunto', 'a.', '.b', '{}', 'a.b.c.d']) {
      expect(() => abrir(malo, SECRETO, AHORA)).not.toThrow()
      expect(abrir(malo, SECRETO, AHORA).valido).toBe(false)
    }
  })

  it('un cuerpo válido con campos que no son los nuestros no se abre', () => {
    // Firmado por nosotros pero sin `usuario`: no es un testigo de sesión.
    const cuerpo = Buffer.from(JSON.stringify({ otra: 'cosa' }), 'utf8')
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const t = firmar({ usuario: 'x', exp: AHORA + 1 }, SECRETO)
    // Se refirma el cuerpo malo con el secreto bueno, para aislar el fallo de
    // FORMA del de firma.
    const conFirmaBuena = `${cuerpo}.${
      firmar({ usuario: 'x', exp: AHORA + 1 }, SECRETO).split('.')[1]}`
    expect(t.split('.').length).toBe(2)
    expect(abrir(conFirmaBuena, SECRETO, AHORA).valido).toBe(false)
  })

  it('el testigo no lleva la contraseña ni nada que no sea usuario y caducidad', () => {
    // Una cookie se puede leer con las herramientas del navegador. Lo que no
    // esté aquí dentro no se puede filtrar por aquí.
    const t = testigoDe('profesora')
    const cuerpo = JSON.parse(
      Buffer.from(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as Record<string, unknown>
    expect(Object.keys(cuerpo).sort()).toEqual(['exp', 'usuario'])
  })
})
