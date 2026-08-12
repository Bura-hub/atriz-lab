/*
 * 🔴 AQUI NO SE ESCRIBE MARKDOWN. Estas cadenas se pintan como TEXTO PLANO.
 *    Para enfatizar, MAYUSCULAS. Para citar un comando, «comillas».
 */

/**
 * EL SISTEMA DE INFRARROJOS ROBOT-A-ROBOT. PURO: sin React y sin red.
 *
 * Interpreta `atriz_rvr_msgs/msg/EstadoIR` (topic `/estado_ir`, 1 Hz).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LO QUE ESTE MODULO EXISTE PARA **NO** HACER
 * ═══════════════════════════════════════════════════════════════════════════
 * El mensaje trae cuatro campos llamados `sensor_0..3`, y la tentacion evidente
 * —la que pedia el diseño original del SDK— es pintar una brujula de cuatro
 * cuadrantes: delante, izquierda, derecha, detras.
 *
 * **Esta medido con los DOS robots que no se puede** (evidencia 100, 2026-08-11):
 *
 *     donde esta el emisor      rvr-01      rvr-02
 *     DELANTE                   [2,3]       [2,3]
 *     a la IZQUIERDA            [1]         [1]
 *     DETRAS                    [1,3]       [1,2,3]
 *     a la DERECHA              [2,3]       [2,3]     <- IGUAL que DELANTE
 *     sensor_0                  NUNCA       NUNCA
 *
 * Hay direccionalidad real —es reproducible entre robots y el ciclo cierra al
 * girar 360°— pero **discrimina TRES estados, no cuatro**, y un byte no lleva
 * datos jamas. La mascara del SDK esta etiquetada «on BOLT» y este robot es un
 * RVR: otro producto y otro chasis.
 *
 * Una brujula de cuatro cuadrantes mentiria **con datos reales**, que es la peor
 * clase de mentira que sabe hacer una interfaz. Es exactamente el fallo del
 * clasificador de color de este mismo repositorio: una rama «si no, verde» que
 * recogia el ruido y lo afirmaba con toda confianza.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y LA LECTURA CADUCA EN UN SEGUNDO
 * ═══════════════════════════════════════════════════════════════════════════
 * El registro del firmware se borra solo. Por eso `antiguedad_lectura_s` NO es
 * un metadato: sin ella, un `255` con tres segundos encima se lee como «no hay
 * nadie» cuando lo que dice es «hace mucho que no miro». Los dos casos se ven
 * identicos en el numero y son opuestos en el significado.
 */

/**
 * Lo que caduca el dato del firmware, en segundos. Sale del `.msg` del robot
 * («el dato del firmware CADUCA EN 1 SEGUNDO»), no de una estimacion de aqui.
 */
export const CADUCIDAD_LECTURA_S = 1.0

/** Valor con el que el firmware dice «este sensor no ve nada». */
export const SENSOR_SIN_SENAL = 255

/** `atriz_rvr_msgs/msg/EstadoIR`, tal cual llega por rosbridge. */
export interface EstadoIR {
  crudo: number
  sensor_0: number
  sensor_1: number
  sensor_2: number
  sensor_3: number
  lecturas_validas: boolean
  antiguedad_lectura_s: number
  ultimo_codigo: number
  hay_mensaje: boolean
  antiguedad_mensaje_s: number
  /** broadcasting · following · evading · off */
  modo: string
  far_code: number
  near_code: number
  conduciendo_por_ir: boolean
}

/**
 * 🔴 NO HAY UN VALOR «DELANTE» NI UN VALOR «DERECHA», y no es una omision: es
 *    el resultado de la medida. Los dos dan el mismo patron de sensores.
 *
 * 🔴 Y `'NADIE_EN_ESTA_MUESTRA'` se llama asi a proposito. No existe un valor
 *    `'NADIE'` porque la lectura es INTERMITENTE —una sola muestra puede decir
 *    que no hay nadie habiendolo—, y un nombre corto invitaria a pintarlo como
 *    un hecho asentado. El tipo carga la advertencia para que la pantalla no
 *    pueda perderla, igual que `ConfirmacionServicio` no tiene un `'CONFIRMA'`.
 */
