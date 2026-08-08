/**
 * La salud se mide por RITMO y por ANTIGUEDAD, nunca por que el topic exista:
 * `ros2 topic list` conserva topics de nodos muertos, y el log del driver
 * escribe «streaming reanudado» con el robot apagado.
 */

/**
 * 3 s es el MISMO umbral que usa el detector de silencio del driver, para que
 * cliente y robot coincidan en cuando algo va mal.
 *
 * ✅ VERIFICADO CONTRA EL ROBOT el 2026-08-08, no citado de memoria:
 *    `robot.launch.py:100` declara `silence_timeout` con `default_value='3.0'`.
 *    ⚠️ Y hay una constante PARECIDA que NO es esta y que cambió ese mismo dia:
 *    `SILENCIO_ODOM_S` de `atriz.py` —la biblioteca del alumno— subio de 1,0 a
 *    2,0 s. Es de otro consumidor y no arrastra a este numero. Se comprobo antes
 *    de dejarlo quieto: en este proyecto **una trampa documentada tambien caduca**.
 *
 * Se decide por LLEGADAS y no por Hz a proposito: una comprobacion de «> 10 Hz»
 * de este proyecto PASABA midiendo 11,3 Hz sobre un robot que iba a 16,5.
 *
 * 🔴 EL MARGEN REAL ES 9x, NO 37x — Y ESO SOLO SE SUPO AL MEDIR OTRO REGIMEN.
 *
 * El peor hueco de `/odom` depende de CUANDO se mire, y la diferencia es de un
 * orden de magnitud:
 *
 *      regimen permanente    peor hueco   78-81 ms     (n=3, 60 s cada una)
 *      recien reiniciado     peor hueco  325,7 ms      (20 s tras arrancar)
 *
 * Contra el transitorio, 3000 ms deja 9x. Sigue siendo holgado —por eso el
 * numero no se toca—, pero el margen que uno CREE tener y el que tiene no son el
 * mismo, y quien baje esta constante tiene que compararla contra 326, no contra
 * 81. `salud.test.ts` lo fija.
 *
 * 📝 La leccion, que es del robot y vale igual aqui: **una medida tomada en un
 *    solo regimen no caracteriza el fenomeno.** El proyecto ya lo tenia escrito
 *    para otro caso —«un umbral en milisegundos no es transferible entre topics
 *    de ritmos distintos»—; alli cambiaba el topic, aqui cambia el MOMENTO.
 */
export const UMBRAL_SILENCIO_MS = 3000

/**
 * El peor hueco de `/odom` MEDIDO en el robot, en su peor regimen: los primeros
 * segundos tras reiniciar el driver. Existe para que `UMBRAL_SILENCIO_MS` se
 * compare contra un dato y no contra una intuicion.
 */
export const PEOR_HUECO_ODOM_MEDIDO_MS = 325.7

export type EstadoRobot = 'SIN_CONEXION' | 'EN_LINEA' | 'SIN_DATOS'

export interface EntradaSalud {
  conectado: boolean
  /** ms desde la ultima llegada, o null si no llego ninguna. */
  msDesdeUltimoOdom: number | null
  msDesdeUltimoScan: number | null
  frenando: boolean
}

export interface Salud {
  estado: EstadoRobot
  frenando: boolean
  /** Vacio salvo en SIN_DATOS. El cliente NO elige entre ellas. */
  causasPosibles: string[]
  /** Siempre false: nada de lo que este modulo ve prueba una averia. */
  esAveria: boolean
}

// 🔴 M1: `ms >= 0` ademas de `ms <= UMBRAL_SILENCIO_MS`. `Date.now()` no es
// monotono: un salto de NTP hacia atras hace que `msDesdeUltimo()` (el
// productor, en transporte.ts) de un numero NEGATIVO, y sin este limite
// "-50 <= 3000" es verdad -EN_LINEA sobre un robot mudo, la direccion
// insegura.
const fresco = (ms: number | null) => ms !== null && ms >= 0 && ms <= UMBRAL_SILENCIO_MS

export function evaluarSalud(e: EntradaSalud): Salud {
  if (!e.conectado) {
    return { estado: 'SIN_CONEXION', frenando: false, causasPosibles: [], esAveria: false }
  }
  if (fresco(e.msDesdeUltimoOdom)) {
    return { estado: 'EN_LINEA', frenando: e.frenando, causasPosibles: [], esAveria: false }
  }

  // 🔴 SIN_DATOS no es averia. Con 16 robots, «el RVR apagado y la Pi viva» es
  //    el estado COTIDIANO de carga: pintarlo rojo saca la flota entera en rojo.
  //
  // ⚠️ Punto 5 del encargo: la rama de UNA sola causa de abajo -la que
  //    distingue "excepcion en un manejador" de "el RVR se durmio"- esta
  //    PRACTICAMENTE MUERTA en produccion, y no es un fallo de este modulo:
  //    es un ACOPLAMIENTO con teleoperacion.ts que quien construya la
  //    interfaz TIENE que conocer.
  //
  //    `Teleoperacion.arrancarBarrido()` se da de baja de /scan en cuanto
  //    llega la PRIMERA muestra -correcto alli: es el 83 % del trafico de un
  //    robot, y esa suscripcion solo existia para confirmar que el barrido
  //    arranco-. Sin otro suscriptor a /scan, `msDesdeUltimoScan` (lo que
  //    alimenta `fresco()` aqui) queda CONGELADO en el instante de esa
  //    primera muestra y envejece para siempre: nunca vuelve a estar
  //    "fresco", asi que en la practica esta funcion casi SIEMPRE cae en las
  //    TRES causas genericas de abajo, nunca en la especifica de una sola.
  //
  //    → Si la interfaz QUIERE el diagnostico fino (saber que es "una
  //      excepcion en un manejador de telemetria" y no "el robot esta
  //      cargando o durmiendo"), tiene que mantener SU PROPIA suscripcion a
  //      /scan -ademas de la que usa `arrancarBarrido()` mientras arranca el
  //      barrido- y pagar ese trafico (83 % de lo que manda un robot) de
  //      forma PERMANENTE, no solo durante el arranque. Es una decision de
  //      coste que le toca a quien construya la interfaz, no a este modulo.
  const causasPosibles = fresco(e.msDesdeUltimoScan)
    ? ['una excepcion dentro de un manejador de telemetria del driver: /scan llega y /odom no']
    : [
        'el robot esta cargando: RVR apagado y Raspberry Pi encendida',
        'el RVR se durmio',
        'una excepcion dentro de un manejador de telemetria del driver',
      ]

  return { estado: 'SIN_DATOS', frenando: e.frenando, causasPosibles, esAveria: false }
}
