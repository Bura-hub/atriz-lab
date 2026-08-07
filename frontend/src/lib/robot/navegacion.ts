/**
 * Arrancar SLAM y Nav2 desde la web — la LOGICA, sin React.
 *
 * ⚠️ **TODO ESTE FICHERO ES NO VERIFICADO CONTRA EL ROBOT.** Se escribio el
 *    2026-08-07 con el `.msg` del supervisor delante, y el robot esta apagado
 *    cargando. El supervisor se estrena con este mensaje: hasta que corra, lo
 *    unico probado aqui son las funciones puras contra sus propias pruebas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTO NO ES UN INTERRUPTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * Un `slam: on|off` es lo que pide el cuerpo, y pintaria VERDE el caso que este
 * proyecto ya pago: `systemctl is-active` dice `active` sobre un `slam_toolbox`
 * que sobrevivio a un reinicio del driver con el bufer TF roto —deja de
 * procesar, y **el mapa sale identico celda a celda tras mover el robot 80 cm**.
 *
 * Son seis estados porque hay seis situaciones distintas para la persona que
 * mira la pantalla, y dos de ellas (CIEGO, MUDO) son indistinguibles de
 * FUNCIONANDO si solo se mira si la unidad esta levantada.
 */

import { ESTADO_NAV, type MensajeEstadoNavegacion } from '@/hooks/useTopic'

/** Cual de los dos sistemas. Se pasa como dato para no duplicar la logica. */
export type Sistema = 'slam' | 'nav'

/**
 * Lo que la pantalla puede pintar. `'NO_SE_SABE'` es un valor de primera clase,
 * no un hueco: es lo que se pinta cuando el latido no avanza, y NO es lo mismo
 * que APAGADO.
 */
export type Pintado =
  | 'NO_SE_SABE'
  | 'APAGADO'
  | 'ARRANCANDO'
  | 'FUNCIONANDO'
  | 'CIEGO'
  | 'MUDO'
  | 'FALLO'
  | 'BLOQUEADO'

export interface Lectura {
  pintado: Pintado
  /** Del robot, TAL CUAL. Vacio si no dijo nada. Nunca se reescribe aqui. */
  detalle: string
  /** Segundos arrancando, o `null` si no aplica (el robot manda -1.0). */
  arrancandoS: number | null
  hayMapa: boolean
}

/**
 * 🔴 EL LATIDO MANDA SOBRE TODO LO DEMAS.
 *
 * `/estado_navegacion` va TRANSIENT_LOCAL, asi que el primer mensaje que llega
 * al suscribirse puede ser un **enlatado de hace media hora** con el supervisor
 * ya muerto. Y aunque el supervisor muera, el ultimo mensaje se queda ahi: sin
 * esta comprobacion la pantalla pintaria «FUNCIONANDO» sobre un robot que no
 * tiene a nadie detras.
 *
 * Es la misma trampa que costo el arreglo de `LiberarParada`: el primer mensaje
 * sirve de REFERENCIA, y hace falta uno con `latido` estrictamente mayor para
 * afirmar nada.
 *
 * @param msg      el ultimo mensaje, o `null` si no ha llegado ninguno
 * @param latidoDeReferencia el `latido` de hace `VENTANA_LATIDO_MS`
 */
