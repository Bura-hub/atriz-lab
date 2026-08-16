/**
 * ¿ESTÁ ENCENDIDO EL BARRIDO DEL LIDAR? — la decisión, sin React.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LA PANTALLA DE CONDUCIR AFIRMABA QUE ESTABA APAGADO, SIEMPRE
 * ═══════════════════════════════════════════════════════════════════════════
 * `PanelConducir` tenía un `EstadoBarrido` que **no observaba nada del robot**:
 * era estado local de React con lo que acababas de pulsar *en esta sesión*. Su
 * valor por defecto —el de cada carga de página, cada vuelta desde otra pestaña—
 * pintaba esta frase:
 *
 *     «El barrido arranca **apagado** con el robot, a propósito…»
 *
 * Eso es una explicación general **puesta en el hueco donde alguien busca el
 * estado actual**. Enciende el barrido, recarga, y la pantalla vuelve a decir
 * «apagado» sobre un LIDAR que está girando a 11,8 Hz.
 *
 * 👤 Lo pidió el usuario el 2026-08-16 —«que aparezca en algún lugar si el
 *    barrido está encendido o apagado»— y al ir a mirarlo resultó que el hueco
 *    no estaba vacío: estaba **ocupado por una afirmación que puede ser falsa**,
 *    que es peor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 SABERLO DE VERDAD CUESTA 67 kB/s, Y NO SE PAGA AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 * El único testigo directo es `/scan`, que son **66,98 kB/s por robot — el 83 %
 * de todo su tráfico** (`lib/flota/presupuesto.ts`). Con dieciséis pestañas
 * abiertas son ~8,6 Mbit/s en el punto de acceso del aula. El raíl tiene escrito
 * que «Lo que ve» es una pestaña aparte **justo por ese coste**: la suscripción
 * tiene que morir al salir.
 *
 * → Aquí se compone con lo que ya es GRATIS en Conducir:
 *   · lo que la persona ha pulsado en esta sesión, y
 *   · `/collision_monitor_state`, que ya está suscrito y dice
 *     `polygon_name: 'invalid source'` cuando no le llega el barrido.
 *
 * ⚠️ Y el monitor tiene un límite duro que hay que respetar: **solo publica
 *    cuando procesa una orden de movimiento**. Con el robot quieto no llega
 *    nada, y eso es «no se sabe» — nunca «encendido».
 */

import { textoDeConfirmacion } from '@/lib/interfaz/lenguaje'

/** Lo que se ha pedido DESDE ESTA PESTAÑA. Memoria, no observación. */
export type Pedido =
  | { clase: 'NADA' }
  | { clase: 'ARRANCANDO' }
  /** Confirmado por un `/scan` real a esa hora, no por el retorno del servicio. */
  | { clase: 'ARRANCADO'; hora: string }
  | { clase: 'PARADO'; hora: string }
  | { clase: 'FALLO'; detalle: string; hora: string }

/**
 * Lo que dice la capa de seguridad. `NO_SE_SABE` es el caso NORMAL con el robot
 * quieto: el monitor solo habla cuando procesa una orden.
 */
export type Monitor = 'FALTA_BARRIDO' | 'HAY_BARRIDO' | 'NO_SE_SABE'

export interface Veredicto {
  clase: 'SIN_BARRIDO' | 'ENCENDIDO' | 'ARRANCANDO' | 'FALLO' | 'NO_SE_SABE'
  /** Corto, para la insignia. En minúsculas: lo pone en versalitas el CSS. */
  titulo: string
  /** Una frase. Dice de dónde sale el veredicto, que es lo que lo hace creíble. */
  detalle: string
  /** `true` solo cuando hay OBSERVACIÓN del robot, no memoria de esta pestaña. */
  enVivo: boolean
}

/**
 * 🔴 EL ORDEN DE PRECEDENCIA ES LO ÚNICO QUE IMPORTA AQUÍ, y no es arbitrario:
 *    **una observación del robot gana siempre a una memoria de esta pestaña.**
 *
 * Si pulsaste «arrancar» hace cinco minutos y el monitor dice ahora mismo que no
 * le llega el barrido, lo cierto es lo segundo — alguien pudo pararlo desde otra
 * pestaña, desde `atriz-escaneo`, o el LIDAR pudo desenchufarse (que en este
 * proyecto pasa: es un gesto cotidiano y deja el nodo agarrado a un descriptor
 * muerto). Dar prioridad a lo que yo recuerdo sería exactamente el fallo que
 * este repositorio persigue: afirmar un estado sin mirarlo.
 */
