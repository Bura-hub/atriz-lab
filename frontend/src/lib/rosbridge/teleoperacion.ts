import { Aviso, Transporte } from './transporte'

/**
 * El watchdog del driver corta a los 0,3 s SIN `cmd_vel_raw` (medido: para en
 * 527 ms / 7,9 cm de deriva). Republicar a 10 Hz deja tres ciclos de margen
 * (300 ms / 100 ms) antes de que el vigilante actue. Un `sleep` entre
 * publicaciones, o un ritmo mas lento, deja el robot parado casi todo el
 * tiempo.
 */
export const RITMO_HZ = 10
export const PERIODO_MS = 1000 / RITMO_HZ

/**
 * Plazo por defecto para el /scan real de `arrancarBarrido()`, igual que en
 * `atriz.py` (la biblioteca del lado robot, que ya resolvio este mismo
 * problema con un tope de ~8 s). Sin plazo, un LIDAR que nunca arranca deja
 * la promesa pendiente para siempre Y la suscripcion a /scan -el 83 % del
 * trafico de un robot- registrada de por vida en el `Transporte`, porque
 * nadie la cancela si quien llamo deja de esperar esa promesa.
 *
 * ⚠️ Acoplamiento con el punto 7 del encargo (`MARGEN_PLAZO_LOCAL_MS` en
 * transporte.ts): `arrancarBarrido()` llama a `llamar('/start_scan')` SIN
 * pasar un `ms` propio, asi que usa el default de `Transporte.llamar()`
 * (5000) -y su temporizador LOCAL real es `5000 + MARGEN_PLAZO_LOCAL_MS`
 * (hoy 7000 ms). Ese plazo de LA LLAMADA tiene que quedar POR DEBAJO de este
 * `PLAZO_ARRANQUE_SCAN_MS` (8000 ms): si algun dia se sube el margen o se
 * baja este plazo hasta que se toquen, el genérico de `llamar()` («sin
 * respuesta... denegado o caido») puede ganarle la carrera al mensaje
 * especifico de aqui abajo («no llego ningun /scan real»), y quien lo lea se
 * lleva la conjetura equivocada en vez de la buena. No hay una comprobacion
 * automatica de este orden: si tocas cualquiera de los dos valores, vuelve a
 * leer este comentario.
 */
export const PLAZO_ARRANQUE_SCAN_MS = 8000

/** geometry_msgs/Twist. Los seis campos, aunque solo se use v y w (robot diferencial). */
export interface Twist {
  linear: { x: number; y: number; z: number }
  angular: { x: number; y: number; z: number }
}

export function twist(v: number, w: number): Twist {
  return {
    linear: { x: v, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: w },
  }
}

/**
 * El bucle de mando, el arranque del barrido del LIDAR y la parada de
 * emergencia. Une transporte.ts (que ya sabe hablar rosbridge) con las
 * propiedades de seguridad medidas sobre el robot real:
 *
 * - Republicar a RITMO_HZ, no una vez.
 * - No dar el barrido por arrancado hasta que llega un /scan de verdad.
 * - La parada va SOLO a /emergency_stop, y no hay forma de liberarla desde
 *   aqui: liberarla es un acto humano deliberado, en otro sitio, con
 *   confirmacion y comprobando que no hay un objetivo de Nav2 activo.
 *
 * 🔴 `transporte.publicar()` LANZA si no hay conexion (antes fallaba en
 * silencio, y por ahi pasaba /emergency_stop). Esta clase tiene DOS reglas
 * opuestas a proposito para ese lanzamiento, y son el diseño de esta tarea:
 *
 * (a) El TICK del bucle de 10 Hz corre dentro de un `setInterval`: nadie esta
 *     esperando sincronamente su resultado, asi que una excepcion sin
 *     capturar ahi es un error no manejado que no ve nadie. `tick()` la
 *     ATRAPA, CORTA el bucle (`detener()`) y la deja escrita con
 *     `console.error` — nunca la traga muda.
 *
 * (b) `paradaEmergencia()` se llama DIRECTAMENTE (no dentro de un timer): si
 *     `publicar()` lanza, la excepcion se propaga tal cual al llamante SIN
 *     capturarla aqui. Quien pulso la parada tiene que enterarse de que NO se
 *     envio, para poder decirselo a quien esta en el aula. `parar()` sigue la
 *     misma regla que (b) por el mismo motivo: es una llamada directa de un
 *     humano, no un tick automatico.
 *
 * ⚠️ Pestaña en segundo plano: los navegadores limitan `setInterval` a ~1 Hz
 * cuando la pestaña no esta visible. Con el watchdog del driver a 0,3 s, eso
 * DETIENE el robot por inanicion de `/cmd_vel_raw` -no hace falta que nadie
 * llame a `parar()`. El efecto es SEGURO (el robot para solo), pero puede
 * sorprender a quien esta teleoperando y cambia de pestaña: no es un fallo
 * de esta clase, es el navegador. No se implementa nada para evitarlo -no
 * se puede ejercitar con temporizadores falsos, y el efecto ya es el lado
 * seguro-, pero quien construya la interfaz tiene que saberlo.
 */
