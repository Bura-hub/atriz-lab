/**
 * El modelo de UNA baldosa del muro del profesor: 16 robots a la vez, de un
 * vistazo. Funcion PURA -sin React y sin red-: aqui se decide QUE dice cada
 * baldosa, y la interfaz solo lo pinta.
 *
 * 🔴 LA REGLA QUE MANDA SOBRE TODAS LAS DEMAS: la ausencia de datos NO es una
 * averia. Con 16 robots cargando a la vez -RVR apagado y Raspberry Pi viva, el
 * estado COTIDIANO del laboratorio-, adivinar pinta la flota entera en rojo, y
 * un muro que siempre esta rojo se ignora. Por eso «no se sabe» tiene aqui su
 * propio valor en TODOS los campos (`null`, `DESCONOCIDO`, `conocido: false`) y
 * nunca colapsa ni a «bien» ni a «mal».
 */

import {
  Frescura, NivelBateria, V_BAJA, V_CRITICA, interpretarAntiguedad, nivelBateria,
} from '../rosbridge/contrato'
import { EstadoRobot } from '../rosbridge/salud'

/**
 * El driver republica `/motor_status` con `create_timer(1.0, self._publicar_motores)`
 * -verificado en `rvr_driver_node.py:604` del repositorio del robot-, o sea 1 Hz.
 * Y lo hace desde el estado CACHEADO, con su propio temporizador: sigue latiendo
 * aunque el RVR este apagado, que es justo lo que lo hace buen latido para el
 * muro -distingue «la Pi esta viva» de «no hay nadie».
 */
export const PERIODO_MOTOR_STATUS_MS = 1000

/**
 * 🔴🔴 ESTE UMBRAL NO ES `UMBRAL_SILENCIO_MS` (3000) Y NO DEBE UNIFICARSE CON EL.
 *
 * Aquel mide `/odom`, que va a 16,5 Hz: 3 s son ~50 mensajes perdidos. Este mide
 * el latido del MURO, que es `/motor_status` a 1 Hz -el unico topic barato que la
 * baldosa ya paga (0,45 kB/s; ver `presupuesto.ts`)-, asi que 3 s serian TRES
 * mensajes: un hipo de WiFi pintaria «sin señal de vida» en las 16 baldosas a la
 * vez. Cinco periodos deja margen para el jitter sin tragarse un robot muerto
 * mas de 5 s.
 *
 * ⚠️ El umbral esta ATADO al topic: si algun dia el latido se toma de
 * `/battery_state` (cada 30,0 s exactos, `PERIODO_KEEPALIVE_S` del driver), este
 * valor pasa a ser absurdo y hay que recalcularlo. `resumirBaldosa` no puede
 * saber de que topic viene `msDesdeUltimoLatido`: es responsabilidad de quien
 * arma la `EntradaBaldosa`.
 */
export const UMBRAL_LATIDO_MURO_MS = 5 * PERIODO_MOTOR_STATUS_MS

/**
 * El sondeo termico va montado en el keepalive, cada 30,0 s. Por encima de este
 * umbral la temperatura publicada es EL MISMO DATO REPETIDO, no una temperatura
 * que se mantiene: leer una temperatura plana como «estable» es un error medido
 * de este proyecto. Los 5 s de margen sobre 30 son el jitter del sondeo.
 */
export const UMBRAL_TERMICO_RANCIO_S = 35

/** El texto exacto que pide el encargo. La baldosa NUNCA dice «averiado» por esto. */
export const TEXTO_SIN_SENAL = 'sin señal de vida'

/**
 * Lo que trae `/estado_robot`, el topic que el robot publica desde el
 * 2026-08-04. `null` en `EntradaBaldosa` = **no llega**, que NO es «todo bien»:
 * puede ser un driver anterior a esa fecha.
 */
