/*
 * 🔴 AQUI NO SE ESCRIBE MARKDOWN. Estas cadenas se pintan como TEXTO PLANO.
 *    Para enfatizar, MAYUSCULAS. Para citar un comando, «comillas».
 *
 * 🔴 Y LLEVAN TILDES, DESDE EL 2026-08-16. Este fichero se escribio entero sin
 *    ellas cuando **ninguna pantalla lo usaba**, asi que nadie las echo de menos.
 *    Al estrenar `PanelInfrarrojos` salieron a la pantalla: «detras», «patron»,
 *    «Esta medido», «quien te ve». Toda la aplicacion es en español y hay una
 *    guardia de lenguaje; esto era una excepcion que solo se sostenia mientras
 *    fuera invisible.
 *    📌 Se tocan **solo las cadenas que se pintan**. Los comentarios se quedan
 *       como estaban: nadie los ve, y cambiarlos seria ruido en el diff.
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
        'El robot dice que sus lecturas NO son válidas: el sondeo de infrarrojos está '
        + 'apagado, o la consulta al firmware falló. Los números que vienen no son datos.',
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
          ? `La última consulta al firmware tiene ${edad.toFixed(1)} s, y el dato caduca al segundo. `
          : 'No se sabe de cuándo es la última consulta al firmware. ')
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
        + 'muestra puede decir que no hay nadie habiéndolo, así que esto no es «el robot está solo».',
      sensor0ConDatos,
    }
  }

  // Los tres patrones MEDIDOS, y solo esos.
  if (clave === '1') {
    return {
      zona: 'IZQUIERDA',
      evidencia: 'Responde solo el sensor 1, que es el patrón medido para un emisor a la IZQUIERDA '
        + '(igual en los dos robots).',
      sensor0ConDatos,
    }
  }
  if (clave === '1,3' || clave === '1,2,3') {
    return {
      zona: 'DETRAS',
      evidencia: `Responden los sensores ${clave}, que es el patrón medido para un emisor DETRÁS `
        + '(rvr-01 dio [1,3] y rvr-02 [1,2,3]).',
      sensor0ConDatos,
    }
  }
  if (clave === '2,3') {
    return {
      zona: 'DELANTE_O_DERECHA',
      evidencia:
        'Responden los sensores 2 y 3. 🔴 DELANTE y a la DERECHA dieron EXACTAMENTE este patrón en '
        + 'los dos robots, así que no se pueden separar: el sistema discrimina tres zonas, no cuatro.',
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
      `Responden los sensores ${clave}, y esa combinación no está entre las medidas. Hay alguien `
      + 'cerca —eso sí lo dice el dato—, pero DÓNDE no se sabe: decirlo sería inventarlo.',
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
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 AQUÍ DECÍA «NO SE PUEDE PARAR DESDE AQUÍ», Y ERA FALSO
 * ═══════════════════════════════════════════════════════════════════════════
 * La parada de emergencia **sí corta los dos modos**, y no de casualidad: el
 * driver manda `stop_robot_to_robot_infrared_evading()` y `..._following()`
 * explícitamente, con su propio comentario diciendo por qué `drive_stop()` no
 * basta — son modos del firmware, así que el RVR volvería a conducir en la
 * siguiente detección.
 *
 * 🔴 **Y lleva haciéndolo desde el 2026-08-01**, en un commit del robot titulado
 *    *«La parada de emergencia no cubría la evasión IR, y el manual decía que
 *    sí»*. O sea que el proyecto **ya había pagado exactamente este error una
 *    vez**, en el manual. Esta frase se escribió el **2026-08-16**, quince días
 *    después — y en el commit que arreglaba «los dos rótulos falsos» de la
 *    pestaña Acciones. Arreglar rótulos falsos e introducir uno nuevo, en el
 *    mismo commit.
 *
 * ⚠️ Y es la peor dirección posible para equivocarse: mandaba a una persona a
 *    **perseguir el robot por el aula** en vez de pulsar el botón rojo que tiene
 *    delante. Un aviso que desaconseja el remedio bueno es peor que no avisar.
 *
 * 📌 Hay ADEMÁS un segundo camino, más suave, y tampoco se decía: «Apagar» en la
 *    baliza manda `/set_ir_baliza` con `encender:false`, y el `off` del driver
 *    apaga **las tres cosas** —baliza, seguimiento y evasión—. Sirve para parar
 *    un seguimiento sin bloquear el robot entero con la parada.
 */
