/*
 * 🔴 AQUI NO SE ESCRIBE MARKDOWN. Estas cadenas se pintan como TEXTO PLANO, no
 *    como JSX ni como markdown: un backtick sale como backtick y un `**` sale
 *    como dos asteriscos. Llevaban asi desde que se escribio la pantalla, en la
 *    que mas importa —la que lee un alumno cuyo robot no obedece—, y no lo vio
 *    ninguna de las 538 pruebas: ninguna miraba lo que se VE.
 *    Lo destapo la guardia de `pantallas_reales.test.ts`, el 2026-08-07.
 *    → Para enfatizar, MAYUSCULAS. Para citar un comando, «comillas».
 */

/**
 * POR QUÉ NO OBEDECE. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL FALLO MEJOR DOCUMENTADO DE ESTE PROYECTO, Y NO TENÍA PANTALLA
 * ═══════════════════════════════════════════════════════════════════════════
 * «El robot no se mueve y todo parece sano» es la familia de fallo que el
 * `CLAUDE.md` del laboratorio persigue de punta a punta: el nodo vivo y mudo,
 * el RVR dormido con los topics registrados, `systemctl` en verde con el driver
 * muerto, el descriptor del LIDAR apuntando a un `/dev/ttyUSB0 (deleted)`.
 *
 * Hasta ahora, quien se lo encontraba tenía que saberse las trampas de memoria
 * o entrar por SSH. Esta lógica pone en pantalla, **en orden de probabilidad**,
 * lo que el robot ya está diciendo por `/estado_robot` y `/scan`.
 *
 * ⚠️ Esta pantalla la propuso el análisis multiagente, no el encargo: salió de
 *    las lentes de «quien monta» y «seguridad» a la vez.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE ESTO **NO** HACE, Y ES LA MITAD DEL DISEÑO
 * ═══════════════════════════════════════════════════════════════════════════
 * **No elige una causa.** Devuelve todas las que encajan, cada una con su
 * estado —CONFIRMADA, POSIBLE o DESCARTADA— y con lo que hay que hacer.
 *
 * Elegir una sería exactamente el error que este proyecto ya pagó cuatro veces:
 * la auditoría culpó al bucle de asyncio de una odometría a 4 Hz y la causa era
 * un parámetro; «confirmado por tres vías independientes» resultó ser una vía
 * contada tres veces. Cuando dos causas encajan con los datos, **el dato es que
 * encajan dos**.
 */

/** Lo que se sabe del robot en este instante. `null` = no ha llegado. */
export interface EntradaNoObedece {
  /** ¿Hay WebSocket? Sin esto no se sabe nada de nada. */
  conectado: boolean
  /** De `/estado_robot`. `null` si el topic no ha traído nada. */
  paradaEmergencia: boolean | null
  rvrResponde: boolean | null
  /** Segundos desde la última muestra de `/odom`. `-1` = nunca se supo. */
  antiguedadOdomS: number | null
  reanudacionesFallidas: number | null
  /** ¿Ha llegado algún `/scan` desde que se abrió esta pantalla? */
  hayBarrido: boolean
  /** ms desde el último `/scan`. `null` si no llegó ninguno. */
  msDesdeBarrido: number | null
  /** ¿Está la pestaña en segundo plano ahora mismo? */
  pestanaOculta: boolean
  /**
   * ¿Hay sesión iniciada? Cambia **el remedio de la parada**, no el veredicto.
   *
   * 🔴 Sin sesión no se menciona ningún botón. Un remedio que dice «pulsa» a
   *    quien no puede pulsar es peor que no decir nada: manda a buscar un
   *    control que no está en la pantalla, y quien lo busca concluye que la
   *    interfaz está rota.
   *
   * ⚠️ Opcional para no romper a quien ya llamaba a `diagnosticar()`. Ausente
   *    equivale a **sin sesión**, que es el lado que no ofrece nada.
   */
  haySesion?: boolean
}

export type EstadoCausa = 'CONFIRMADA' | 'POSIBLE' | 'DESCARTADA' | 'NO_SE_SABE'