export function leer(
  msg: MensajeEstadoNavegacion | null,
  sistema: Sistema,
  latidoAvanza: boolean,
): Lectura {
  if (msg === null || !latidoAvanza) {
    return { pintado: 'NO_SE_SABE', detalle: '', arrancandoS: null, hayMapa: false }
  }

  const crudo = sistema === 'slam' ? msg.slam : msg.nav
  const detalle = sistema === 'slam' ? msg.slam_detalle : msg.nav_detalle
  const latcheado = sistema === 'slam' ? msg.slam_latcheado : msg.nav_latcheado
  const segundos = sistema === 'slam' ? msg.slam_arrancando_s : msg.nav_arrancando_s

  /*
   * 🔴 `latcheado` GANA A `FALLO`, y el orden importa.
   *    Los dos se pintan de rojo, pero solo uno se arregla desde el navegador.
   *    «Fallo» invita a volver a pulsar; `latcheado` significa que volver a
   *    pulsar **no hara nada** hasta que alguien entre por SSH. Confundirlos es
   *    dejar al alumno dandole a un boton muerto.
   */
  const pintado: Pintado = latcheado
    ? 'BLOQUEADO'
    : crudo === ESTADO_NAV.APAGADO ? 'APAGADO'
    : crudo === ESTADO_NAV.ARRANCANDO ? 'ARRANCANDO'
    : crudo === ESTADO_NAV.FUNCIONANDO ? 'FUNCIONANDO'
    : crudo === ESTADO_NAV.CIEGO ? 'CIEGO'
    : crudo === ESTADO_NAV.MUDO ? 'MUDO'
    : crudo === ESTADO_NAV.FALLO ? 'FALLO'
    // DESCONOCIDO del robot y cualquier valor que no reconozcamos caen aqui.
    // 🔴 Un `default` que cayera en APAGADO convertiria «no lo se» en una
    //    afirmacion, que es exactamente lo que esta interfaz no hace.
    : 'NO_SE_SABE'

  return {
    pintado,
    detalle,
    // -1.0 es «no aplica». Cualquier negativo se trata igual: no se inventa un 0.
    arrancandoS: segundos >= 0 ? segundos : null,
    hayMapa: msg.hay_mapa,
  }
}

/**
 * 🔴 CUANTO PUEDE TARDAR EL LATIDO EN AVANZAR ANTES DE DESCONFIAR.
 *
 * El supervisor publica a **1 Hz**. Este umbral se expresa en **mensajes
 * perdidos** y se traduce con el periodo de SU topic —no se copia de otro—,
 * porque este proyecto ya midio lo que pasa al mudar una cifra de sitio: los
 * 3000 ms de `salud.ts` estan calibrados contra `/odom` a 16,5 Hz, o sea **50
 * mensajes**; los mismos 3000 ms aqui serian **tres**, y pintarian «no se sabe»
 * al primer hipo de WiFi.
 *
 * 5 mensajes a 1 Hz. Es deliberadamente distinto de `UMBRAL_SILENCIO_MS`.
 */
export const MENSAJES_PERDIDOS_TOLERADOS = 5
export const PERIODO_SUPERVISOR_MS = 1000
export const UMBRAL_LATIDO_NAV_MS = MENSAJES_PERDIDOS_TOLERADOS * PERIODO_SUPERVISOR_MS

export interface Boton {
  /** Que hace el boton principal si se pulsa. `null` = no se ofrece pulsar. */
  accion: 'ARRANCAR' | 'PARAR' | null
  habilitado: boolean
  /** Por que no se puede pulsar. Vacio si se puede. Se pinta tal cual. */
  motivo: string
}

/**
 * Decide el boton. 🔴 **Deshabilitar sin decir por que es peor que no tener
 * boton**: un control gris y mudo se lee como un fallo de la web.
 */
