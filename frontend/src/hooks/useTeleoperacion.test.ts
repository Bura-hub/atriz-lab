import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montarTeleoperacion } from './useTeleoperacion'
import { montarTransporte } from './useTransporte'
import { Teleoperacion } from '../lib/rosbridge/teleoperacion'
import { Transporte } from '../lib/rosbridge/transporte'
import { WSFalso, fabricaFalsa } from '../pruebas/dobles'

const nada = { alCerrarse: () => {}, alAviso: () => {} }

/** Cuantas veces se ha publicado en /cmd_vel_raw por este socket. */
const mandos = (s: WSFalso): number =>
  s.ops().filter((o) => o.op === 'publish' && o.topic === '/cmd_vel_raw').length

function robotTeleoperable() {
  const t = new Transporte('ws://x:9090', fabricaFalsa)
  const limpiarTransporte = montarTransporte(t, nada)
  WSFalso.ultimo.abrir()
  const teleoperacion = new Teleoperacion(t)
  return { t, teleoperacion, socket: WSFalso.ultimo, limpiarTransporte }
}

beforeEach(() => {
  WSFalso.reiniciar()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('montarTeleoperacion — la limpieza que para el robot', () => {
  it('🔴🔴 el bucle de 10 Hz NO sobrevive al desmontaje', () => {
    // Si sobrevive, el robot SIGUE MOVIENDOSE con la pestaña ya en otra pagina.
    vi.useFakeTimers()
    const { teleoperacion, socket, limpiarTransporte } = robotTeleoperable()
    const limpiar = montarTeleoperacion(teleoperacion, () => {})

    teleoperacion.mover(0.2, 0)
    vi.advanceTimersByTime(1000)
    const durante = mandos(socket)
    // Control: mientras esta montado, el bucle SI publica. Sin esto, la
    // afirmacion de abajo pasaria tambien con un bucle que nunca arranco.
    expect(durante).toBeGreaterThan(5)

    limpiar()
    vi.advanceTimersByTime(5000)
    expect(mandos(socket)).toBe(durante)   // ni una publicacion mas

    limpiarTransporte()
  })

  it('el control de la prueba de arriba: SIN limpiar, el bucle sigue publicando', () => {
    // Es la mitad que hace que la prueba anterior signifique algo: demuestra que
    // el bucle habria seguido corriendo si nadie llamara a `desmontar()`.
    vi.useFakeTimers()
    const { teleoperacion, socket, limpiarTransporte } = robotTeleoperable()
    montarTeleoperacion(teleoperacion, () => {})

    teleoperacion.mover(0.2, 0)
    vi.advanceTimersByTime(1000)
    const durante = mandos(socket)
    vi.advanceTimersByTime(5000)
    expect(mandos(socket)).toBeGreaterThan(durante)

    teleoperacion.desmontar()
    limpiarTransporte()
  })

  it('la limpieza suelta tambien el oyente de alCerrarse del transporte', () => {
    // `desmontar()` hace las dos cosas. Sin la segunda, cada montaje deja un
    // oyente acumulado en el Transporte, que vive mas que el componente: con
    // StrictMode montando dos veces, ya serian dos.
    const t = new Transporte('ws://x:9090', fabricaFalsa)
    const limpiarTransporte = montarTransporte(t, nada)
    WSFalso.ultimo.abrir()
    const oyentes = (t as unknown as { oyentesCierre: Set<() => void> }).oyentesCierre
    const antes = oyentes.size   // el que puso montarTransporte

    const limpiar = montarTeleoperacion(new Teleoperacion(t), () => {})
    expect(oyentes.size).toBe(antes + 1)
    limpiar()
    expect(oyentes.size).toBe(antes)

    limpiarTransporte()
  })

  it('los avisos del bucle llegan al oyente mientras esta montado, y no despues', () => {
    // 🔴 `console.error` es mudo para quien teleopera: el alumno seguiria
    //    empujando el joystick contra un robot que ya no recibe nada.
    vi.useFakeTimers()
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { t, teleoperacion, limpiarTransporte } = robotTeleoperable()
    const avisos: string[] = []
    const limpiar = montarTeleoperacion(teleoperacion, (a) => avisos.push(a.mensaje))

    teleoperacion.mover(0.2, 0)
    t.cerrar()                    // `publicar()` empieza a lanzar
    teleoperacion.mover(0.2, 0)   // este tick falla y avisa

    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatch(/se corto el bucle de mando/)

    limpiar()
    errores.mockRestore()
    limpiarTransporte()
  })
})

describe('montarTeleoperacion — lo que no existe a proposito', () => {
  /*
   * 🔴 ESTA PRUEBA DECIA «no hay ningun metodo para LIBERAR la parada».
   *
   * Desde el 2026-08-06 lo hay, detras de sesion. Lo que se conserva —y es lo
   * que de verdad protegia— es que el MONTAJE del hook no lo llama nunca: ni al
   * montar, ni al desmontar, ni en la limpieza. Un robot que recupera el permiso
   * de moverse porque alguien cambio de pestaña es justo lo que no puede pasar.
   */
  it('🔴 montar y desmontar NO libera la parada por su cuenta', () => {
    const { t, teleoperacion, limpiarTransporte } = robotTeleoperable()
    const liberar = vi.spyOn(teleoperacion, 'liberarParada')
    const limpiar = montarTeleoperacion(teleoperacion, () => {})
    limpiar()
    t.cerrar()
    expect(liberar).not.toHaveBeenCalled()
    liberar.mockRestore()
    limpiarTransporte()
  })

  it('la parada de emergencia LANZA si no hay enlace: quien la pulso tiene que enterarse', () => {
    const { t, teleoperacion, limpiarTransporte } = robotTeleoperable()
    const limpiar = montarTeleoperacion(teleoperacion, () => {})
    t.cerrar()
    expect(() => teleoperacion.paradaEmergencia()).toThrowError(/emergency_stop/)
    limpiar()
    limpiarTransporte()
  })
})
