/**
 * La salud se mide por RITMO y por ANTIGUEDAD, nunca por que el topic exista:
 * `ros2 topic list` conserva topics de nodos muertos, y el log del driver
 * escribe «streaming reanudado» con el robot apagado.
 */

/**
 * 3 s es el MISMO umbral que usa el detector de silencio del driver, para que
 * cliente y robot coincidan en cuando algo va mal.
 *
 * Se decide por LLEGADAS y no por Hz a proposito: una comprobacion de «> 10 Hz»
 * de este proyecto PASABA midiendo 11,3 Hz sobre un robot que iba a 16,5.
 */
export const UMBRAL_SILENCIO_MS = 3000

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
