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

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 ESTA PRUEBA EXIGÍA UNA FRASE FALSA, Y SE REESCRIBE ENTERA
   * ═══════════════════════════════════════════════════════════════════════════
   * Decía: «hacia atrás no hay capa de seguridad · el polígono se extiende hacia
   * DELANTE · retroceder no está protegido por nada», y **obligaba** a que la
   * tabla se lo dijera al alumno.
   *
   * El barrido de pared del 2026-08-09 —24 estaciones a mano, cuatro
   * direcciones— midió el mismo umbral en las cuatro:
   *
   *     DETRÁS 17,8   DELANTE 16,1   IZQUIERDA 17,9   DERECHA 17,9
   *
   * Hacia atrás protege igual. Y `Precaucion` tampoco acaba en el robot: llega a
   * −0,24 m, o sea 24 cm por detrás — algo que este mismo repositorio ya tenía
   * medido (un retroceso pedido de 30 cm recorrió 14 porque frenaba).
   *
   * → La prueba no se borra: se le da el invariante contrario, para que el diff
   *   enseñe que la afirmación se retiró y por qué.
   */
  it('🔴 NO afirma que hacia atrás no haya protección: está medido que sí la hay', () => {
    expect(AVISOS_ESPACIO.join(' ')).not.toMatch(/no hay capa de seguridad/i)
    expect(AVISOS_ESPACIO.join(' ')).not.toMatch(/no est[aá] protegido por nada/i)
  })

  it('🔴 dice que a menos de 15 cm el robot queda INMÓVIL, no lento', () => {
    /*
     * Es el caso peor y el que no se conocía: `approach` multiplica el mando
     * entero por el tiempo hasta colisión, y con un punto dentro ese factor es
     * cero. Medido: 0,0 cm avanzando, 0,0° girando, 0,0 cm retrocediendo.
     */
    const t = AVISOS_ESPACIO.join(' ')
    expect(t).toMatch(/15 cm/)
    expect(t).toMatch(/INM[OÓ]VIL/i)
    expect(t).toMatch(/no puede alejarse/i)
    // Y dice cómo se sale, que es lo único que funciona.
    expect(t).toMatch(/con la mano/i)
  })

  it('🔴 avisa del centímetro CIEGO, que ningún parámetro cubre', () => {
    // `range_min` del LIDAR = 10 cm; el borde del robot, a 9. Lo pegado al
    // chasis no lo ve nadie, y no se arregla con configuración.
    const t = AVISOS_ESPACIO.join(' ')
    expect(t).toMatch(/10 cm/)
    expect(t).toMatch(/no puede ver|no ve/i)
  })

  it('son exactamente tres: ni se pierden ni se diluyen entre otros', () => {
    expect(AVISOS_ESPACIO).toHaveLength(3)
  })
})