export function resumirBarrido(pedido: Pedido, monitor: Monitor): Veredicto {
  if (monitor === 'FALTA_BARRIDO') {
    return {
      clase: 'SIN_BARRIDO',
      titulo: 'sin barrido',
      detalle: 'La capa de seguridad está bloqueando el movimiento porque no le llega /scan. '
        + 'Lo dice el propio robot, ahora mismo.',
      enVivo: true,
    }
  }

  /*
   * ⚠️ ARRANCANDO va ANTES que `HAY_BARRIDO`, y es deliberado: mientras se
   *    espera el primer `/scan` real, decir «encendido» adelantaría un final que
   *    todavía no se conoce. `arrancarBarrido()` existe precisamente porque
   *    `/start_scan` puede devolver éxito con el puerto del LIDAR muerto.
   */
  if (pedido.clase === 'ARRANCANDO') {
    return {
      clase: 'ARRANCANDO',
      titulo: 'arrancando',
      detalle: 'Esperando un /scan de verdad, no la respuesta del servicio: /start_scan ha '
        + 'devuelto éxito con el puerto del LIDAR muerto.',
      enVivo: false,
    }
  }

  if (monitor === 'HAY_BARRIDO') {
    return {
      clase: 'ENCENDIDO',
      titulo: 'encendido',
      detalle: 'La capa de seguridad ha procesado una orden y no se ha quejado de la fuente, '
        + 'así que le está llegando /scan.',
      enVivo: true,
    }
  }

  if (pedido.clase === 'FALLO') {
    return {
      clase: 'FALLO',
      titulo: 'no arrancó',
      /*
       * 🔴 LA FRASE PROPIA VA SIEMPRE, Y EL MOTIVO CRUDO SE AÑADE. Esto era
       *    `${detalle} · ${hora}` a secas, y lo cazó el barrido de las quince
       *    combinaciones: con un mensaje de error corto —o vacío, que es lo que
       *    da un `throw` sin texto— el detalle se quedaba en nueve caracteres y
       *    la tarjeta no decía nada.
       *
       * 📌 Misma familia que el resto de este fichero: un hueco con aspecto de
       *    información. Y lo encontró un control de invariantes, no un caso
       *    representativo — que es justo para lo que están.
       */
      detalle: `Se pidió arrancar a las ${pedido.hora} y no llegó ningún /scan. `
        + `Lo que dijo el robot: ${pedido.detalle.trim() === '' ? '(nada)' : pedido.detalle}`,
      enVivo: false,
    }
  }

  if (pedido.clase === 'ARRANCADO') {
    return {
      clase: 'ENCENDIDO',
      titulo: 'arrancado por ti',
      detalle: `Confirmado por un /scan real a las ${pedido.hora}. No se está leyendo en vivo: `
        + 'si alguien lo hubiera parado después, esta pantalla no se enteraría hasta mover el robot.',
      enVivo: false,
    }
  }

  if (pedido.clase === 'PARADO') {
    return {
      clase: 'NO_SE_SABE',
      titulo: 'parado por ti',
      /*
       * 🔴 `NO_SE_SABE` Y NO «APAGADO», aunque lo hayas pedido tú. `/stop_scan`
       *    es `std_srvs/Empty`: `textoDeConfirmacion` lo clasifica como
       *    `NINGUNA` — «este servicio responde vacío: no llega ni un bit que
       *    diga qué pasó en el robot». Pedir no es conseguir, y esta aplicación
       *    tiene cinco fallos de la parada de emergencia detrás de esa regla.
       */
      detalle: `Se pidió /stop_scan a las ${pedido.hora}, y ${textoDeConfirmacion('/stop_scan')} `
        + 'El tambor tampoco se detiene del todo: baja de 11,8 Hz a 2,7, que es su reposo.',
      enVivo: false,
    }
  }

  /*
   * 🔴 EL CASO POR DEFECTO, Y ES EL QUE MÁS SE VE. Aquí vivía la frase que
   *    afirmaba «apagado». Ahora dice lo único cierto —que no se sabe— y **por
   *    qué** no se sabe, que es lo que evita que se lea como una avería.
   */
  return {
    clase: 'NO_SE_SABE',
    titulo: 'no se sabe',
    detalle: 'Nadie ha pedido nada desde esta pestaña, y leer el estado en vivo costaría /scan '
      + '—el 83 % del tráfico del robot—. La capa de seguridad lo dirá en cuanto intentes mover.',
    enVivo: false,
  }
}
