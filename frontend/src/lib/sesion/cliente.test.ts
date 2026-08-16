import { describe, expect, it } from 'vitest'
import { FALLOS_POR_CLIENTE, claveDeCliente, esCuboCompartido } from './cliente'
import { FALLOS_ANTES_DE_BLOQUEAR } from './bloqueo'

const con = (h: Record<string, string>) => new Headers(h)

describe('de que cliente viene una peticion', () => {
  it('el primer salto de `x-forwarded-for` es el cliente', () => {
    expect(claveDeCliente(con({ 'x-forwarded-for': '10.14.7.7, 10.0.0.1, 10.0.0.2' })))
      .toBe('ip:10.14.7.7')
  })

  it('con una sola direccion, esa', () => {
    expect(claveDeCliente(con({ 'x-forwarded-for': '192.168.1.2' }))).toBe('ip:192.168.1.2')
  })

  it('recorta espacios', () => {
    expect(claveDeCliente(con({ 'x-forwarded-for': '  192.168.1.2  , 10.0.0.1' })))
      .toBe('ip:192.168.1.2')
  })

  it('cae a `x-real-ip` si no hay la otra', () => {
    expect(claveDeCliente(con({ 'x-real-ip': '203.0.113.9' }))).toBe('ip:203.0.113.9')
  })

  describe('🔴 SIN PROXY, TODOS COMPARTEN CUBO — y se ve', () => {
    /*
     * Es la escena real: `next dev` en un portatil del aula, sin nada delante.
     * Lo importante no es que ocurra —es correcto ahi— sino que la clave lo DIGA
     * en vez de disfrazarse de identidad. Una clave que finge distinguir
     * clientes cuando no puede es peor que una que admite que no.
     */
    it('sin cabeceras, la clave es `sin-ip`', () => {
      expect(claveDeCliente(con({}))).toBe('sin-ip')
    })

    it('y con la cabecera vacia, tambien', () => {
      expect(claveDeCliente(con({ 'x-forwarded-for': '' }))).toBe('sin-ip')
      expect(claveDeCliente(con({ 'x-forwarded-for': '   ' }))).toBe('sin-ip')
      expect(claveDeCliente(con({ 'x-forwarded-for': ' , 10.0.0.1' }))).toBe('sin-ip')
    })

    it('`esCuboCompartido` lo distingue, para poder decirlo', () => {
      expect(esCuboCompartido(claveDeCliente(con({})))).toBe(true)
      expect(esCuboCompartido(claveDeCliente(con({ 'x-forwarded-for': '1.2.3.4' })))).toBe(false)
    })
  })

  describe('🔴 el tope, y por que es MAS ALTO que el de usuario', () => {
    it('deja pasar mas fallos que el bloqueo por nombre', () => {
      /*
       * Si el cubo por cliente castigara igual de pronto que el de usuario, en un
       * aula sin proxy —donde los 16 comparten clave— **tres alumnos torpes
       * dejarian a la clase entera fuera**. Tiene que estorbar al barrido
       * automatico sin castigar a la clase.
       */
      expect(FALLOS_POR_CLIENTE).toBeGreaterThan(FALLOS_ANTES_DE_BLOQUEAR)
    })

    it('✅ EL CONTROL: pero no tan alto que deje de ser un limite', () => {
      // Un tope de mil seria configuracion que existe y no hace nada.
      expect(FALLOS_POR_CLIENTE).toBeLessThanOrEqual(50)
    })
  })
})