export interface EntradaEstadoRobot {
  /** Contador MONOTONO. Vale por si solo para nada: lo que dice algo es que AVANCE. */
  latido: number
  /**
   * 🔴 La lectura ANTERIOR, y por eso hace falta. El topic va
   * `TRANSIENT_LOCAL`, asi que un suscriptor nuevo puede recibir el ULTIMO
   * valor latcheado de un nodo que ya esta muerto: «llego un mensaje» no prueba
   * que haya nadie detras. Lo unico que lo prueba es que el contador se mueva.
   * `null` = solo hay una lectura todavia, o sea «aun no se sabe».
   */
  latidoPrevio: number | null
  paradaEmergencia: boolean
  /** `false` = la Pi va bien y el RVR no contesta: cargando, dormido, o caido. */
  rvrResponde: boolean
  /** Segundos desde la ultima muestra DEL RVR. -1 = no se sabe. */
  antiguedadMuestraS: number
  /** Segundos desde el ultimo `/odom` COMPLETO. -1 = no se sabe. */
  antiguedadOdomS: number
  /** Reanudaciones seguidas sin recuperar dato. ⚠️ Umbrales sin calibrar. */
  reanudacionesFallidas: number
}

/**
 * 🔴 EL TERCER ESTADO: `/odom` muerto con el enlace VIVO.
 *
 * Si llegan muestras del RVR pero `/odom` no se completa —faltan componentes—,
 * el latido avanza, `rvr_responde` dice `true`, y **la odometria esta muerta**.
 * Sin este umbral el muro pinta ese robot en verde.
 *
 * 3 s sobre un topic de 16,5 Hz son ~50 mensajes perdidos, el mismo criterio
 * que `UMBRAL_SILENCIO_MS`. Aqui SI se puede reutilizar el numero, y no
 * contradice la regla de al lado: alli el problema era aplicar un umbral de
 * `/odom` a un topic de 1 Hz; esto sigue midiendo `/odom`, solo que el dato
 * llega envuelto en otro mensaje.
 */
export const UMBRAL_ODOM_MUERTA_S = 3

export interface EntradaBaldosa {
  id: number
  conectado: boolean
  /** De `/battery_state.voltage`. `null` o no finito = no se sabe (el driver publica NaN). */
  voltios: number | null
  /** De `/motor_status.antiguedad_termico_s`. 🔴 -1.0 significa «no se sabe». */
  antiguedadTermicoS: number | null
  /** De `/motor_status.atascado_*`. 🔴 `null` = no se sabe, que NO es `false`. */
  atascado: boolean | null
  /** ms desde el ultimo `/motor_status`. `null` = no ha llegado ninguno. */
  msDesdeUltimoLatido: number | null
  /** `/estado_robot`. `null` = no llega, que NO es «todo bien». */
  estadoRobot: EntradaEstadoRobot | null
}

/**
 * Lo que la baldosa le pide a una persona:
 *   NINGUNA -> no hay nada que hacer.
 *   MIRAR   -> hay algo que no se sabe, o que puede empeorar. Se mira.
 *   IR      -> hay que levantarse y cruzar el edificio.
 *
 * 🔴 `IR` solo puede salir de un HECHO POSITIVO Y ACTUAL. Nunca de un hueco.
 */
export type AtencionBaldosa = 'NINGUNA' | 'MIRAR' | 'IR'