export function avisoConduccionIR(e: EstadoIR): string | null {
  if (!e.conduciendo_por_ir) return null
  const modo = e.modo === 'following' || e.modo === 'evading' ? ` en modo «${e.modo}»` : ''
  return (
    `ESTE ROBOT SE ESTÁ MOVIENDO SOLO, por infrarrojos${modo}. Lo conduce su firmware, no las `
    + 'órdenes de esta web: no pasa por cmd_vel, así que ni el vigilante ni la capa de seguridad '
    + 'lo ven. SÍ se puede parar desde aquí: la parada de emergencia corta el seguimiento y la '
    + 'evasión además de frenar los motores. Y «Apagar» en la baliza los apaga sin bloquear el '
    + 'robot entero.'
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
  'El nombre del emisor NO garantiza la dirección. Está medido que emitiendo solo por detrás el '
  + 'otro robot lo recibe igual, porque el infrarrojo rebota en paredes y suelo. Estás eligiendo '
  + 'CON CUÁNTA FUERZA emite cada uno, no quién te ve.'

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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EMITIR — los limites, y por que la fuerza es UNA y no cuatro
 * ═══════════════════════════════════════════════════════════════════════════
 * `SendInfraredMessage.srv` toma un codigo y CUATRO intensidades con nombre
 * —frontal, izquierda, derecha, trasera—, y la lectura natural es «elijo hacia
 * donde emito». Esa lectura es falsa por dos motivos independientes:
 *
 *   1. **Rebota.** Medido: emitiendo SOLO por el emisor TRASERO, el robot que
 *      leia lo recibio igual. En interior el infrarrojo se refleja en paredes y
 *      suelo. Ver `AVISO_EMISION`.
 *   2. **El firmware no deja repartirlas.** Lo dice `atriz.py` del robot: se
 *      puede encender y apagar cada emisor por separado, pero **el nivel tiene
 *      que ser el mismo en todos los encendidos**. Cuatro deslizadores
 *      ofrecerian una combinacion que el robot no puede cumplir.
 *
 * → Un codigo y UNA fuerza, igual que la biblioteca del alumno.
 */
export const CODIGO_MIN = 0
export const CODIGO_MAX = 7
export const FUERZA_MIN = 0
export const FUERZA_MAX = 64
/** Lo que usa `atriz.py` por defecto. Se copia para que las dos vias coincidan. */
export const FUERZA_POR_DEFECTO = 64

export interface PeticionIR {
  code: number
  front_strength: number
  left_strength: number
  right_strength: number
  rear_strength: number
}

/**
 * Los argumentos del servicio, o `null` si lo pedido no es valido.
 *
 * 🔴 `null` Y NO UN VALOR RECORTADO. Recortar en silencio haria que pedir el
 *    codigo 9 emitiera el 7 y la pantalla dijera que emitio el 9 — la clase de
 *    mentira que este proyecto persigue. Un rango se comprueba, no se dobla.
 */
export function peticionIR(codigo: number, fuerza: number): PeticionIR | null {
  const enteroEn = (v: number, min: number, max: number) =>
    Number.isInteger(v) && v >= min && v <= max
  if (!enteroEn(codigo, CODIGO_MIN, CODIGO_MAX)) return null
  if (!enteroEn(fuerza, FUERZA_MIN, FUERZA_MAX)) return null
  return {
    code: codigo,
    front_strength: fuerza,
    left_strength: fuerza,
    right_strength: fuerza,
    rear_strength: fuerza,
  }
}

/**
 * Como se llama cada zona en pantalla.
 *
 * 🔴 `DELANTE_O_DERECHA` CONSERVA EL «O», y no se acorta. Es el resultado de la
 *    medida: los dos robots dieron el MISMO patron de sensores para las dos
 *    posiciones. Un nombre corto —«delante»— seria elegir una de las dos sin
 *    tener con que.
 */
/**
 * LA BALIZA CONTINUA: dejar el robot emitiendo hasta que alguien lo apague.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ES UN SERVICIO PROPIO Y NO `set_ir_mode`
 * ═══════════════════════════════════════════════════════════════════════════
 * `set_ir_mode` lleva `broadcasting` **y `following`** en el mismo campo `mode`
 * como cadena libre, y la lista blanca de rosbridge filtra por **servicio, no
 * por argumento**. Abrir aquel a la web habría abierto también el modo que hace
 * **conducir al robot solo** — y los modos IR son del firmware, así que no pasan
 * por `cmd_vel`: ni watchdog, ni `collision_monitor`, ni parada por polígono.
 *
 * `/set_ir_baliza` recibe un **booleano**: no existe la cadena con la que pedir
 * `following`. La seguridad no está en que el driver valide bien, está en que
 * **la petición peligrosa no se puede escribir**.
 *
 * 👤 Encargado a la Pi el 2026-08-16, aprobado y desplegado en rvr-01 el
 *    2026-08-17. Contrato en `atriz_rvr_msgs/srv/SetIRBaliza.srv`.
 *
 * ⚠️ **Apagar apaga LAS TRES cosas** —baliza, seguimiento y evasión—, no una de
 *    tres. Es la semántica del driver y la pantalla tiene que decirlo así: quien
 *    pulse «apagar» para callar la baliza está además desactivando el
 *    seguimiento, y eso no se adivina.
 */
export interface PeticionBaliza {
  encender: boolean
  far_code: number
  near_code: number
}

/**
 * @returns `null` si algo está fuera de rango, **nunca un valor recortado**.
 *
 * 🔴 No recorta a propósito, igual que `peticionIR`. Recortar convierte «pediste
 *    algo imposible» en «te mando otra cosa parecida sin avisar», y este
 *    proyecto tiene el caso medido: `limitar(nan)` devolvía **el tope** de
 *    velocidad porque `abs(nan) <= tope` es falso y caía en la rama de recorte.
 *
 * ⚠️ Con `encender: false` los códigos se ignoran —lo dice el `.srv`—, así que
 *    no se validan: exigir un código válido para APAGAR haría que un valor
 *    inválido en pantalla impidiera apagar la baliza, que es justo lo contrario
 *    de lo que tiene que pasar con un mando de parada.
 */
export function peticionBaliza(
  encender: boolean,
  farCode: number,
  nearCode: number,
): PeticionBaliza | null {
  if (!encender) return { encender: false, far_code: 0, near_code: 0 }
  const codigoValido = (v: number) =>
    Number.isInteger(v) && v >= CODIGO_MIN && v <= CODIGO_MAX
  if (!codigoValido(farCode) || !codigoValido(nearCode)) return null
  return { encender: true, far_code: farCode, near_code: nearCode }
}

export const NOMBRE_ZONA: Readonly<Record<ZonaIR, string>> = {
  IZQUIERDA: 'a la izquierda',
  DETRAS: 'detrás',
  DELANTE_O_DERECHA: 'delante o a la derecha',
  NADIE_EN_ESTA_MUESTRA: 'nadie en esta muestra',
  RANCIA: 'lectura caducada',
  SIN_SONDEO: 'sin sondeo',
  PATRON_NO_MEDIDO: 'hay alguien, sitio desconocido',
}

/**
 * El modo del firmware, en palabras. Los cuatro valores salen del `.msg`.
 *
 * ⚠️ `following` y `evading` **conducen el robot** sin pasar por `cmd_vel`. La
 *    web no los puede pedir —no estan en la lista blanca, a proposito— pero si
 *    los puede RECIBIR, porque el alumno los arranca desde el Taller.
 */
export const NOMBRE_MODO_IR: Readonly<Record<string, string>> = {
  broadcasting: 'emitiendo como baliza',
  following: 'siguiendo a otro robot',
  evading: 'huyendo de otro robot',
  off: 'apagado',
}
