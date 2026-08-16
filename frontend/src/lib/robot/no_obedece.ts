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
   * Lo último de `/collision_monitor_state`, o `null` si no ha llegado nada.
   *
   * 🔴 `null` NO ES «no está frenando». El monitor publica **al cambiar**, no
   *    cada tanto: con el robot quieto no llega ni un mensaje (0 en 12 s
   *    medidos). «Sin mensaje» es «no se sabe», y decir lo contrario sería
   *    descartar la causa MÁS probable de que un avance salga corto.
   */
  frenadoMonitor?: { accion: number; poligono: string } | null
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
  /**
   * De `/estado_ir.conduciendo_por_ir`. `null` si el topic no ha traído nada.
   *
   * 🔴 ES EL UNICO SITIO DEL QUE ESTA WEB PUEDE SACARLO. `following` y `evading`
   *    son modos del FIRMWARE del RVR: el robot conduce solo, sin pasar por
   *    `cmd_vel`, así que el vigilante del driver no los ve y el
   *    `collision_monitor` tampoco. Hasta el 2026-08-11 nada en ROS se enteraba.
   *
   * ⚠️ Opcional, como `haySesion`, para no romper a quien ya llamaba a
   *    `diagnosticar()`. Ausente equivale a «no se sabe», que es el lado que no
   *    afirma nada.
   */
  conduciendoPorIR?: boolean | null
  /**
   * ¿Hay un programa del Taller corriendo en este robot?
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 ES LA CAUSA MÁS COMÚN DE UN AULA, Y ESTA PANTALLA NO LA MIRABA
   * ═══════════════════════════════════════════════════════════════════════════
   * Un programa de alumno publica en **el mismo `/cmd_vel_raw`** que la palanca:
   * si hay uno corriendo, el robot obedece — pero a otro. Y el caso peor no es
   * el propio: es el de OTRO alumno sobre el mismo robot, porque entonces quien
   * mira esta pantalla no tiene ni idea de que hay alguien más.
   *
   * ⚠️ `undefined` = **no se sabe desde aquí**, y es el valor normal hoy. El
   *    estado del programa vive en el agente del Taller (puerto 9443), que es
   *    OTRO enlace: esta pantalla no lo tiene abierto, y abrirlo costaría un
   *    socket y un testigo por robot solo para diagnosticar.
   *
   * 🔴 Por eso la causa se lista igualmente, en `NO_SE_SABE`, con el remedio de
   *    ir a mirarlo. Callarla porque no se puede medir sería peor: quien
   *    enumera causas y omite la más frecuente hace que la lista **parezca
   *    completa** cuando no lo está. Es la regla de esta pantalla —«nunca dice
   *    que el robot esté bien»— aplicada a su propio alcance.
   */
  programaDelTaller?: { corriendo: boolean; sujeto: string | null } | null
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

/**
 * `action_type = 3` del `collision_monitor`: APPROACH.
 *
 * ⚠️ Se declara aquí en vez de importar `ACCION_MONITOR` para que este módulo
 * siga sin depender de nada —es lo que dice su cabecera y lo que permite
 * probarlo sin React—. **Una prueba lo ata al enum real**, así que no puede
 * quedarse atrás si el `.msg` del robot cambia.
 */
