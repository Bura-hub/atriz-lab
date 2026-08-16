/**
 * LA PALANCA — de dónde está el dedo a qué se le pide al robot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 POR QUÉ UNA PALANCA Y NO LA CRUZ (2026-08-16)
 * ═══════════════════════════════════════════════════════════════════════════
 * Pedido por el usuario. Y la cruz tenía un límite real: **cuatro botones son
 * cuatro órdenes**. Para trazar un arco había que pulsar «adelante», soltar,
 * pulsar «izquierda» — o sea conducir a saltos. Una palanca da las dos
 * componentes **en un gesto**, que es lo que hace un mando de verdad.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y AQUÍ ESTÁ EL PROBLEMA HONESTO DE UNA PALANCA ANALÓGICA
 * ═══════════════════════════════════════════════════════════════════════════
 * Una palanca continua **puede pedir cualquier valor**, y de este robot solo hay
 * medida una franja:
 *
 *   lineal    0,20 m/s → meseta real 0,199 (100 %) · 0,40 → 0,401 (100 %)
 *   angular   entre 0,5 y 2,0 rad/s cumple el 99-102 % de lo comandado
 *
 * **Por debajo de eso no hay medida.** Un mando que deje pedir 0,02 m/s o
 * 0,1 rad/s está prometiendo un comportamiento que nadie ha comprobado — y en un
 * robot con orugas lo más probable es que ni se mueva, con lo que el alumno
 * concluye «no obedece» sobre un robot sano. Es exactamente la familia de fallo
 * que este proyecto persigue.
 *
 * → **La magnitud se remapea a la franja MEDIDA.** Fuera de la zona muerta, lo
 *   mínimo que se puede pedir es el suelo caracterizado; dentro, cero. Así toda
 *   orden que sale de aquí cae en territorio conocido.
 *
 * 📌 Es la misma decisión que ya tomó la cruz sin decirlo: ofrecía DOS
 *   velocidades, las dos medidas, y un giro fijo de 0,8 rad/s que está dentro de
 *   la banda. Lo que cambia es que ahora es continuo y hay que decirlo.
 */

/** Lo que se le pide al robot. `v` en m/s, `w` en rad/s. */
export interface OrdenMando {
  v: number
  w: number
}

/**
 * 🔴 ZONA MUERTA DEL 18 %, y no es un número redondo por casualidad.
 *
 * Sin ella, soltar el dedo a un píxel del centro deja al robot con una orden
 * mínima puesta, y el bucle de 10 Hz la republica hasta que alguien suelte. Con
 * un ratón se nota; con un dedo en una tableta, no.
 *
 * ⚠️ Y tiene que ser MAYOR que el ruido de un puntero fino: un temblor de 2-3 px
 *    sobre un radio de 84 px es ~3 %. El 18 % deja margen de sobra sin comerse
 *    el recorrido útil, que sigue siendo el 82 %.
 */
export const ZONA_MUERTA = 0.18

/**
 * El suelo del giro, en rad/s. **Medido**: entre 0,5 y 2,0 el robot cumple el
 * 99-102 % de lo que se le pide. Por debajo de 0,5 no hay ninguna medida.
 */
export const W_MIN = 0.5

/**
 * El techo del giro, en rad/s. **2,0, que es donde acaba lo medido.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 ERA 1,2 Y SE ABRE, Y EL ARGUMENTO QUE LO PERMITE ES GEOMÉTRICO
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo notó el usuario: *«la velocidad de giro sí alcanza velocidades más altas»*,
 * y al mirarlo apareció una asimetría que era **al revés de lo razonable**. El
 * alumno controlaba el eje peligroso —el lineal, con su deslizador— y NO
 * controlaba el seguro, que iba fijo entre 0,5 y 1,2 sin aparecer en pantalla.
 *
 * 🔴 **Girar sobre el eje tiene desplazamiento cero.** Un robot a 2,0 rad/s no
 *    alcanza un pie, no cruza el pasillo y no llega al borde de una mesa: se
 *    queda dentro del círculo de 14,4 cm que ya ocupaba. Su esquina barre a
 *    0,288 m/s, pero barre **su propio sitio**. Avanzar es la única componente
 *    que convierte velocidad en distancia, y la distancia es lo que produce todo
 *    lo que importa en un aula.
 *
 * → Por eso este techo se abre entero hasta lo medido y el lineal no. La
 *   asimetría se mantiene —topar más lo lineal que lo angular es lo correcto—;
 *   lo que se arregla es quién controla cada uno.
 *
 * ⚠️ Y sigue sin haber medida por encima de 2,0: la franja caracterizada es
 *    0,5-2,0 al 99-102 %.
 */
export const W_MAX = 2.0