export class Teleoperacion {
  // Campos privados de verdad (#), no `private` de TypeScript: asi no
  // aparecen en `Object.getOwnPropertyNames(Teleoperacion.prototype)`, que es
  // como la prueba «no existe ningun metodo para liberar la parada» blinda
  // la superficie publica exacta -seis metodos, ninguno mas.
  #transporte: Transporte
  #actual: Twist | null = null
  #temporizador: ReturnType<typeof setInterval> | null = null
  #bajaCierre: () => void
  #oyentesAviso = new Set<(a: Aviso) => void>()

  constructor(transporte: Transporte) {
    this.#transporte = transporte
    // Aviso de la Tarea 6: este oyente SOLO para el bucle. No reconecta desde
    // aqui — hacerlo de forma sincrona dentro del callback de `alCerrarse`
    // puede anular un socket nuevo y legitimo (medido: 4 sockets en esa
    // cascada). Reconectar es responsabilidad de quien orqueste la conexion,
    // no de la teleoperacion.
    this.#bajaCierre = transporte.alCerrarse(() => this.detener())
  }

  /**
   * Avisos LOCALES de la teleoperacion. Hoy solo uno: el tick del bucle de
   * mando fallo y se corto -mismo patron que `Transporte.alAviso()`, que
   * existe exactamente para esto: I2. `console.error` es MUDO para quien
   * teleopera: el alumno seguiria empujando el joystick contra un robot que
   * ya no recibe nada, y el sintoma seria «robot averiado» sobre un robot
   * sano.
   */
  alAviso(cb: (a: Aviso) => void): () => void {
    this.#oyentesAviso.add(cb)
    return () => this.#oyentesAviso.delete(cb)
  }

  #avisar(a: Aviso): void {
    for (const cb of this.#oyentesAviso) cb(a)
  }