export interface Causa {
  id: string
  titulo: string
  estado: EstadoCausa
  /** Qué se ha mirado para decirlo. Sin esto, el veredicto es una opinión. */
  evidencia: string
  /** Qué hacer. Vacío cuando no hay nada que hacer. */
  remedio: string
}

/**
 * 🔴 SIN `/scan`, EL `collision_monitor` BLOQUEA EL MOVIMIENTO POR COMPLETO.
 *
 * Medido: 0,0 cm de desplazamiento contra 9,9 del control. Y el barrido del
 * LIDAR **arranca apagado a propósito** en los 16 robots, así que este es el
 * primer sospechoso de todos y no un caso raro.
 */
export const UMBRAL_BARRIDO_MS = 1500

/** El vigilante del driver corta el movimiento a los 0,3 s sin `cmd_vel`. */
export const UMBRAL_ODOM_MUERTA_S = 3

export function diagnosticar(e: EntradaNoObedece): Causa[] {
  const causas: Causa[] = []

  if (!e.conectado) {
    return [{
      id: 'sin-enlace',
      titulo: 'No hay enlace con el robot',
      estado: 'CONFIRMADA',
      evidencia: 'El WebSocket no está abierto, así que no se sabe nada del robot.',
      remedio: 'Comprueba la dirección en el muro, y que el robot esté encendido.',
    }]
  }

  // ── 1 · La parada de emergencia ────────────────────────────────────────────
  causas.push(e.paradaEmergencia === null
    ? {
      id: 'parada',
      titulo: 'La parada de emergencia',
      estado: 'NO_SE_SABE',
      evidencia: 'El topic /estado_robot no ha traído nada, así que la bandera del driver no se conoce.',
      remedio: '',
    }
    : e.paradaEmergencia
      ? {
        id: 'parada',
        titulo: 'La parada de emergencia está puesta',
        estado: 'CONFIRMADA',
        evidencia: 'La bandera del driver vale `true`: el robot descarta todo `cmd_vel_raw`.',
        /*
         * ⚠️ ESTE REMEDIO DEPENDE DE LA SESIÓN, y es la única cosa de todo el
         *    diagnóstico que lo hace. El veredicto NO cambia: la parada está
         *    puesta lo mire quien lo mire. Lo que cambia es qué puede hacer
         *    quien está delante.
         *
         * 📝 Antes decía «Esta pantalla no lo hace» a secas, porque no había
         *    forma de liberarla desde aquí. Hoy la hay, con sesión, y el peligro
         *    que lo impedía está cerrado y medido: liberar con un objetivo de
         *    Nav2 vivo hacía que el robot arrancara solo —34,7 cm—, y el nodo
         *    `cancelar_nav2` lo dejó en 0,0 con control.
         */
        remedio: e.haySesion === true
          ? 'Puedes liberarla desde aquí, en el botón de abajo: hay que escribir el nombre del '
            + 'robot para confirmar. Si no estás viendo el robot, ve a mirarlo antes.'
          : 'Se libera en el laboratorio, junto al robot. Desde la web hace falta iniciar sesión.',
      }
      : {
        id: 'parada',
        titulo: 'La parada de emergencia',
        estado: 'DESCARTADA',
        evidencia: 'La bandera del driver vale `false`.',
        remedio: '',
      })

  // ── 2 · El barrido del LIDAR ───────────────────────────────────────────────
  const barridoVigente = e.hayBarrido
    && e.msDesdeBarrido !== null && e.msDesdeBarrido < UMBRAL_BARRIDO_MS
  causas.push(barridoVigente
    ? {
      id: 'barrido',
      titulo: 'El barrido del LIDAR',
      estado: 'DESCARTADA',
      evidencia: '`/scan` está llegando, así que la capa de seguridad tiene con qué trabajar.',
      remedio: '',
    }
    : {
      id: 'barrido',
      titulo: 'El barrido del LIDAR está parado',
      estado: 'CONFIRMADA',
      evidencia:
        'No llega /scan. Sin él la capa de seguridad BLOQUEA EL MOVIMIENTO POR '
        + 'COMPLETO: medido, 0,0 cm contra 9,9 del control. Y el barrido arranca '
        + 'apagado a propósito en los 16 robots.',
      remedio: 'Enciéndelo en la pestaña Conducir, o con «atriz-escaneo on» en el robot.',
    })

  // ── 3 · El RVR contesta ────────────────────────────────────────────────────
  if (e.rvrResponde === null) {
    causas.push({
      id: 'rvr',
      titulo: 'Si el RVR contesta',
      estado: 'NO_SE_SABE',
      evidencia: 'El topic /estado_robot no ha traído nada.',
      remedio: '',
    })
  } else if (!e.rvrResponde) {
    /*
     * ⚠️ CARGANDO y DORMIDO se ven IGUAL desde aquí, y no se elige entre los
     *    dos. `reanudaciones_fallidas` inclina la balanza —con el RVR apagado se
     *    midieron 123 reintentos, uno cada 4 s— pero sus umbrales no están
     *    caracterizados, así que se enseña el número y decide quien mira.
     */
    causas.push({
      id: 'rvr',
      titulo: 'El RVR no contesta',
      estado: 'CONFIRMADA',
      evidencia: e.reanudacionesFallidas !== null && e.reanudacionesFallidas > 0
        ? `El driver lleva ${e.reanudacionesFallidas} reanudaciones fallidas. `
          + 'Puede estar cargando (RVR apagado con la Pi encendida) o dormido.'
        : 'La Raspberry Pi responde pero el RVR no. Puede estar cargando o dormido.',
      remedio: 'Mira el robot: si está en el cargador, es normal. Si no, apágalo y enciéndelo.',
    })
  } else {
    causas.push({
      id: 'rvr',
      titulo: 'El RVR contesta',
      estado: 'DESCARTADA',
      evidencia: 'El driver está hablando con la bola.',
      remedio: '',
    })
  }

  // ── 4 · La odometría ───────────────────────────────────────────────────────
  const a = e.antiguedadOdomS
  causas.push(a === null || a < 0
    ? {
      id: 'odom',
      titulo: 'La odometría',
      estado: 'NO_SE_SABE',
      evidencia: a === null
        ? 'El topic /estado_robot no ha traído nada.'
        : 'La antigüedad vale `-1`, que significa *nunca se ha sabido nada de eso*.',
      remedio: '',
    }
    : a > UMBRAL_ODOM_MUERTA_S
      ? {
        id: 'odom',
        titulo: 'La odometría está muerta con el enlace vivo',
        estado: 'CONFIRMADA',
        evidencia: `La última muestra de \`/odom\` tiene ${a.toFixed(1)} s. `
          + 'Es el caso en el que el robot parece sano por todos lados y no lo está.',
        remedio: 'Reinicia el servicio en el robot: `sudo systemctl restart atriz-robot`.',
      }
      : {
        id: 'odom',
        titulo: 'La odometría',
        estado: 'DESCARTADA',
        evidencia: `Llega \`/odom\` desde hace ${a.toFixed(1)} s.`,
        remedio: '',
      })

  // ── 5 · La pestaña en segundo plano ────────────────────────────────────────
  if (e.pestanaOculta) {
    causas.push({
      id: 'pestana',
      titulo: 'Esta pestaña está en segundo plano',
      estado: 'CONFIRMADA',
      evidencia:
        'El navegador limita los temporizadores a ~1 Hz cuando la pestaña no se ve, '
        + 'y el vigilante del driver corta el movimiento a los 0,3 s sin órdenes.',
      remedio: 'Vuelve a esta pestaña antes de conducir. Es el lado seguro, pero sorprende.',
    })
  }

  return causas
}

/**
 * El titular de la pantalla: cuántas causas están confirmadas.
 *
 * 🔴 Nunca dice «el robot está bien». Que ninguna de las cinco causas conocidas
 *    encaje **no prueba que el robot obedezca**: solo que no es ninguna de las
 *    que esta pantalla sabe mirar.
 */
export function resumen(causas: readonly Causa[]): string {
  const n = causas.filter((c) => c.estado === 'CONFIRMADA').length
  if (n === 0) return 'Ninguna de las causas conocidas encaja'
  if (n === 1) return 'Una causa encaja'
  return `${n} causas encajan a la vez`
}