export type ZonaIR =
  | 'IZQUIERDA'
  | 'DETRAS'
  | 'DELANTE_O_DERECHA'
  | 'NADIE_EN_ESTA_MUESTRA'
  | 'RANCIA'
  | 'SIN_SONDEO'
  | 'PATRON_NO_MEDIDO'

export interface LecturaIR {
  zona: ZonaIR
  /** Que se ha mirado para decirlo. Sin esto el veredicto es una opinion. */
  evidencia: string
  /**
   * 🔴 `sensor_0` NO llevo datos NUNCA, en los dos robots y en ~10 experimentos.
   *    Si algun dia los lleva, la medida de la que cuelga todo este modulo se ha
   *    quedado corta y hay que repetirla. Se saca a la superficie en vez de
   *    ignorarlo en silencio, que es como se pierden los hallazgos.
   */
  sensor0ConDatos: boolean
}

/** Los sensores 1..3 que ven algo. `sensor_0` va aparte: ver `sensor0ConDatos`. */
function activos(e: EstadoIR): number[] {
  const fuera: number[] = []
  if (e.sensor_1 !== SENSOR_SIN_SENAL) fuera.push(1)
  if (e.sensor_2 !== SENSOR_SIN_SENAL) fuera.push(2)
  if (e.sensor_3 !== SENSOR_SIN_SENAL) fuera.push(3)
  return fuera
}

/**
 * Donde esta el otro robot, hasta donde la medida permite decirlo.
 *
 * El ORDEN de las comprobaciones es el diseño, no una casualidad: primero si
 * hay sondeo, luego si el dato esta fresco, y solo entonces se mira el patron.
 * Al reves, un `255` rancio se colaria como «no hay nadie».
 */
export function zonaDelEmisor(e: EstadoIR): LecturaIR {
  const sensor0ConDatos = e.sensor_0 !== SENSOR_SIN_SENAL

  // ── 1 · ¿Hay sondeo? ──────────────────────────────────────────────────────
  // Con `lecturas_validas` en false los cinco campos NO son lecturas: son
  // relleno. El driver es explicito («nunca se publican ceros como si fueran
  // datos») y aqui se respeta en vez de interpretarlos igualmente.
  if (!e.lecturas_validas) {
    return {
      zona: 'SIN_SONDEO',
      evidencia:
        'El robot dice que sus lecturas NO son validas: el sondeo de infrarrojos esta '
        + 'apagado, o la consulta al firmware fallo. Los numeros que vienen no son datos.',
      sensor0ConDatos: false,
    }
  }

  // ── 2 · ¿Esta fresco? ─────────────────────────────────────────────────────
  const edad = e.antiguedad_lectura_s
  if (!Number.isFinite(edad) || edad < 0 || edad > CADUCIDAD_LECTURA_S) {
    return {
      zona: 'RANCIA',
      evidencia:
        (Number.isFinite(edad) && edad >= 0
          ? `La ultima consulta al firmware tiene ${edad.toFixed(1)} s, y el dato caduca al segundo. `
          : 'No se sabe de cuando es la ultima consulta al firmware. ')
        + 'Con la lectura caducada, un sensor «sin señal» significa QUE HACE MUCHO QUE NO SE MIRA, '
        + 'no que no haya nadie cerca.',
      sensor0ConDatos,
    }
  }

  // ── 3 · El patron ─────────────────────────────────────────────────────────
  const on = activos(e)
  const clave = on.join(',')

  if (on.length === 0) {
    return {
      zona: 'NADIE_EN_ESTA_MUESTRA',
      evidencia:
        'Ninguno de los sensores ve nada EN ESTA MUESTRA. La lectura es intermitente: una sola '
        + 'muestra puede decir que no hay nadie habiendolo, asi que esto no es «el robot esta solo».',
      sensor0ConDatos,
    }
  }

  // Los tres patrones MEDIDOS, y solo esos.
  if (clave === '1') {
    return {
      zona: 'IZQUIERDA',
      evidencia: 'Responde solo el sensor 1, que es el patron medido para un emisor a la IZQUIERDA '
        + '(igual en los dos robots).',
      sensor0ConDatos,
    }
  }
  if (clave === '1,3' || clave === '1,2,3') {
    return {
      zona: 'DETRAS',
      evidencia: `Responden los sensores ${clave}, que es el patron medido para un emisor DETRAS `
        + '(rvr-01 dio [1,3] y rvr-02 [1,2,3]).',
      sensor0ConDatos,
    }
  }
  if (clave === '2,3') {
    return {
      zona: 'DELANTE_O_DERECHA',
      evidencia:
        'Responden los sensores 2 y 3. 🔴 DELANTE y a la DERECHA dieron EXACTAMENTE este patron en '
        + 'los dos robots, asi que no se pueden separar: el sistema discrimina tres zonas, no cuatro.',
      sensor0ConDatos,
    }
  }

  /*
   * 🔴 LA RAMA POR DESCARTE NO ADIVINA, Y ESE ES EL PUNTO.
   *
   * Este proyecto ya se quemo con una: el clasificador de color decidia «si no
   * es rojo ni azul, verde», y con el robot sobre suelo mate una cuenta de RUIDO
   * cayo ahi y la pantalla afirmo que la superficie emitia luz verde.
   *
   * «Ninguno de los patrones conocidos» no es una observacion: es la AUSENCIA de
   * observacion. Repartirla al patron medido mas parecido daria una zona con
   * pinta de dato, y aqui hay motivo de sobra para esperar patrones nuevos —solo
   * se midieron cuatro posiciones del emisor, y el infrarrojo REBOTA en paredes
   * y suelo (evidencia 100)—.
   */
  return {
    zona: 'PATRON_NO_MEDIDO',
    evidencia:
      `Responden los sensores ${clave}, y esa combinacion no esta entre las medidas. Hay alguien `
      + 'cerca —eso si lo dice el dato—, pero DONDE no se sabe: decirlo seria inventarlo.',
    sensor0ConDatos,
  }
}