export function decidirBoton(lectura: Lectura, sistema: Sistema): Boton {
  const nombre = sistema === 'slam' ? 'SLAM' : 'Nav2'

  switch (lectura.pintado) {
    case 'NO_SE_SABE':
      return {
        accion: null,
        habilitado: false,
        motivo:
          'No llega el estado del supervisor, así que no se sabe si ' + nombre +
          ' está corriendo. Arrancarlo a ciegas podría levantar dos veces lo mismo.',
      }

    case 'BLOQUEADO':
      return {
        accion: null,
        habilitado: false,
        // 🔴 Este texto es el que evita la llamada de telefono. Dice QUE hacer y
        //    QUIEN puede hacerlo, no «error».
        // 🔴 SIN BACKTICKS. Esto se pinta como TEXTO PLANO, no como markdown, y
        //    en la captura salieron como caracteres: «hace falta `systemctl
        //    reset-failed`». Se ve al mirar la pantalla, no al leer el código.
        motivo:
          'La unidad de ' + nombre + ' está bloqueada por systemd, y volver a ' +
          'pulsar no hará nada: hace falta ejecutar «systemctl reset-failed» en ' +
          'el robot, con privilegios que el navegador no tiene.',
      }

    case 'ARRANCANDO':
      return {
        accion: null,
        habilitado: false,
        // Sin barra de progreso: 24,3 s es una medida en reposo (n=2) y nadie la
        // ha probado con 16 robots y la bateria baja. Una barra afirmaria cuanto
        // falta, y eso no se sabe.
        motivo: nombre + ' está arrancando.',
      }

    case 'APAGADO':
    case 'FALLO':
      if (sistema === 'nav' && !lectura.hayMapa) {
        return {
          accion: 'ARRANCAR',
          habilitado: false,
          motivo:
            'Nav2 necesita un mapa guardado y el robot dice que no lo hay. ' +
            'Primero mapea el aula con SLAM y guárdalo.',
        }
      }
      return { accion: 'ARRANCAR', habilitado: true, motivo: '' }

    /*
     * 🔴 LOS TRES DE ABAJO OFRECEN **PARAR**, INCLUIDOS CIEGO Y MUDO.
     *    Que este roto no significa que no este ocupando el puerto, la CPU y el
     *    arbol TF. Un `slam_toolbox` MUDO es justo el que hay que parar: sigue
     *    publicando `map -> odom` y parte el arbol si alguien levanta AMCL.
     */
    case 'FUNCIONANDO':
    case 'CIEGO':
    case 'MUDO':
      return { accion: 'PARAR', habilitado: true, motivo: '' }
  }
}

/**
 * El texto de estado. Se separa del boton a proposito: la frase describe lo que
 * SE SABE, el boton lo que SE PUEDE HACER, y no siempre coinciden —CIEGO se
 * describe como un problema y ofrece un boton perfectamente pulsable—.
 */
export function frase(lectura: Lectura, sistema: Sistema): string {
  const nombre = sistema === 'slam' ? 'SLAM' : 'Nav2'
  switch (lectura.pintado) {
    case 'NO_SE_SABE':
      return 'no se sabe'
    case 'APAGADO':
      return 'apagado'
    case 'ARRANCANDO':
      return lectura.arrancandoS === null
        ? 'arrancando'
        : `arrancando · ${lectura.arrancandoS.toFixed(0)} s`
    case 'FUNCIONANDO':
      return 'funcionando'
    // 🔴 Las dos frases que un interruptor no puede decir. Describen el SINTOMA
    //    que vera quien esté mirando el robot, porque es lo que hace que la
    //    persona relacione la pantalla con lo que tiene delante.
    case 'CIEGO':
      return 'levantado, pero no le llega el barrido — el robot no conducirá'
    case 'MUDO':
      return 'levantado, y no está procesando — el mapa no crecerá'
    case 'FALLO':
      return `${nombre} falló`
    case 'BLOQUEADO':
      return 'bloqueado por systemd'
  }
}

/**
 * El tono. 🔴 CIEGO y MUDO son `MAL`, no `AVISO`: con SLAM ciego el robot **no
 * conduce** (0,0 cm medidos contra 9,9 con el mismo comando), que para el alumno
 * es indistinguible de una averia. Pintarlo de ambar lo dejaria esperando.
 */
export function tono(p: Pintado): 'BIEN' | 'AVISO' | 'MAL' | 'NEUTRO' {
  switch (p) {
    case 'FUNCIONANDO': return 'BIEN'
    case 'ARRANCANDO': return 'AVISO'
    case 'CIEGO':
    case 'MUDO':
    case 'FALLO':
    case 'BLOQUEADO': return 'MAL'
    case 'APAGADO':
    case 'NO_SE_SABE': return 'NEUTRO'
  }
}
