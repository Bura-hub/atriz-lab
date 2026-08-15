/**
 * Arrancar SLAM y Nav2 desde la web — la LOGICA, sin React.
 *
 * ✅ **VALIDADO CONTRA rvr-01 el 2026-08-09.** Esta cabecera decia «TODO ESTE
 *    FICHERO ES NO VERIFICADO CONTRA EL ROBOT», y era cierto cuando se escribio
 *    —el 07, con el robot cargando—. Ya no:
 *
 *      apagado -> arrancando · 4 · 9 · 14 s -> funcionando    ~18 s
 *      CIEGO    forzado apagando el barrido con SLAM vivo
 *      MUDO     aparecio solo al parar SLAM
 *      parar    funcionando -> MUDO -> apagado
 *
 *    ✅ **Y la OTRA unidad, el 2026-08-10: Nav2**, por el mismo camino de la web
 *    (`/pedir_nav`), que es lo que faltaba — hasta entonces solo se habia visto
 *    SLAM:
 *
 *      apagado -> arrancando · 1..21 s -> FUNCIONANDO         21 s
 *      /pedir_nav responde «peticion ACEPTADA, no arrancado todavia»
 *      parar    funcionando -> MUDO -> apagado
 *
 *    📌 Los 21 s caen dentro del intervalo medido en el robot (24,3 s hasta
 *    aceptar objetivos, ~30 s hasta FUNCIONANDO, n=1 cada uno), asi que el
 *    «~30 s» que pinta la pantalla sigue siendo el numero prudente.
 *    ⚠️ Y **arrancar no es navegar**: se comprobo que llegan `/map`, `/tf` y
 *    `/amcl_pose` —Nav2 puede arrancar mal sin decirlo— pero **no se mando
 *    ningun objetivo**. Eso mueve el robot y es otra sesion.
 *
 *    📝 Y se corrige porque **un «no verificado» que ya no lo es manda a
 *    desconfiar de codigo que funciona**, que gasta la credibilidad de los
 *    avisos que si importan. Es la misma regla que hizo quitar el aviso de «los
 *    LEDs se encienden al arrancar el driver», que llevaba meses siendo falso.
 *
 * ⏳ **Lo que sigue sin ver:** `BLOQUEADO` —inalcanzable desde la web a
 *    proposito: el supervisor se niega antes de llamar a `systemctl`— y
 *    `NO_SE_SABE`, que exige parar el supervisor por SSH.
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
        /*
         * ⚠️ LA SEGUNDA FRASE LA PIDIÓ EL ROBOT, y evita una segunda visita al
         *    laboratorio. Medido por él el 2026-08-11 replicando la unidad
         *    (`StartLimitBurst=3`, `StartLimitIntervalSec=300`): tras el
         *    `reset-failed`, **si la causa sigue ahí la unidad se vuelve a
         *    bloquear a los tres intentos**. O sea que el orden importa —
         *    primero quitar la causa, después desbloquear— y hacerlo al revés
         *    manda a cruzar el edificio dos veces.
         *
         * 📌 La causa concreta, cuando el robot la dice, ya se pinta encima:
         *    `lectura.detalle` sale del `nav_detalle` del supervisor. Aquí NO se
         *    repite ni se adivina cuál es — se dice el ORDEN, que es lo que
         *    vale para cualquier causa.
         */
        /*
         * 🔴🔴 CORREGIDO EL 2026-08-14: ESTE TEXTO MANDABA A SSH SIN HACER FALTA.
         *
         * Decía que «hace falta ejecutar systemctl reset-failed en el robot, con
         * privilegios que el navegador no tiene» — y punto. **El latch no es
         * permanente**: `StartLimitIntervalSec=300`, así que el contador se
         * limpia solo. Medido por el robot (evidencia 112), que es la primera
         * vez que alguien esperó los cinco minutos mirando:
         *
         *   latch a los 92 s · un start en caliente RECHAZADO (control) ·
         *   a los 355 s del último arranque real, `systemctl start` devuelve 0,
         *   la unidad llega a `Started` DE VERDAD y `NRestarts` vuelve a 0.
         *
         * O sea que había un camino que no exige a nadie: **esperar**. Decir
         * sólo «hace falta SSH» manda a buscar a una persona con privilegios en
         * mitad de una clase, para algo que se arregla solo en cinco minutos.
         *
         * ⚠️ El orden sigue siendo lo primero, y ahora más: reintentar SIN
         *    arreglar la causa quema otro presupuesto entero y vuelve a
         *    latchear. La espera no sirve de nada si la causa sigue ahí.
         */
        motivo:
          'La unidad de ' + nombre + ' está bloqueada por systemd, y volver a ' +
          'pulsar ahora mismo no hará nada. Primero QUITA LA CAUSA' +
          (lectura.detalle !== '' ? ' —el robot dice cuál es, justo aquí arriba—' : '') +
          ', porque reintentar sin arreglarla vuelve a bloquear la unidad a los ' +
          'tres intentos. Con la causa resuelta hay dos salidas: esperar unos ' +
          'CINCO MINUTOS desde el último intento, que el bloqueo se limpia solo, ' +
          'o ejecutar «systemctl reset-failed» en el robot, que exige privilegios ' +
          'que el navegador no tiene.',
      }

    case 'ARRANCANDO':
      return {
        accion: null,
        habilitado: false,
        /*
         * 🔴 SIGUE SIN BARRA DE PROGRESO, y ahora con mejor motivo: nadie lo ha
         *    probado con 16 robots y la batería baja. Una barra afirmaría cuánto
         *    FALTA, y eso no se sabe.
         *
         * ✅ Pero sí se puede decir cuánto SUELE tardar, que es lo que impide
         *    que alguien lo dé por colgado a los quince segundos. El número de
         *    Nav2 lo midió el robot EN EL LABORATORIO el 2026-08-13, y con un
         *    hito bien definido —hasta que `/navigate_to_pose` acepta objetivos,
         *    no hasta que aparecen los nodos—: **27,80 y 27,84 s**, n=2 con
         *    0,04 s de diferencia. El de SLAM sale de esta misma web contra
         *    rvr-01 el 2026-08-09.
         *
         * ⚠️ «Suele» es la palabra exacta: son dos medidas en un robot en
         *    reposo. No es una promesa, y por eso no hay cuenta atrás.
         */
        motivo: nombre + ' está arrancando. Medido en UN robot en reposo: unos '
          + (sistema === 'nav' ? '28' : '18')
          + ' segundos. Con la batería baja o varios robots a la vez, no se sabe.',
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

/* ═══════════════════════════════════════════════════════════════════════════
 * EL MAPA: CUÁL ES Y DE CUÁNDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 AQUI NO HAY UMBRAL, Y ESA ES LA DECISION.
 *
 * Lo tentador es «avisar si el mapa tiene más de N días», y el robot propuso 7,
 * por coherencia con `verificar_robot.sh`.
 *
 * ⚠️ Este comentario llegó a decir que **ese umbral no existía**. Es falso, y el
 *    error fue mío: está en `verificar_robot.sh:1459` (`-le 7`), y mi búsqueda
 *    iba tras `7 días` / `604800` / `-mtime +7`, ninguno de los cuales podía
 *    casar con `-le 7` sobre una variable. **Un negativo sacado de una búsqueda
 *    que no podía encontrarlo.**
 *
 * El motivo de fondo para no ponerlo aquí no cambia, y es el bueno: **la edad no
 * mide lo que falla.** El fallo medido no es «el mapa es viejo», es «el mapa NO ES DE
 * ESTE SITIO» —41,3 cm con `SUCCEEDED` y sin una línea de error—, y un mapa de
 * ayer del cuarto equivocado es igual de peligroso que uno de hace un mes. Al
 * revés también: el del aula de la semana pasada está perfecto si nadie movió
 * las mesas.
 *
 * Y `mapa_edad_s` es el `mtime` del fichero: **copiar un mapa viejo lo
 * rejuvenece**. Un semáforo sobre ese número daría verde justo al caso peor.
 *
 * → Por eso la pantalla **no gradúa: pregunta.** Enseña el nombre y la edad
 *   siempre, y deja escrita la pregunta que solo puede contestar quien está
 *   mirando el aula. Es lo que dice el propio `.msg`: «el robot da los dos datos
 *   y **la persona decide**».
 */
export interface Mapa {
  /** `null` si el robot dice que no hay mapa. */
  nombre: string | null
  /** Texto para la persona: «hace 3 días». `null` si no se sabe. */
  edad: string | null
}

/** Segundos → «hace 40 minutos». Sin decimales: aquí no aportan. */
export function edadLegible(segundos: number): string | null {
  // 🔴 Negativo es «no aplica», no «cero segundos». Es la convención del
  //    proyecto entero y ya costó un fallo tratarla como número.
  if (!Number.isFinite(segundos) || segundos < 0) return null
  const min = Math.floor(segundos / 60)
  if (min < 1) return 'hace menos de un minuto'
  if (min < 60) return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

export function leerMapa(msg: MensajeEstadoNavegacion | null, latidoAvanza: boolean): Mapa {
  if (msg === null || !latidoAvanza) return { nombre: null, edad: null }
  const n = typeof msg.mapa_nombre === 'string' && msg.mapa_nombre !== '' ? msg.mapa_nombre : null
  return { nombre: n, edad: edadLegible(msg.mapa_edad_s) }
}