export interface Baldosa {
  id: number
  /**
   * El mismo vocabulario que `EstadoRobot` de `salud.ts` -para que la interfaz
   * pinte los tres estados igual en el muro y en la ficha del robot-, pero
   * calculado con `UMBRAL_LATIDO_MURO_MS`, NO con `evaluarSalud()`. Ver el
   * comentario de la constante.
   */
  estado: EstadoRobot
  atencion: AtencionBaldosa
  /** Frases listas para pintar, en orden fijo. Vacio = no hay nada que decir. */
  motivos: string[]
  /**
   * La MISMA lista, en etiquetas de dos o tres palabras, y en el mismo orden.
   *
   * 🔴 No es un resumen opcional: es la unica forma de que una baldosa del muro
   *    diga TODO lo que sabe sin reventar la rejilla. Medido el 2026-08-04: el
   *    peor caso real da **6 motivos, el mas largo de 155 caracteres**, y seis
   *    frases asi en una casilla de un 4x4 la hacen ilegible y desigualan las
   *    alturas.
   *
   * ⚠️ Y NO es esconder. `CLAUDE.md` prohibe tapar los motivos tras un
   *    desplegable porque «el motivo ES la accion»: aqui **estan todos**, solo
   *    que a la distancia de lectura que toca. La frase entera vive un clic
   *    mas alla, en la ficha del robot.
   *
   * 📌 Las dos listas se construyen SIEMPRE juntas (`anota()`), asi que no
   *    pueden desincronizarse, y hay una prueba que lo fija.
   */
  etiquetas: string[]
  /**
   * `false` = no hay latido, asi que TODO lo de abajo es «lo ultimo que se
   * supo», de antiguedad desconocida. La interfaz tiene que atenuarlo, no
   * pintarlo como si fuera de ahora.
   */
  datosVigentes: boolean
  /** 🔴 `DESCONOCIDO` NO se pinta como `OK`. Son cosas distintas. */
  bateria: NivelBateria
  /** `null` = no se sabe. La interfaz no debe pintar «0,00 V» ni «NaN V». */
  voltios: number | null
  /** `{ conocido: false }` cuando la antiguedad era -1 o no finita. */
  frescuraTermico: Frescura
  /** `true` = la temperatura publicada es el mismo dato repetido. */
  termicoRancio: boolean
  /** 🔴 `null` = no se sabe. Se propaga tal cual: no se colapsa a `false`. */
  atascado: boolean | null
  /**
   * 🔴 `true` = el robot NO aceptara ordenes de movimiento. El profesor tiene
   * que verlo: un alumno con la parada puesta dice «no funciona», y desde fuera
   * es indistinguible de una averia. `null` = no se sabe.
   */
  paradaEmergencia: boolean | null
  /**
   * 🔴 EL TERCER ESTADO: llegan datos del RVR pero `/odom` no se completa.
   * Sin esto la baldosa saldria VERDE con la odometria muerta.
   */
  odometriaMuerta: boolean
  /** `false` = la Pi va y el RVR no contesta. `null` = no se sabe. */
  rvrResponde: boolean | null
}

const enVoltios = (v: number): string => `${v.toFixed(2).replace('.', ',')} V`

/**
 * 🔴 `ms >= 0` ademas del tope, por el mismo motivo que `fresco()` en `salud.ts`:
 * `Date.now()` no es monotono y un salto de NTP hacia atras da un numero
 * NEGATIVO. Sin este limite «-50 <= 5000» es verdad, y la baldosa diria que hay
 * latido sobre un robot mudo -la direccion insegura.
 */
const latidoFresco = (ms: number | null): boolean =>
  ms !== null && ms >= 0 && ms <= UMBRAL_LATIDO_MURO_MS