  /**
   * Espera un /scan REAL, no el codigo de retorno de /start_scan. Sin /scan
   * el collision_monitor bloquea el movimiento: 0,0 cm medidos contra 9,9 del
   * control, y el robot parece averiado sin estarlo.
   *
   * Lleva un PLAZO (por defecto `PLAZO_ARRANQUE_SCAN_MS`, parametrizable):
   * si /start_scan responde pero el /scan real nunca llega, la promesa
   * RECHAZA en vez de quedar pendiente para siempre -mismo tope que
   * `atriz.py`, la biblioteca del lado robot, ya usa para este problema.
   *
   * 🔴 Al vencer el plazo (o si /start_scan falla) se da de baja de /scan.
   * Es la mitad que se olvida: si solo se rechaza la promesa sin cancelar la
   * suscripcion, /scan -el 83 % del trafico de un robot- queda pidiendose
   * para siempre en el `Transporte`, aunque nadie vaya a leerlo mas. Lo
   * mismo en el camino de exito: la suscripcion solo existia para esperar
   * la primera muestra.
   *
   * 🔴🔴 Punto 1 del encargo, la TERCERA puerta por la que se acusaba al
   * LIDAR de un fallo que era del enlace. Si el WebSocket se cae MIENTRAS se
   * espera el primer /scan y justo `llamar('/start_scan')` YA HABIA
   * resuelto (el `.catch` de mas abajo no llega a correr), `onclose` cancela
   * las llamadas PENDIENTES (ya no queda ninguna: ya se resolvio) y avisa a
   * `oyentesCierre` -pero esta promesa no era oyente, asi que nadie se lo
   * decia. Vencia su plazo de 8 s entero y el alumno leia la conjetura del
   * LIDAR sobre un enlace que llevaba segundos caido. Es la misma atribucion
   * falsa que ya se cerro dos veces (I1 y el arreglo transversal de
   * `result:false`), por una tercera puerta.
   * Este oyente de `alCerrarse` cierra esa puerta: rechaza EN EL ACTO, con
   * un mensaje que dice lo que paso de verdad -se perdio la conexion-, no
   * una conjetura sobre el hardware.
   */
  arrancarBarrido(plazoMs: number = PLAZO_ARRANQUE_SCAN_MS): Promise<void> {
    return new Promise((resolver, rechazar) => {
      let resuelto = false

      // `terminar` referencia `cancelarSuscripcion`, `plazo` y `bajaCierre`,
      // declaradas MAS ABAJO: es seguro porque `terminar` solo se invoca
      // desde callbacks asincronos (mensaje, plazo, fallo de /start_scan,
      // caida del enlace), nunca durante este bloque sincrono -para cuando
      // cualquiera de esos callbacks pueda disparar, las cuatro ya estan
      // inicializadas.
      const terminar = (fn: () => void): void => {
        if (resuelto) return
        resuelto = true
        clearTimeout(plazo)
        cancelarSuscripcion()
        bajaCierre()
        fn()
      }

      const cancelarSuscripcion = this.#transporte.suscribir('/scan', () => {
        terminar(resolver)
      })

      // Los TRES caminos de salida de abajo (scan real, plazo vencido, fallo
      // de /start_scan) se dan de baja de este oyente a traves de `terminar`
      // -y este mismo callback tambien se da de baja a si mismo, para no
      // dejar NADA colgando en ningun camino.
      const bajaCierre = this.#transporte.alCerrarse(() => {
        terminar(() => rechazar(new Error(
          'se perdio la conexion con el robot mientras se esperaba a que arrancara el barrido: ' +
            'no se sabe si arranco o no. Es el enlace el que se cayo, no una conjetura sobre el hardware.',
        )))
      })

      const plazo = setTimeout(() => {
        terminar(() => rechazar(new Error(
          `«/start_scan» respondio pero no llego ningun /scan real en ${plazoMs / 1000} s. ` +
            'Sin /scan el collision_monitor bloquea el movimiento: el robot no tiene por que ' +
            'estar averiado -puede que el LIDAR no haya arrancado.',
        )))
      }, plazoMs)

      this.#transporte.llamar('/start_scan').catch((error: unknown) => {
        terminar(() => rechazar(error instanceof Error ? error : new Error(String(error))))
      })
    })
  }

  /**
   * Arranca o actualiza el bucle de mando. Si ya esta corriendo, solo cambia
   * el Twist que se repite: NO reinicia el temporizador (evita fase/jitter si
   * la interfaz llama a `mover()` mas seguido que RITMO_HZ, p.ej. arrastrando
   * un joystick). El ritmo de publicacion lo impone SIEMPRE el temporizador
   * de 10 Hz, nunca la frecuencia con la que llega la orden.
   *
   * Si el bucle esta parado, se manda un primer mando en el acto -reusando
   * `tick()`, no esperar un periodo entero para empezar a moverse. Al
   * reusar `tick()`, ese primer mando sigue la regla (a): si falla, se
   * atrapa, se deja constancia y el bucle NO llega a arrancar -queda listo
   * para que la siguiente llamada a `mover()` lo reintente.
   */
  mover(v: number, w: number): void {
    this.#actual = twist(v, w)
    if (this.#temporizador === null) {
      this.#temporizador = setInterval(() => this.#tick(), PERIODO_MS)
      this.#tick()
    }
  }

  #tick(): void {
    if (this.#actual === null) return
    try {
      this.#transporte.publicar('/cmd_vel_raw', this.#actual)
    } catch (error) {
      // Regla (a): se atrapa, se corta el bucle y se deja constancia.
      this.detener()
      const mensaje =
        `teleoperacion: se corto el bucle de mando — publicar() fallo: ` +
        `${error instanceof Error ? error.message : String(error)}`
      // 🔴 I2: `console.error` es mudo para quien teleopera -el alumno no
      //    mira la consola del navegador. `alAviso()` es la via que SI puede
      //    llegar a la interfaz.
      console.error(mensaje)
      this.#avisar({ nivel: 'error', mensaje })
    }
  }

  /**
   * Manda un Twist cero y corta el bucle. Corta el bucle PRIMERO: si el
   * publish falla (regla (b): no se captura aqui, se propaga), el robot deja
   * de recibir mando de todas formas y el vigilante del driver lo para solo
   * en <=0,3 s.
   */
  parar(): void {
    this.detener()
    this.#transporte.publicar('/cmd_vel_raw', twist(0, 0))
  }

  /**
   * Publica en /emergency_stop y corta el bucle. SOLO ese topic: los otros
   * dos nombres que escucha el driver estan fuera de `topics_pub_glob` en el
   * robot, aunque el README diga lo contrario.
   *
   * Corta el bucle PRIMERO, por el mismo motivo que `parar()`.
   *
   * 🔴 NO captura el error de `publicar()` — regla (b). Es lo contrario de
   * `tick()` a proposito: aqui SI hay alguien esperando sincronamente
   * (quien pulso el boton), y tiene que saber que la parada NO se envio.
   * El llamante esta OBLIGADO a manejar el rechazo/excepcion.
   *
   * NO existe ningun metodo para liberar esta parada. Liberarla es un acto
   * humano deliberado, con confirmacion, y exige comprobar antes que no haya
   * un objetivo de Nav2 activo -sin `cancelar_nav2` vivo el robot reanuda la
   * navegacion solo: 34,7 cm medidos contra 0,0 con el arreglo. Esa
   * comprobacion vive en el robot (`cancelar_nav2` en nav2.launch.py), no
   * aqui.
   */
  paradaEmergencia(): void {
    this.detener()
    this.#transporte.publicar('/emergency_stop', {})
  }

  /** Corta el bucle sin publicar nada. No falla nunca: solo limpia el temporizador. */
  detener(): void {
    if (this.#temporizador !== null) {
      clearInterval(this.#temporizador)
      this.#temporizador = null
    }
  }

  /** Limpieza al desmontar: corta el bucle y suelta el oyente de `alCerrarse`. */
  desmontar(): void {
    this.detener()
    this.#bajaCierre()
  }
}