export const ACCION_APROXIMACION = 3

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

  /*
   * ── 0 · EL ROBOT SE ESTÁ MOVIENDO SOLO ─────────────────────────────────────
   *
   * 🔴🔴 VA PRIMERO PORQUE CAMBIA LA LECTURA DE TODO LO DEMÁS. Quien abre esta
   * pantalla cree que el robot está quieto; si se está moviendo por infrarrojos,
   * el resto del diagnóstico responde a una pregunta que no es la suya.
   *
   * Solo se añade cuando OCURRE, igual que la pestaña en segundo plano. Una
   * tarjeta permanente diciendo «no está conduciendo por infrarrojos» sería
   * ruido en las dieciséis pantallas que no lo hacen nunca.
   *
   * ⚠️ Y es `POSIBLE`, no `CONFIRMADA`, con toda intención: **que se esté
   * moviendo es un hecho** —sale de `get_active_control_system_id() == 8`, o sea
   * de lo que el firmware está haciendo, no de lo que se le pidió— pero que eso
   * sea LA CAUSA de que no obedezca **no está medido**. Marcarlo confirmado
   * sería la mentira de precisión que este proyecto ya pagó con «confirmado por
   * tres vías independientes» resultando ser una vía contada tres veces.
   */
  if (e.conduciendoPorIR === true) {
    causas.push({
      id: 'ir',
      titulo: 'El robot se está moviendo SOLO, por infrarrojos',
      estado: 'POSIBLE',
      evidencia:
        'El robot informa de que lo está conduciendo su firmware por infrarrojos. Eso NO pasa por '
        + 'cmd_vel, así que ni el vigilante ni la capa de seguridad lo ven, y esta web no lo sabría '
        + 'si el robot no lo dijera. Que se mueva es seguro; que sea la razón de que ignore tus '
        + 'órdenes NO está medido.',
      remedio:
        'Se para en el robot, no desde aquí: los servicios que ponen y quitan ese modo están '
        + 'CERRADOS a propósito en la lista blanca, porque conducen saltándose la capa de seguridad '
        + 'y cualquiera del aula podría usarlos. Ve a mirar el robot antes de nada.',
    })
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
        evidencia: 'La bandera del driver vale true: el robot descarta todo lo que se publique en cmd_vel_raw.',
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
        evidencia: 'La bandera del driver vale false.',
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
      evidencia: 'Está llegando /scan, así que la capa de seguridad tiene con qué trabajar.',
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

  /*
   * ── 2b · La capa de seguridad frenando ─────────────────────────────────────
   *
   * 🔴🔴 EL CASO QUE FALTABA, Y ES EL QUE MÁS SE PARECE A «NO OBEDECE».
   *
   * Medido el 2026-08-08 corriendo la misma práctica dos veces sin tocar nada:
   * `avanzar(0.20, 3)` dio **26,4 cm** y **59,5 cm**. No es un fallo —es la capa
   * de seguridad frenando al 40 %— pero **el journal lo registra y el alumno no
   * ve nada**, así que la conclusión natural es que el robot no le hace caso.
   *
   * El dato que lo explica es el ANCHO: `Precaucion` mide 60 × **40 cm**,
   * centrado en un robot de 21,7 de ancho. Cualquier cosa a menos de ~9 cm de un
   * COSTADO lo frena, **aunque el robot se esté alejando de ella**.
   */
  const fm = e.frenadoMonitor
  if (fm === undefined || fm === null) {
    causas.push({
      id: 'frenado',
      titulo: 'Si la capa de seguridad te está frenando',
      estado: 'NO_SE_SABE',
      evidencia:
        'El monitor de colisión publica solo cuando cambia, así que con el robot quieto no '
        + 'llega ningún mensaje. No haber recibido nada NO significa que no esté frenando.',
      remedio: 'Manda al robot adelante y mira si aparece un aviso en la pestaña Conducir.',
    })
  } else if (fm.accion === 1) {
    causas.push({
      id: 'frenado',
      titulo: 'La capa de seguridad está BLOQUEANDO el movimiento',
      estado: 'CONFIRMADA',
      evidencia: `El robot informa de una parada por «${fm.poligono}».`,
      // `invalid source` significa que no le llega /scan, no que haya un obstáculo.
      remedio: fm.poligono.includes('invalid')
        ? 'No es un obstáculo: al monitor no le llega el barrido del LIDAR. Enciéndelo.'
        : 'Aparta lo que tenga delante, o retira el robot de ahí con la mano.',
    })
  } else if (fm.accion === ACCION_APROXIMACION) {
    /*
     * 🔴🔴 ESTA RAMA NO EXISTÍA, Y SU AUSENCIA ERA EL PEOR TEXTO DE LA PANTALLA.
     *
     * Hasta el 2026-08-09 la acción 3 caía en la rama de abajo y esta pantalla
     * —la que lee alguien cuyo robot NO OBEDECE— le respondía con el titular
     * «la capa de seguridad te está frenando, y el robot SÍ obedece».
     *
     * Lo medido es lo contrario: con un punto dentro del círculo, `approach`
     * multiplica el mando ENTERO por cero y el robot da **0,0 cm avanzando,
     * 0,0° girando y 0,0 cm retrocediendo**. 24 de 24 estaciones, todo-o-nada.
     * O sea que le decíamos «sí obedece» a quien tenía delante exactamente el
     * fallo que esta pantalla existe para explicar.
     *
     * 📝 Y el remedio que se ofrecía —«despeja también los LADOS y repite la
     *    medida»— mandaba a repetir una orden que está medido que no hace nada.
     */
    causas.push({
      id: 'frenado',
      titulo: 'La capa de seguridad tiene al robot BLOQUEADO, y no puede salir solo',
      estado: 'CONFIRMADA',
      evidencia:
        `El robot informa de aproximación por «${fm.poligono}»: tiene algo dentro del círculo `
        + 'de 15 cm. Eso NO es «va más despacio»: el mando entero se multiplica por el tiempo '
        + 'hasta la colisión, y con un punto ya dentro ese factor es CERO. Medido en las cuatro '
        + 'direcciones: avanzar alejándose 0,0 cm, girar 0,0°, retroceder 0,0 cm.',
      remedio:
        'Retira el obstáculo, o aparta el robot con la mano. Desde aquí no hay forma: mandar '
        + 'marcha atrás está medido y da cero igual. Girando no rozaría nada, pero tampoco gira.',
    })
  } else if (fm.accion !== 0) {
    causas.push({
      id: 'frenado',
      titulo: 'La capa de seguridad te está frenando, y el robot SÍ obedece',
      estado: 'CONFIRMADA',
      evidencia:
        `El polígono «${fm.poligono}» está recortando la velocidad al 40 %. Mide 60 cm de largo `
        + 'por 40 de ANCHO sobre un robot de 21,7: cualquier cosa a menos de ~9 cm de un COSTADO '
        + 'lo frena, aunque te estés alejando de ella. Medido: la misma orden dio 26,4 cm con '
        + 'algo cerca y 59,5 despejado.',
      remedio: 'Despeja también los LADOS, no solo el frente, y repite la medida.',
    })
  } else {
    causas.push({
      id: 'frenado',
      titulo: 'La capa de seguridad',
      estado: 'DESCARTADA',
      evidencia: 'El monitor de colisión dice que no está limitando el movimiento.',
      remedio: '',
    })
  }

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
     *    dos. Se enseña el número y decide quien mira.
     *
     * ✅ PERO EL NÚMERO YA SE PUEDE LEER, desde el 2026-08-14 (evidencia 116).
     *    Antes el driver reintentaba **cada ~4-6 s sin espera creciente**, así
     *    que «123 reanudaciones fallidas» eran unos minutos y el contador no
     *    decía casi nada. Ahora la espera crece **3 → 6 → 12 → 24 → 48 → 60 s**
     *    con tope de 60, o sea que llegar a la sexta ya son **~2,5 minutos**
     *    —suma de las esperas, aritmética, no una medida— y a partir de ahí cada
     *    fallo es un minuto más. Un puñado de fallos significa **minutos**, no
     *    segundos, y eso sí orienta a quien mira.
     *
     * 📌 Y el otro cambio del mismo día importa para no confundirse leyendo el
     *    log del robot: «streaming reanudado» ya sólo se escribe cuando **llega
     *    una muestra de verdad**. Antes lo escribía porque `wake+stop+start` no
     *    lanzaban excepción —con el RVR apagado— y salía 8 veces en 30 s con
     *    `/odom` a cero.
     */
    causas.push({
      id: 'rvr',
      titulo: 'El RVR no contesta',
      estado: 'CONFIRMADA',
      evidencia: e.reanudacionesFallidas !== null && e.reanudacionesFallidas > 0
        ? `El driver lleva ${e.reanudacionesFallidas} reanudaciones fallidas, y espera cada vez más `
          + 'entre intentos (3, 6, 12, 24, 48 y hasta 60 s), así que a partir de la sexta ya son '
          + 'MINUTOS sin contestar. Puede estar cargando (RVR apagado con la Pi encendida) o dormido.'
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
        remedio: 'Reinicia el servicio en el robot, con «sudo systemctl restart atriz-robot».',
      }
      : {
        id: 'odom',
        titulo: 'La odometría',
        estado: 'DESCARTADA',
        evidencia: `Llega /odom desde hace ${a.toFixed(1)} s.`,
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

  // ── 6 · Un programa del Taller conduciendo ────────────────────────────────
  const prog = e.programaDelTaller
  if (prog === undefined || prog === null) {
    causas.push({
      id: 'taller',
      titulo: 'Puede haber un programa tuyo —o de otro— corriendo',
      estado: 'NO_SE_SABE',
      evidencia:
        'Un programa del Taller publica en el MISMO /cmd_vel_raw que la palanca, así que si hay '
        + 'uno corriendo el robot sí obedece: obedece a otro. Y esta pantalla no lo puede ver — el '
        + 'estado del programa vive en el agente del Taller, que es otro enlace.',
      remedio: 'Abre «Programar» y mira si hay algo corriendo. Si es de otra persona, aparecerá su nombre.',
    })
  } else if (prog.corriendo) {
    causas.push({
      id: 'taller',
      titulo: prog.sujeto === null
        ? 'Hay un programa corriendo en este robot'
        : `Hay un programa de ${prog.sujeto} corriendo en este robot`,
      estado: 'CONFIRMADA',
      evidencia:
        'El agente del Taller dice que hay un programa en marcha, y publica en el MISMO '
        + '/cmd_vel_raw que la palanca. El robot obedece: obedece al programa.',
      remedio: 'Párale desde «Programar». La parada de emergencia también lo detiene, y además cancela la navegación.',
    })
  } else {
    causas.push({
      id: 'taller',
      titulo: 'No hay ningún programa del Taller corriendo',
      estado: 'DESCARTADA',
      evidencia: 'El agente del Taller dice que no hay ninguna ejecución en marcha.',
      remedio: '',
    })
  }

  return causas
}

/**
 * El titular de la pantalla: cuántas causas están confirmadas.
 *
 * 🔴 Nunca dice «el robot está bien». Que ninguna de las causas conocidas encaje
 *    **no prueba que el robot obedezca**: solo que no es ninguna de las que esta
 *    pantalla sabe mirar.
 *
 * 📝 Aquí ponía «las CINCO causas conocidas» y ya son seis. Un número escrito a
 *    mano en una frase envejece en cuanto alguien añade una — y este proyecto
 *    tiene el precedente: «estas tres piezas» sobre dos que se movieron.
 *    Sin número, no puede quedarse rancio.
 */
export function resumen(causas: readonly Causa[]): string {
  const n = causas.filter((c) => c.estado === 'CONFIRMADA').length
  if (n === 0) {
    /*
     * 🔴 CORREGIDO EL 2026-08-11, Y LO DESTAPÓ MIRAR LA PANTALLA.
     *
     * Con el robot conduciendo por infrarrojos y todo lo demás sano, esto
     * titulaba «Ninguna de las causas conocidas encaja» **justo encima** de una
     * tarjeta que dice que el robot se está moviendo solo. Las dos frases eran
     * ciertas por separado —ninguna causa está CONFIRMADA— y juntas restaban
     * importancia a lo único que había que leer.
     *
     * No se arregla marcando la causa como confirmada, que sería afirmar una
     * causalidad no medida: se arregla dejando de decir «ninguna» cuando hay
     * algo. 📝 Ninguna prueba de `diagnosticar()` podía verlo; se vio en el
     * volcado de lo que el navegador acaba pintando.
     */
    const posibles = causas.filter((c) => c.estado === 'POSIBLE').length
    if (posibles === 1) return 'Ninguna confirmada, pero hay una que mirar'
    if (posibles > 1) return `Ninguna confirmada, pero hay ${posibles} que mirar`
    return 'Ninguna de las causas conocidas encaja'
  }
  if (n === 1) return 'Una causa encaja'
  return `${n} causas encajan a la vez`
}
