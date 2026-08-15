import { describe, expect, it } from 'vitest'
import { AVISOS_ESPACIO, ESPACIO, conCuenta } from './espacio'

describe('la tabla de espacio', () => {
  it('cubre las quince prácticas del robot más el guion del alumno', () => {
    // Eran diez hasta el 2026-08-14; el robot añadió las cinco de infrarrojos
    // el 2026-08-11 y esta tabla no se había enterado.
    expect(ESPACIO).toHaveLength(16)
    expect(conCuenta()).toHaveLength(15)
  })

  it('🔴 todos los nombres existen DE VERDAD en el robot', () => {
    /*
     * LA PRUEBA QUE NACE DE UN FALLO. Cinco de los diez nombres de esta tabla no
     * existían en `Atriz_rvr/scripts/estudiantes/`: `01_primer_movimiento.py`,
     * `02_giro.py`, `10_navegacion.py`, `90_practica_libre.py` y
     * `seguidor_linea.py`. Mientras esto solo decía cuánto despejar era
     * cosmético; con el terminal ejecutando, es un botón que falla.
     *
     * ⚠️ Esta prueba NO puede comprobar que existan —el repositorio del robot es
     *    otro y puede no estar al lado—. Lo que sí fija es la FORMA, para que un
     *    nombre inventado a mano cante: los del curso van numerados o son el
     *    seguidor, y todos acaban en `.py`.
     *
     * 🔴 Lo que de verdad impide la deriva es que **la lista la dé el agente**,
     *    leyendo el directorio real. Esta tabla solo aporta los centímetros.
     */
    for (const p of conCuenta()) {
      expect(p.fichero, `«${p.fichero}»`).toMatch(/^(\d{2}_[a-z_]+|seguidor_linea_pid_demo)\.py$/)
    }
  })

  it('🔴 las dos prácticas que se mueven SIN capa de seguridad lo dicen', () => {
    /*
     * `23_tren_de_robots.py` y `24_dispersion.py` conducen por el firmware de
     * infrarrojos: no pasan por `cmd_vel`, así que ni el vigilante ni el
     * `collision_monitor` las ven. Sus propias cabeceras lo avisan con dos 🔴, y
     * esta tabla no puede decir menos que el fichero que describe.
     */
    for (const nombre of ['23_tren_de_robots.py', '24_dispersion.py']) {
      const p = ESPACIO.find((x) => x.fichero === nombre)
      expect(p, nombre).toBeDefined()
      expect(p!.despejar, nombre).toMatch(/SIN capa de seguridad/)
      expect(p!.despejar, nombre).toMatch(/no te vayas/)
    }
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