/**
 * Con cuánto giro arranca la pantalla. **El techo de ayer.**
 *
 * 🔴 No es 2,0 a propósito: nadie se encuentra el robot girando más rápido sin
 *    haberlo pedido. Quien quiera los 2,0 mueve el deslizador, que es un gesto.
 */
export const W_POR_DEFECTO = 1.2

/**
 * El suelo de la velocidad lineal, en m/s.
 *
 * 🔴 Es la más baja de las DOS que esta pantalla ofrecía y que están medidas.
 *    Por debajo no hay dato — y con orugas sobre suelo de aula, «no hay dato»
 *    puede significar «no arranca», que se lee como avería.
 */
export const V_MIN = 0.10

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOS DOS TECHOS LINEALES, Y POR QUÉ SON DOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL DE 0,20 ERA EL ÚNICO TOPE DE TODA LA CADENA. Seguido hasta los motores:
 *
 *     ordenDePalanca()          <- RECORTA aquí, y en ningún sitio más
 *     Teleoperacion.mover()        guarda el Twist tal cual
 *     Transporte.publicar()        valida CONEXIÓN y NOMBRE, no valores
 *     lista blanca de rosbridge    filtra NOMBRES, no números
 *     collision_monitor            recorta por GEOMETRÍA, no por tope
 *     rvr_driver_node._cb_cmd_vel  pasa `linear.x` y `angular.z` AL SDK sin clamp
 *
 *   El driver no declara ningún parámetro de velocidad máxima, y su comentario lo
 *   dice: *«el comando `cmd_vel` NO SE TOCA … `angular.z` va tal cual»*. O sea:
 *   **aguas abajo no hay red.** Esta función ES la salvaguarda.
 *
 * 🔴 Y AUN ASÍ NO ERA UNA FRONTERA: `atriz.py` ya le da al alumno `VEL_MAX = 0.40`
 *   y `VEL_GIRO_MAX = 2.0` **por el mismo `/cmd_vel_raw`**, desde la pestaña del
 *   Taller y con tres líneas de Python. El tope de la palanca era un badén en una
 *   de las dos puertas de la misma aplicación.
 *
 * 👤 DECISIÓN DEL USUARIO (2026-08-16): se abre hasta 0,40 **detrás de un
 *    pestillo**. Lo que sobrevive del argumento viejo no es «teleoperar a ciegas»
 *    —el alumno está en la sala, mirando el robot— sino esto, que es más estrecho
 *    y más cierto: **un mando continuo se recorre sin querer; una línea de Python
 *    se escribe a propósito.** El pestillo devuelve ese «a propósito».
 *
 * ⚠️ LO QUE CAMBIA DE VERDAD AL DOBLAR, medido, y no es lo que se teme:
 *    · el hueco al parar del `collision_monitor` sube de **6,3 a 7,4 cm**. Un
 *      centímetro. La capa de seguridad NO se degrada.
 *    · el plano de barrido del LIDAR está a **15,5 cm del suelo**, y por debajo no
 *      hay ninguna protección: un pie, un cable, el borde de una mesa. En esa
 *      franja la velocidad es la única variable, **y la energía va con v²**.
 *      Doblar la velocidad la cuadruplica. Ese es el riesgo real, y es el que la
 *      pantalla tiene que decir.
 */
export const V_MAX_SEGURO = 0.20
export const V_MAX_DURO = 0.40

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA CURVA DE RESPUESTA — el único ajuste «de mando» que se gana el sitio
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 Del encargo de un mando «bastante más personalizado». Se descartaron zona
 *    muerta ajustable, inversión de ejes, sensibilidad y tope de aceleración —
 *    ver el bloque del final—; esta se queda porque es la única que un alumno
 *    NOTA al trazar un arco, y porque no toca ni el suelo ni el techo medidos.
 *
 *   directa   lo de siempre: el recorrido útil se reparte lineal.
 *   suave     cuadrática: al 50 % del recorrido se pide el 25 % del rango. Da
 *             finura cerca del centro y sigue llegando al tope en el borde.
 *
 * 🔴 LAS DOS EMPIEZAN EN `min` Y ACABAN EN `max`. La curva reparte lo de en
 *    medio; no puede sacar la orden de la franja medida. Hay una prueba que lo
 *    exige sobre el barrido entero, para las dos curvas.
 */
export type Curva = 'directa' | 'suave'

export const CURVA_POR_DEFECTO: Curva = 'directa'

/** Lo que ajusta quien conduce. Un objeto y no cuatro argumentos sueltos. */
export interface Ajustes {
  /** Techo lineal, en m/s. Lo pone el deslizador. */
  vMax: number
  /** Techo angular, en rad/s. Lo pone el segundo deslizador. */
  wMax: number
  curva: Curva
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  vMax: V_MIN,
  wMax: W_POR_DEFECTO,
  curva: CURVA_POR_DEFECTO,
}