/**
 * 🔴🔴 EL CAMPO POR EL QUE ESTE TOPIC MERECE EXISTIR.
 *
 * `following` y `evading` son modos del FIRMWARE: el RVR conduce solo, sin pasar
 * por `cmd_vel`. Asi que el vigilante del driver no los ve, el
 * `collision_monitor` no los ve, y hasta el 2026-08-11 **nada en ROS sabia que
 * el robot se estaba moviendo**. Si esta interfaz pinta «parado» mientras un
 * robot cruza el aula, es por esto.
 *
 * Devuelve `null` cuando no hay nada que avisar, para que la pantalla no tenga
 * que decidir si un texto vacio se pinta.
 */
export function avisoConduccionIR(e: EstadoIR): string | null {
  if (!e.conduciendo_por_ir) return null
  const modo = e.modo === 'following' || e.modo === 'evading' ? ` en modo «${e.modo}»` : ''
  return (
    `ESTE ROBOT SE ESTA MOVIENDO SOLO, por infrarrojos${modo}. Lo conduce su firmware, no las `
    + 'ordenes de esta web: no pasa por cmd_vel, asi que ni el vigilante ni la capa de seguridad '
    + 'lo ven. No se puede parar desde aqui — se para en el robot.'
  )
}

/**
 * 🔴 PARA CUALQUIER PANTALLA QUE MANDE `/send_infrared_message`.
 *
 * El servicio toma cuatro intensidades con nombre —frontal, izquierda, derecha,
 * trasera— y la lectura natural es «elijo hacia donde emito». **Medido que no**
 * (evidencia 100): emitiendo SOLO por el emisor TRASERO, que apunta al lado
 * contrario, el robot que leia lo recibio igual. Es rebote: en interior el
 * infrarrojo se refleja en paredes y suelo.
 */
export const AVISO_EMISION =
  'El nombre del emisor NO garantiza la direccion. Esta medido que emitiendo solo por detras el '
  + 'otro robot lo recibe igual, porque el infrarrojo rebota en paredes y suelo. Estas eligiendo '
  + 'CON CUANTA FUERZA emite cada uno, no quien te ve.'

/**
 * El ultimo mensaje recibido, o `null` si no ha llegado ninguno.
 *
 * 🔴 `hay_mensaje` no es un adorno: sin el, `ultimo_codigo = 0` no se distingue
 *    de «llego el codigo 0», que es un codigo perfectamente valido.
 */
export function ultimoMensaje(e: EstadoIR): { codigo: number; antiguedadS: number } | null {
  if (!e.hay_mensaje) return null
  const s = e.antiguedad_mensaje_s
  return { codigo: e.ultimo_codigo, antiguedadS: Number.isFinite(s) && s >= 0 ? s : Number.NaN }
}
