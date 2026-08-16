import { describe, expect, it } from 'vitest'
import { CIERRES_DE_CREDENCIAL, leerCierre } from './rechazo'
import { motivoDeCierre } from '@/lib/taller/protocolo'

describe('que significa un cierre de rosbridge', () => {
  describe('🔴 los rechazos de credencial NO se reintentan', () => {
    it.each(CIERRES_DE_CREDENCIAL)('%i corta el bucle de reconexion', (codigo) => {
      expect(leerCierre(codigo).reintentar).toBe(false)
    })

    it.each(CIERRES_DE_CREDENCIAL)('%i SIEMPRE trae una explicacion', (codigo) => {
      // Un cierre sin explicacion es la firma de fallo que todo esto evita.
      const l = leerCierre(codigo)
      expect(l.explicacion).not.toBeNull()
      expect(l.explicacion!.length).toBeGreaterThan(20)
    })

    it('enseña LOS DOS textos: el de la web y el detalle del robot', () => {
      // El de la web dice que HACER; el del robot trae el dato exacto.
      const l = leerCierre(4404, 'este testigo es para el robot 2, y este es el 1')
      expect(l.explicacion).toContain(motivoDeCierre(4404))
      expect(l.explicacion).toContain('robot 2')
    })

    it('y sin detalle del robot NO deja parentesis vacios colgando', () => {
      const l = leerCierre(4404, '   ')
      expect(l.explicacion).toBe(motivoDeCierre(4404))
      expect(l.explicacion).not.toContain('«')
    })
  })

  describe('🔴 el 1013 SI se reintenta, aunque parezca un rechazo', () => {
    it('reintenta: la Pi no tiene RTC y el reloj se arregla solo en ~18 s', () => {
      expect(leerCierre(1013).reintentar).toBe(true)
    })

    it('pero SE EXPLICA, para que la espera no parezca un cuelgue', () => {
      expect(leerCierre(1013).explicacion).toBe(motivoDeCierre(1013))
    })

    it('🔴 EL CONTROL: no esta en la lista de rechazos', () => {
      // Si alguien lo mete ahi "por coherencia", los 16 robots recien
      // encendidos quedan inalcanzables hasta que alguien recargue la pagina.
      expect(CIERRES_DE_CREDENCIAL).not.toContain(1013)
    })
  })

  describe('lo demas se reintenta y en silencio', () => {
    it.each([
      [1000, 'cierre normal'],
      [1001, 'el otro lado se va'],
      [1006, 'se corto sin cierre limpio: robot apagado o WiFi'],
      [1011, 'error interno del servidor'],
      [4409, 'ocupado — es del agente, no de rosbridge'],
    ])('%i (%s) reintenta sin explicacion propia', (codigo) => {
      const l = leerCierre(codigo)
      expect(l.reintentar).toBe(true)
      expect(l.explicacion).toBeNull()
    })
  })

  it('🔴 el detalle del robot NO se usa para DECIDIR, solo para explicar', () => {
    // Decidir por el texto seria fragil: el robot puede cambiar sus mensajes.
    // Lo que manda es el codigo.
    const conTexto = leerCierre(1006, 'la firma no es válida')
    expect(conTexto.reintentar).toBe(true)
  })
})