/**
 * Remapea `t` desde la zona muerta hasta el borde, sobre `[min, max]`.
 *
 * 🔴 EL SALTO EN EL BORDE DE LA ZONA MUERTA ES DELIBERADO. Al cruzarla, lo
 *    primero que se pide es `min` —no cero—, así que el robot **arranca de
 *    verdad**. Un arranque suave desde cero sería más bonito y pediría valores
 *    que nadie ha medido durante todo el tramo inicial.
 *
 * ⚠️ La curva se aplica al RECORRIDO ÚTIL, después de la zona muerta y antes de
 *    mapear a `[min, max]`. Aplicarla antes le devolvería vida a la zona muerta;
 *    aplicarla después bajaría el suelo por debajo de lo medido.
 */
function escalar(t: number, min: number, max: number, curva: Curva): number {
  if (t <= ZONA_MUERTA) return 0
  const util = (t - ZONA_MUERTA) / (1 - ZONA_MUERTA)
  const y = curva === 'suave' ? util * util : util
  return min + y * (max - min)
}

/**
 * De un desplazamiento del puntero a una orden.
 *
 * @param dx      píxeles a la derecha del centro
 * @param dy      píxeles hacia ABAJO del centro (como el DOM)
 * @param radio   radio útil de la palanca, en píxeles
 * @param ajustes techos y curva
 *
 * 🔴 IZQUIERDA ES `w` POSITIVA. Es REP-103 —antihorario positivo— y el SDK del
 *    RVR lo cumple: está verificado mirando el robot, no deducido. La cruz ya lo
 *    hacía así (`Izquierda` → `w: 1`), y cambiarlo aquí habría hecho que dos
 *    mandos de la misma pantalla giraran al revés.
 */
export function ordenDePalanca(
  dx: number, dy: number, radio: number, ajustes: Ajustes,
): OrdenMando {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radio > 0)) return { v: 0, w: 0 }

  /*
   * 🔴 SE RECORTA EL VECTOR ENTERO, no cada eje por su cuenta. Recortando por
   *    eje, arrastrar a una esquina daría magnitud √2 — o sea que la diagonal
   *    pediría un 41 % más que cualquier otra dirección, y el robot trazaría
   *    arcos más rápidos cuanto más diagonal fuera el gesto.
   */
  const m = Math.hypot(dx, dy)
  const escala = m > radio ? radio / m : 1
  const nx = (dx * escala) / radio
  // El DOM crece hacia abajo y «adelante» es hacia arriba.
  const ny = -(dy * escala) / radio

  /*
   * La zona muerta se mide sobre el VECTOR, no sobre cada eje: si no, un gesto
   * casi vertical con 0,17 de componente horizontal saldría con `w = 0` mientras
   * su magnitud total ya está fuera de la zona muerta — el robot iría recto
   * cuando el dedo dice que gire un poco.
   */
  if (Math.hypot(nx, ny) <= ZONA_MUERTA) return { v: 0, w: 0 }

  return {
    v: Math.sign(ny) * escalar(Math.abs(ny), V_MIN, ajustes.vMax, ajustes.curva),
    w: -Math.sign(nx) * escalar(Math.abs(nx), W_MIN, ajustes.wMax, ajustes.curva),
  }
}

/**
 * La orden del TECLADO, con los mismos techos que la palanca.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EXISTE PORQUE EL TECLADO ERA UN SEGUNDO MAPEO SIN PRUEBAS
 * ═══════════════════════════════════════════════════════════════════════════
 * `MandoPalanca` calculaba la orden del teclado a mano —`{ v: d.v * vMax, w:
 * d.w * W_MAX }`— sin pasar por este fichero. Daba los mismos números **por
 * casualidad**, porque `d.v` solo vale −1, 0 o 1; pero el invariante estaba
 * escrito dos veces y solo una tenía pruebas.
 *
 * 🔴 Con el techo del giro abriéndose a 2,0, esa copia se habría quedado en
 *    `W_MAX` y las dos vías habrían empezado a girar a velocidades distintas —
 *    sin que lo viera `tsc` ni la batería. Una sola fuente.
 *
 * ⚠️ El teclado NO lleva curva, y es correcto: una tecla no tiene recorrido.
 *    Está o no está, así que pide el techo. La curva reparte un recorrido que
 *    aquí no existe.
 *
 * @param d dirección de las teclas: −1, 0 o 1 por eje.
 */
export function ordenDeTeclado(d: OrdenMando, ajustes: Ajustes): OrdenMando {
  return {
    v: d.v === 0 ? 0 : Math.sign(d.v) * ajustes.vMax,
    w: d.w === 0 ? 0 : Math.sign(d.w) * ajustes.wMax,
  }
}

