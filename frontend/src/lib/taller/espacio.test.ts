import { describe, expect, it } from 'vitest'
import { AVISOS_ESPACIO, ESPACIO, conCuenta } from './espacio'

describe('la tabla de espacio', () => {
  it('cubre las diez prácticas del curso más el guion del alumno', () => {
    expect(ESPACIO).toHaveLength(11)
    expect(conCuenta()).toHaveLength(10)
  })

  it('🔴 el guion del alumno NO lleva número, y eso es a propósito', () => {
    /*
     * Un fichero escrito por el alumno hace lo que diga su codigo. Poner ahi
     * «1 m» seria inventarse una cuenta, y ademas la peligrosa: alguien
     * despejaria un metro para un guion que conduce tres.
     */
    const suyo = ESPACIO.find((p) => p.fichero === null)!
    expect(suyo.despejar).toBeNull()
  })

  it('la practica que NO mueve el robot lo dice, en vez de pedir espacio', () => {
    const color = ESPACIO.find((p) => p.fichero === '05_sensor_color.py')!
    expect(color.despejar).toMatch(/no se mueve/)
  })
})

describe('🔴 los dos avisos al pie, que son los que contradicen la intuición', () => {
  it('el plano de barrido está a 15,5 cm, no a ras de suelo', () => {
    /*
     * Es la medida que impide el error mas caro de esta tabla: un suelo
     * despejado a ras NO basta, porque el LIDAR barre por encima de zocalos y
     * cajas bajas y el robot chocaria con algo que su sensor nunca vio.
     */
    expect(AVISOS_ESPACIO.join(' ')).toMatch(/15,5 cm/)
    expect(AVISOS_ESPACIO.join(' ')).toMatch(/no a ras de suelo/i)
  })

  it('hacia atrás no hay capa de seguridad', () => {
    // El poligono del collision_monitor se extiende hacia DELANTE. Retroceder
    // no esta protegido por nada, y la tabla no puede callarlo.
    expect(AVISOS_ESPACIO.join(' ')).toMatch(/hacia atr[aá]s/i)
    expect(AVISOS_ESPACIO.join(' ')).toMatch(/no hay capa de seguridad/i)
  })

  it('son exactamente dos: ni se pierden ni se diluyen entre otros', () => {
    expect(AVISOS_ESPACIO).toHaveLength(2)
  })
})