export function resumirBaldosa(e: EntradaBaldosa): Baldosa {
  const estado: EstadoRobot = !e.conectado
    ? 'SIN_CONEXION'
    : latidoFresco(e.msDesdeUltimoLatido)
      ? 'EN_LINEA'
      : 'SIN_DATOS'
  const datosVigentes = estado === 'EN_LINEA'

  // ── Bateria: por VOLTIOS, nunca por `percentage` ────────────────────────
  // El porcentaje dijo 100 % con la bateria a 8,29 V. `voltage` es la señal
  // autoritativa, y el propio driver lo dice: «La señal autoritativa para la
  // web es `voltage`, comparada con los umbrales del firmware».
  const voltios = e.voltios !== null && Number.isFinite(e.voltios) ? e.voltios : null
  const bateria: NivelBateria = voltios === null ? 'DESCONOCIDO' : nivelBateria(voltios)

  // ── Frescura del dato termico ───────────────────────────────────────────
  // 🔴 -1.0 es «nunca se ha sabido nada», no «hace cero segundos».
  //    `interpretarAntiguedad()` ya separa las dos: no se re-implementa aqui.
  const frescuraTermico: Frescura =
    e.antiguedadTermicoS === null ? { conocido: false } : interpretarAntiguedad(e.antiguedadTermicoS)
  const termicoRancio = frescuraTermico.conocido && frescuraTermico.antiguedadS > UMBRAL_TERMICO_RANCIO_S

  // ── Lo que trae `/estado_robot` ─────────────────────────────────────────
  const er = e.estadoRobot
  const paradaEmergencia: boolean | null = er === null ? null : er.paradaEmergencia
  const rvrResponde: boolean | null = er === null ? null : er.rvrResponde

  // 🔴 EL TERCER ESTADO. Llegan muestras del RVR (`antiguedadMuestraS` fresca)
  //    pero `/odom` no se completa (`antiguedadOdomS` envejecida). El latido
  //    avanza y `rvrResponde` dice true, asi que sin esto la baldosa sale VERDE
  //    con la odometria muerta.
  // ⚠️ Las dos tienen que ser >= 0: `-1.0` es «no se sabe», y comparar un -1
  //    contra un umbral daria «fresco» sobre un dato que no existe.
  const odometriaMuerta =
    er !== null
    && er.antiguedadMuestraS >= 0 && er.antiguedadMuestraS <= UMBRAL_ODOM_MUERTA_S
    && er.antiguedadOdomS >= 0 && er.antiguedadOdomS > UMBRAL_ODOM_MUERTA_S

  // ── Los motivos, en orden fijo ──────────────────────────────────────────
  // Sin latido la baldosa NO afirma nada sobre atasco, bateria ni temperatura:
  // esos campos siguen ahi como «lo ultimo que se supo» (`datosVigentes:
  // false`), pero convertirlos en frases seria presentar un dato de antiguedad
  // desconocida como si fuera de ahora.
  const motivos: string[] = []
  const etiquetas: string[] = []
  /** Las dos listas a la vez: es imposible añadir una frase sin su etiqueta. */
  const anota = (corto: string, largo: string) => { etiquetas.push(corto); motivos.push(largo) }
  if (!datosVigentes) {
    // 🔴 «sin señal de vida» va en las DOS listas: ya es corta, y hay una prueba
    //    que exige ese literal exacto en `motivos`. Es lo primero que se lee en
    //    la baldosa y lo primero que se lee en la ficha.
    anota(TEXTO_SIN_SENAL, TEXTO_SIN_SENAL)
    anota(
      estado === 'SIN_CONEXION' ? 'no llego al robot' : 'la Pi calla',
      estado === 'SIN_CONEXION'
        ? 'no hay WebSocket abierto con el robot, así que no se sabe nada de él. Eso NO es una avería'
        : 'el enlace está abierto y no llega /motor_status: puede estar cargando (RVR apagado con la ' +
          'Pi viva), dormido, o el driver caído. NO es una avería por sí solo',
    )
  } else {
    // 🔴 `atascado: null` no genera frase: que no se sepa no es que no lo haya,
    //    y tampoco es un atasco. Solo `true` afirma algo.
    // 🔴 La parada va PRIMERA de los motivos: explica por si sola que el robot
    //    no obedezca, y sin ella el profesor busca una averia que no existe.
    if (paradaEmergencia === true) {
      anota(
        'parada puesta',
        'la parada de emergencia esta puesta: el robot no acepta ordenes de movimiento hasta ' +
        'que alguien la libere con el robot delante. NO es una averia',
      )
    }
    if (odometriaMuerta) {
      anota(
        'odometría muerta',
        'llegan datos del RVR pero /odom no se completa: la odometria esta muerta aunque el ' +
        'enlace vaya bien. Reiniciar el streaming NO lo arregla, es otro fallo',
      )
    }
    if (rvrResponde === false) {
      anota(
        'el RVR no contesta',
        'la Raspberry Pi va bien y el RVR no contesta: puede estar cargando (apagado con la Pi ' +
        'encendida, que es lo cotidiano), dormido, o desconectado',
      )
    }
    if (e.atascado === true) {
      anota('atasco', 'atasco confirmado por el firmware del RVR: un motor recibe corriente y no gira')
    }
    if (voltios === null) {
      // 🔴 Rule 1 del encargo: la baldosa NO dice «OK» cuando no sabe. Decirlo
      //    en voz alta es mas seguro que callar: asi nadie lee el hueco como
      //    una bateria sana.
      anota(
        'batería: no se sabe',
        'no se sabe la batería: /battery_state no ha traído un voltaje válido (el driver publica NaN ' +
          'cuando la lectura falla). La baldosa NO está diciendo que esté bien',
      )
    } else if (bateria === 'CRITICA') {
      anota('batería CRÍTICA', `batería CRÍTICA: ${enVoltios(voltios)}, por debajo de ${enVoltios(V_CRITICA)}. El RVR se va a apagar`)
    } else if (bateria === 'BAJA') {
      anota('batería baja', `batería baja: ${enVoltios(voltios)}, por debajo de ${enVoltios(V_BAJA)}: toca cargar`)
    }
    if (termicoRancio && frescuraTermico.conocido) {
      anota(
        'temperatura rancia',
        `la temperatura de los motores tiene ${Math.round(frescuraTermico.antiguedadS)} s: el sondeo va ` +
          `cada 30 s, así que por encima de ${UMBRAL_TERMICO_RANCIO_S} s es el MISMO dato repetido, ` +
          'no una temperatura que se mantiene',
      )
    }
  }

  // ── La atencion ─────────────────────────────────────────────────────────
  // 🔴 `IR` exige un hecho positivo Y que ese hecho sea ACTUAL (`datosVigentes`).
  //    Sin latido no se sabe si la ultima lectura es de hace dos segundos o de
  //    hace una hora, y mandar a alguien a cruzar el edificio con un numero
  //    rancio es adivinar. Un robot sin señal ya sale en `MIRAR`, que es
  //    exactamente la accion que deshace la duda: se mira, y si de verdad esta
  //    critico, entonces se va.
  // ⚠️ `termicoRancio` NO sube la atencion a proposito: un RVR cargando deja de
  //    responder al sondeo termico, asi que una tarde normal pondria las 16
  //    baldosas en ambar por el estado mas cotidiano del laboratorio. La bandera
  //    existe para que la interfaz no pinte una temperatura plana como
  //    «estable», no para pedir que alguien vaya.
  // 🔴 `odometriaMuerta` sube a IR, y es el unico de los tres que lo hace: es un
  //    HECHO POSITIVO y actual —el robot afirma que /odom no se completa—, y un
  //    robot con la odometria muerta parece sano por todos los demas caminos.
  // ⚠️ La parada puesta y el RVR sin contestar son MIRAR, no IR: los dos son
  //    estados NORMALES del laboratorio -alguien pulso la parada, alguien puso
  //    el robot a cargar- y mandar a cruzar el aula por ellos gastaria la
  //    credibilidad del aviso que si importa.
  const atencion: AtencionBaldosa =
    datosVigentes && (e.atascado === true || bateria === 'CRITICA' || odometriaMuerta)
      ? 'IR'
      : !datosVigentes || bateria === 'BAJA'
        || paradaEmergencia === true || rvrResponde === false
        ? 'MIRAR'
        : 'NINGUNA'

  return {
    id: e.id,
    estado,
    atencion,
    motivos,
    etiquetas,
    datosVigentes,
    bateria,
    voltios,
    frescuraTermico,
    termicoRancio,
    atascado: e.atascado,
    paradaEmergencia,
    odometriaMuerta,
    rvrResponde,
  }
}
