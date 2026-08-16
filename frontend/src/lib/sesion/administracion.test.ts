import { describe, expect, it } from 'vitest'
import {
  buscar, porQueNoSePuedeBorrar, porQueNoSePuedeCambiarClave, porQueNoSePuedeCambiarRol,
} from './administracion'
import { rolDe, type Cuenta } from './reglas'

const cuenta = (usuario: string, rol?: 'profesor' | 'alumno'): Cuenta =>
  ({ usuario, clave: 'sal:hash', creada: 0, ...(rol === undefined ? {} : { rol }) })

const PROFE = cuenta('bura_hub', 'profesor')
const OTRO_PROFE = cuenta('monitora', 'profesor')
const ALUMNA = cuenta('alumno-01', 'alumno')

describe('quien puede hacer que con las cuentas', () => {
  describe('🔴 la ausencia de rol se lee como PROFESOR', () => {
    it('una cuenta sin campo `rol` administra', () => {
      // Las cuentas que ya existen cuando esto se despliega son las de
      // administracion. Leerlas como alumno degradaria EN SILENCIO al unico que
      // puede administrar, y la unica salida seria editar el JSON a mano.
      const vieja = cuenta('de-antes')
      expect(rolDe(vieja)).toBe('profesor')
      expect(porQueNoSePuedeBorrar([vieja, ALUMNA], vieja, 'alumno-01')).toBeNull()
    })
  })

  describe('borrar', () => {
    it('un profesor borra a un alumno', () => {
      expect(porQueNoSePuedeBorrar([PROFE, ALUMNA], PROFE, 'alumno-01')).toBeNull()
    })

    it('🔴 EL CONTROL: un alumno no borra a nadie, ni a otro alumno', () => {
      // Sin este par, «solo el profesor administra» seria una intencion. Con 16
      // alumnos con cuenta, dejar que cualquiera borre es dejar que cualquiera
      // borre la del profesor.
      expect(porQueNoSePuedeBorrar([PROFE, ALUMNA, cuenta('alumno-02', 'alumno')], ALUMNA, 'alumno-02'))
        .toMatch(/solo un profesor/i)
      expect(porQueNoSePuedeBorrar([PROFE, ALUMNA], ALUMNA, 'bura_hub')).toMatch(/solo un profesor/i)
    })

    it('sin sesion tampoco', () => {
      expect(porQueNoSePuedeBorrar([PROFE], undefined, 'bura_hub')).toMatch(/solo un profesor/i)
    })

    it('nadie se borra a si mismo', () => {
      // El borrado no cierra la sesion: quien se borra se queda con una cookie
      // firmada valida apuntando a una cuenta que ya no existe. Estado que nadie
      // ha probado.
      expect(porQueNoSePuedeBorrar([PROFE, OTRO_PROFE], PROFE, 'bura_hub'))
        .toMatch(/tu propia cuenta/i)
    })

    it('🔴🔴 NO se puede borrar al ULTIMO profesor', () => {
      // Es irreversible desde la interfaz: la instalacion se queda sin nadie que
      // pueda crear cuentas y la unica salida es editar `usuarios.json` a mano en
      // el portatil del aula — el estado del que esta pantalla existe para sacar.
      const soloUno = [PROFE, ALUMNA]
      // (lo intenta OTRO profesor, para que no choque con la regla del «a si mismo»)
      expect(porQueNoSePuedeBorrar([...soloUno, OTRO_PROFE], OTRO_PROFE, 'bura_hub')).toBeNull()
      expect(porQueNoSePuedeBorrar(soloUno, PROFE, 'bura_hub')).toMatch(/tu propia cuenta/i)
    })

    it('✅ y con DOS profesores si se puede borrar a uno', () => {
      // El control de la regla anterior: sin el, «protege al ultimo profesor»
      // pasaria con algo que no deja borrar a ningun profesor nunca.
      expect(porQueNoSePuedeBorrar([PROFE, OTRO_PROFE, ALUMNA], PROFE, 'monitora')).toBeNull()
    })

    it('una cuenta que no existe se dice, no se ignora', () => {
      expect(porQueNoSePuedeBorrar([PROFE], PROFE, 'fantasma')).toMatch(/no existe/i)
    })

    it('compara normalizando', () => {
      expect(porQueNoSePuedeBorrar([PROFE, OTRO_PROFE], PROFE, '  BURA_HUB '))
        .toMatch(/tu propia cuenta/i)
    })
  })

  describe('cambiar la contraseña', () => {
    it('un profesor resetea la de otro SIN saber la anterior', () => {
      // Para eso existe el reseteo: alguien perdio el papel del alta masiva.
      const r = porQueNoSePuedeCambiarClave([PROFE, ALUMNA], PROFE, 'alumno-01')
      expect(r.motivo).toBeNull()
      expect(r.exigeLaActual).toBe(false)
    })

    it('🔴 pero para la SUYA hace falta la actual', () => {
      // Sin ese requisito, una sesion olvidada en un portatil del aula permite
      // cambiar la contraseña y quedarse la cuenta.
      const r = porQueNoSePuedeCambiarClave([PROFE, ALUMNA], PROFE, 'bura_hub')
      expect(r.motivo).toBeNull()
      expect(r.exigeLaActual).toBe(true)
    })

    it('un alumno cambia la suya, y solo la suya', () => {
      const propia = porQueNoSePuedeCambiarClave([PROFE, ALUMNA], ALUMNA, 'alumno-01')
      expect(propia.motivo).toBeNull()
      expect(propia.exigeLaActual).toBe(true)

      const ajena = porQueNoSePuedeCambiarClave(
        [PROFE, ALUMNA, cuenta('alumno-02', 'alumno')], ALUMNA, 'alumno-02',
      )
      expect(ajena.motivo).toMatch(/solo un profesor/i)
    })
  })

  describe('cambiar el rol', () => {
    it('un profesor asciende y degrada', () => {
      expect(porQueNoSePuedeCambiarRol([PROFE, ALUMNA], PROFE, 'alumno-01', 'profesor')).toBeNull()
      expect(porQueNoSePuedeCambiarRol([PROFE, OTRO_PROFE], PROFE, 'monitora', 'alumno')).toBeNull()
    })

    it('🔴 y NO puede degradar al ultimo, aunque sea el mismo', () => {
      // El mismo callejon que borrarlo, por otra puerta. Es el agujero que se
      // abre cuando cada operacion comprueba lo suyo sin mirar la invariante.
      expect(porQueNoSePuedeCambiarRol([PROFE, ALUMNA], PROFE, 'bura_hub', 'alumno'))
        .toMatch(/ultimo profesor/i)
    })

    it('un alumno no cambia roles', () => {
      expect(porQueNoSePuedeCambiarRol([PROFE, ALUMNA], ALUMNA, 'alumno-01', 'profesor'))
        .toMatch(/solo un profesor/i)
    })
  })

  describe('buscar', () => {
    it('encuentra normalizando y devuelve undefined si no esta', () => {
      expect(buscar([PROFE, ALUMNA], ' BURA_HUB ')?.usuario).toBe('bura_hub')
      expect(buscar([PROFE], 'nadie')).toBeUndefined()
    })
  })
})
