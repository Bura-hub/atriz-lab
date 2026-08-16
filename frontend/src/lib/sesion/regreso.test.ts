import { describe, expect, it } from 'vitest'
import { DESTINO_POR_DEFECTO, destinoSeguro } from './regreso'

describe('a donde se vuelve despues de entrar', () => {
  describe('✅ EL CONTROL POSITIVO: las rutas de verdad SI pasan', () => {
    /*
     * Va primero a proposito. Sin el, «rechaza lo peligroso» lo cumpliria una
     * funcion que devuelve `/flota` siempre — y entonces la puerta dejaria de
     * devolver a nadie a donde iba, que es la razon de que exista el parametro.
     */
    it.each([
      '/flota',
      '/robot/3/lidar',
      '/robot/12/no-obedece',
      '/cuaderno',
      '/usuarios',
      '/robot/1/navegar?objetivo=2.5,1.0',
      '/robot/1/telemetria#bateria',
      '/',
    ])('%s', (ruta) => {
      expect(destinoSeguro(ruta)).toBe(ruta)
    })
  })

  describe('🔴 LO QUE SE VA FUERA: las formas de escribir una URL absoluta', () => {
    /*
     * Es el ataque entero: la persona ve el dominio de SU laboratorio, escribe su
     * contraseña de verdad, y acaba en otro sitio ya autenticada. Cada una de
     * estas es una forma distinta de escribir lo mismo, y las que se olvidan son
     * siempre las de la segunda mitad.
     */
    it.each([
      ['doble barra', '//el-que-sea.example'],
      ['barra y contrabarra', '/\\el-que-sea.example'],
      ['doble contrabarra', '\\\\el-que-sea.example'],
      ['esquema completo', 'https://el-que-sea.example'],
      ['esquema sin barras', 'https:el-que-sea.example'],
      ['esquema con una barra', 'https:/el-que-sea.example'],
      ['sin esquema, con dominio', 'el-que-sea.example/robot/1'],
      ['javascript', 'javascript:alert(1)'],
      ['data', 'data:text/html,<h1>hola</h1>'],
      ['barras codificadas', '%2f%2fel-que-sea.example'],
      ['con espacios delante', '   //el-que-sea.example'],
      ['contrabarra sola', '\\otra-cosa'],
    ])('%s', (_n, malo) => {
      expect(destinoSeguro(malo), malo).toBe(DESTINO_POR_DEFECTO)
    })
  })

  describe('lo vacio y lo ausente', () => {
    it.each([null, undefined, '', '   '])('%s -> el destino por defecto', (v) => {
      expect(destinoSeguro(v)).toBe(DESTINO_POR_DEFECTO)
    })
  })

  describe('🔴 y NO decodifica antes de comprobar', () => {
    it('`%2f%2f` se rechaza tal cual, no se convierte en `//`', () => {
      /*
       * Decodificar primero convertiria una cadena que hoy NO pasa en una que si,
       * y quien la resuelva despues puede volver a decodificarla. Se valida la
       * forma tal y como llega, que es la que el navegador va a usar.
       */
      expect(destinoSeguro('%2f%2fel-que-sea.example')).toBe(DESTINO_POR_DEFECTO)
      // Y un `%2F` dentro de una ruta legitima no la rompe: pasa como texto.
      expect(destinoSeguro('/robot/1/navegar?x=a%2Fb')).toBe('/robot/1/navegar?x=a%2Fb')
    })
  })

  describe('✅ EL CONTROL DEL CONTROL: la lista blanca no se abre sola', () => {
    it('un destino inventado pero con forma de ruta SI pasa, y esta bien', () => {
      // No se comprueba que la ruta EXISTA: eso lo hace Next con un 404, y
      // mantener aqui una lista de rutas seria una copia que se queda vieja.
      // Lo que se comprueba es que sea INTERNA, que es lo que protege.
      expect(destinoSeguro('/ruta/que/no/existe')).toBe('/ruta/que/no/existe')
    })
  })
})