/**
 * ¿Está esta orden dentro de lo que se ha medido de este robot?
 *
 * 🔴 EXISTE PARA PODER DECIRLO EN PANTALLA, no para bloquear nada.
 *    `ordenDePalanca` ya remapea a la franja medida, así que hoy siempre es
 *    `true` — y precisamente por eso hace falta: es el control que se pondría
 *    rojo el día que alguien cambie el remapeo y empiece a pedir valores que
 *    nadie ha comprobado.
 *
 * 🔴🔴 Y HASTA HOY NO SE LLAMABA EN NINGÚN SITIO: solo desde su propia prueba.
 *      Un control que únicamente corre en su test **no es un control**, y su
 *      docstring decía «para poder decirlo en pantalla» sobre una pantalla que
 *      no lo decía. Es la misma familia que las doce comprobaciones muertas del
 *      verificador del robot.
 */
export function dentroDeLoMedido(o: OrdenMando, ajustes: Ajustes): boolean {
  const vOk = o.v === 0
    || (Math.abs(o.v) >= V_MIN - 1e-9 && Math.abs(o.v) <= ajustes.vMax + 1e-9)
  const wOk = o.w === 0
    || (Math.abs(o.w) >= W_MIN - 1e-9 && Math.abs(o.w) <= ajustes.wMax + 1e-9)
  return vOk && wOk
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EL PESTILLO DEL TRAMO RÁPIDO
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 Decisión del usuario: el lineal llega a 0,40, pero no de un roce.
 *
 * 🔴 NO SE GUARDA EN NINGÚN SITIO, y esa es la propiedad que lo hace seguro. Son
 *    dieciséis portátiles compartidos en un aula: si se persistiera, alguien
 *    heredaría el tramo abierto del alumno anterior sin haberlo pedido.
 *
 * 🔴 Y SE ECHA SOLO AL PERDER EL ENLACE. Un robot que se reconecta empieza otra
 *    vez en 0,20. El estado peligroso no sobrevive a nada.
 *
 * ⚠️ NO es un rol de profesor, y se descartó con razones: el rol no viaja en la
 *    cookie —habría que ir al servidor y aparece un modo de fallo nuevo—, la
 *    tabla de roles pone «conducir» explícitamente en los dos, y el Taller ya da
 *    0,40 al mismo alumno. Sería teatro sobre una puerta abierta al lado.
 */
export function techoLineal(pestilloSuelto: boolean): number {
  return pestilloSuelto ? V_MAX_DURO : V_MAX_SEGURO
}

/**
 * Recorta un techo pedido a lo que el pestillo permite ahora mismo.
 *
 * 🔴 HACE FALTA PORQUE EL PESTILLO SE PUEDE ECHAR CON EL DESLIZADOR ARRIBA. Sin
 *    esto, quien subiera a 0,40 y volviera a echar el pestillo se quedaría
 *    conduciendo a 0,40 con la pantalla diciendo que el tope son 0,20 — el
 *    control puesto y sin efecto que este proyecto persigue en todas partes.
 */
export function vMaxPermitida(pedida: number, pestilloSuelto: boolean): number {
  const techo = techoLineal(pestilloSuelto)
  if (!Number.isFinite(pedida)) return V_MIN
  return Math.min(Math.max(pedida, V_MIN), techo)
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LO QUE **NO** SE AJUSTA, Y POR QUÉ. Está aquí para que no se vuelva a proponer.
 * ═══════════════════════════════════════════════════════════════════════════
 * · **Zona muerta ajustable.** `ZONA_MUERTA` se derivó del ruido de un puntero
 *   fino contra el radio de 84 px. Exponerla invita a ponerla a 0, que reproduce
 *   exactamente el fallo que existe para impedir: el dedo a un píxel del centro
 *   y el bucle de 10 Hz republicando la orden hasta que alguien suelte.
 * · **Inversión de ejes.** Aquí no hay convención de simulador que respetar: el
 *   robot está en la sala y «adelante es arriba» está verificado contra REP-103
 *   MIRANDO el robot. Invertir crea una segunda verdad sobre el sentido, y este
 *   proyecto ya pagó por dos mandos de la misma pantalla girando al revés.
 * · **Tope de aceleración.** La rampa real son ~0,5 s y es del firmware. El
 *   servicio que la toca **no está en la lista blanca**, así que la web solo
 *   podría simularla: dos rampas peleando y ninguna medida.
 * · **«Sensibilidad» como número aparte.** Es el techo con otro nombre. Dos
 *   mandos para un efecto es como se aprende a desconfiar de los dos.
 */
