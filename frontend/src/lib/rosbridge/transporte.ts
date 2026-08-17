import {
  RegistroPendientes, opAdvertise, opCallService, opCancelActionGoal, opPublish,
  opSendActionGoal, opSubscribe, opUnsubscribe,
} from './protocolo'
import { leerCierre } from './rechazo'
import { PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE } from '@/lib/sesion/enlace_agente'

/**
 * Un WebSocket por robot. NO hay namespace: al robot lo identifica la CONEXION,
 * asi que el mismo codigo sirve para los 16.
 */
export function urlDeRobot(robot: number | string): string {
  const host = typeof robot === 'number' ? `rvr-${String(robot).padStart(2, '0')}.local` : robot
  return `ws://${host}:9090`
}

/** 1 s duplicando hasta 30 s, con +-20 % de ruido. */
export function esperaReconexion(intento: number, aleatorio: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** intento, 30000)
  return Math.round(base * (0.8 + 0.4 * aleatorio()))
}

/**
 * 🔴 Punto 7 del encargo: hay DOS paredes de plazo para una `llamar()`, y
 * antes solo se movia una. rosbridge tiene la SUYA (el `timeout` del propio
 * `op`, ver `opCallService`); `Transporte.llamar()` arma ademas un
 * temporizador LOCAL, en JS, que antes corria a ciegas del de rosbridge.
 *
 * Medido: ante un servicio que FALLA de verdad, rosbridge contesta con el
 * motivo REAL a los ~6 s (su propio default de 5,0 s mas el redondeo de red).
 * Con un local de exactamente el mismo valor, el local gana la carrera casi
 * siempre y sustituye el motivo real por el generico "denegado o el robot
 * esta caido" -justo la conjetura que este proyecto ya paga caro en otros
 * sitios. Este margen pone el muro LOCAL por ENCIMA del que se le pide a
 * rosbridge: el generico solo puede aparecer si rosbridge no contesta NADA,
 * que es el unico caso en que es cierto.
 */
export const MARGEN_PLAZO_LOCAL_MS = 2000

/**
 * Plazo por defecto de un objetivo de accion. **Cinco minutos, y es largo a
 * proposito.**
 *
 * Una navegacion de verdad tarda: a 0,20 m/s, cruzar un aula de 6 m rodeando un
 * obstaculo son decenas de segundos, y Nav2 reintenta. Un plazo corto no
 * protegeria de nada —cancelaria la ESPERA, no el objetivo, asi que el robot
 * seguiria navegando mientras la pantalla se da por vencida—: exactamente el
 * estado engañoso que este proyecto evita.
 *
 * 🔴 Pero el plazo tiene que EXISTIR, porque el `op` de accion **no lleva campo
 *    `timeout`** —al contrario que `call_service`— y porque un `op` que
 *    rosbridge no entiende no produce ni un byte (medido: silencio absoluto en
 *    4 s con un `op` inventado). Sin plazo, una errata en el nombre de la
 *    accion deja la promesa colgada para siempre.
 */
export const PLAZO_ACCION_MS = 5 * 60 * 1000

type Manejador = (msg: unknown) => void
/**
 * 🆕 Los subprotocolos son OPCIONALES a proposito: por ahi viaja el testigo de
 *    la Fase B (`atriz.token.<jwt>`), y los dobles de las pruebas siguen
 *    llamando con un solo argumento. Hacerlo obligatorio habria obligado a
 *    tocar todos los dobles para nada.
 */
type FabricaWS = (url: string, protocolos?: string[]) => WebSocket

/** Un aviso local del cliente. Ver el docstring de `alAviso()`. */
export interface Aviso {
  nivel: string
  mensaje: string
}

/**
 * Cuanto se espera a que un socket ABRA antes de darlo por colgado.
 *
 * 🔴 **10 s, y la primera version puso 5 — demasiado justo.** Remedido en el
 *    navegador el 2026-08-04 despues del arreglo del robot, **con el muro
 *    entero intentandolo a la vez**, que es el caso que manda:
 *
 *      ws://rvr-01.local:9090    4339 ms (caché fría) · 2331 ms (caliente)
 *      ws://192.168.1.200:9090   4623 ms
 *      una toma suelta por nombre               7293 ms
 *
 *    Con 5 s el margen era de 400 ms sobre lo medido, y hubo una toma de
 *    **7,3 s** que lo habria pasado: un falso «no llego» intermitente, que es
 *    el peor modo de fallo posible para depurar.
 *
 * ⚠️ Y subirlo **no cuesta nada en pantalla**: la baldosa ya dice «no llego»
 *    desde el primer instante y hasta que el socket abre. Este plazo solo
 *    decide cuando se REINTENTA, no lo que se ve.
 *
 * 📝 La resolucion mDNS es casi todo el coste, y solo la primera vez: medido
 *    desde el sistema, **2716 · 2710 · 2729 ms con la cache vaciada** contra
 *    **2 ms** con ella caliente.
 *
 * ⚠️ Este plazo es del CLIENTE y no tiene nada que ver con el de `llamar()`
 *    (ver `MARGEN_PLAZO_LOCAL_MS`): aquel arbitra contra el plazo de rosbridge,
 *    y este existe porque el navegador **no da error nunca** ante un socket que
 *    no abre. Son dos problemas distintos y no se pueden unificar.
 */
export const PLAZO_CONEXION_MS = 10000

interface OpcionesTransporte {
  reconectar?: boolean
  aleatorio?: () => number
  programar?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  /** 0 lo desactiva. Ver `PLAZO_CONEXION_MS`. */
  plazoConexion?: number
  /**
   * 🆕 FASE B (A7): de donde sale el testigo que rosbridge exige al abrir.
   *
   * Es una FUNCION y no una cadena a proposito: el testigo **caduca a los 10
   * min** y esta clase reconecta sola con espera creciente. Un robot apagado
   * media hora volveria con una credencial rancia, y el sintoma —«no me deja
   * entrar y antes sí»— se buscaria en el robot. Cada intento pide uno fresco.
   *
   * Sin esta opcion, el transporte abre como siempre, sin subprotocolo: es lo
   * que hacen las pruebas y lo que hara la web hasta que el robot lo exija.
   */
  testigo?: () => Promise<string | null>
}

export class Transporte {
  private ws: WebSocket | null = null
  private suscripciones = new Map<string, Set<Manejador>>()
  private anunciados = new Set<string>()
  private ultimaLlegada = new Map<string, number>()
  /**
   * El último mensaje de cada topic, para que una pestaña recién montada no
   * arranque en blanco. Lo lee `useTopicFechado`; `useTopic` lo ignora.
   *
   * 🔴 MUERE CON EL ENLACE, y esa es la mitad del diseño. Si sobreviviera a un
   *    cierre, un robot que se quedó mudo seguiría enseñando su último voltaje
   *    como si estuviera vivo — el mismo modo de fallo que este proyecto
   *    persigue en el robot: el RVR dormido con el nodo vivo, el nodo muerto
   *    con systemd en verde, el topic registrado y sin publicar.
   *    Se vacía en `olvidar()`, que llaman los DOS caminos de cierre.
   */
  private ultimoMensaje = new Map<string, { valor: unknown; recibidoEn: number }>()
  private pendientes = new RegistroPendientes()
  private oyentesCierre = new Set<() => void>()
  private oyentesAviso = new Set<(a: Aviso) => void>()
  /** Un oyente de avance por objetivo vivo. Se borra al llegar su resultado. */
  private oyentesAvance = new Map<string, (v: unknown) => void>()
  private contador = 0
  private intentos = 0
  private reconexionProgramada: ReturnType<typeof setTimeout> | null = null
  private plazoProgramado: ReturnType<typeof setTimeout> | null = null
  /**
   * 🔴 Marca de agua para descartar un testigo que llega TARDE.
   *
   * Pedir el testigo es asincrono, asi que entre «lo pido» y «abro el socket»
   * cabe un `cerrar()` del usuario, o un `conectar()` nuevo. Sin esto, un
   * testigo en vuelo abriria un socket **despues** de que alguien cerrara — que
   * es la misma familia de carrera que C3 y R1, ya pagadas en esta clase.
   */
  private generacion = 0

  constructor(
    private url: string,
    private fabrica: FabricaWS = (u, p) => (p === undefined ? new WebSocket(u) : new WebSocket(u, p)),
    private opciones: OpcionesTransporte = {},
  ) {}

  get conectado(): boolean {
    return this.ws !== null && this.ws.readyState === 1
  }

  /** Para que la teleoperacion pueda cortar su bucle al caerse el enlace. */
  alCerrarse(cb: () => void): () => void {
    this.oyentesCierre.add(cb)
    return () => this.oyentesCierre.delete(cb)
  }

  /**
   * Avisos LOCALES del cliente. Hoy solo uno: un mensaje entrante ilegible.
   *
   * ⚠️ NO llega por aqui ninguna denegacion de rosbridge, aunque seria el sitio
   *    natural. Verificado en el fuente de rosbridge 2.7.0: `Protocol.log()`
   *    escribe en el logger DEL NODO y ahi acaba —`"status"` tiene 0
   *    apariciones en `protocol.py` y en `rosbridge_server`—, asi que el aviso
   *    se queda en el journal del robot y NO sale por el socket.
   * → No hay red de seguridad si la lista blanca del robot se separa de
   *   `contrato.ts`. Lo unico que avisa es el plazo de 5 s de `llamar()`, y por
   *   eso existe `comprobar_contrato.mjs`.
   */
  alAviso(cb: (a: Aviso) => void): () => void {
    this.oyentesAviso.add(cb)
    return () => this.oyentesAviso.delete(cb)
  }

  private avisar(a: Aviso): void {
    for (const cb of this.oyentesAviso) cb(a)
  }

  /**
   * Desarma el plazo de conexion. Se llama en `onopen`, en `onclose` y en
   * `cerrar()`: si se olvidara en alguno, un temporizador huerfano cerraria
   * mas tarde un socket sano — el mismo fallo que ya tuvo `reconexionProgramada`
   * y que costo 3 sockets contra 1 en el control.
   */
  private cancelarPlazo(): void {
    if (this.plazoProgramado !== null) {
      clearTimeout(this.plazoProgramado)
      this.plazoProgramado = null
    }
  }

  conectar(): void {
    if (this.ws !== null) return

    const pedir = this.opciones.testigo
    // Sin proveedor, el camino de siempre: abrir y ya.
    if (pedir === undefined) { this.abrir(); return }

    const mia = ++this.generacion
    pedir().then(
      (testigo) => {
        // Llego tarde: alguien cerro, o ya hay otro socket. Se tira.
        if (mia !== this.generacion || this.ws !== null) return
        if (testigo === null) {
          this.sinTestigo('El servidor no ha dado una credencial para este robot. '
            + 'Puede que se haya cerrado tu sesión.')
          return
        }
        this.abrir([`${PREFIJO_TESTIGO}${testigo}`, SUBPROTOCOLO_AGENTE])
      },
      (e: unknown) => {
        if (mia !== this.generacion) return
        this.sinTestigo('No he podido pedir la credencial al servidor: '
          + (e instanceof Error ? e.message : String(e)))
      },
    )
  }

  /**
   * No hay testigo, asi que no se abre nada — pero SI se reintenta.
   *
   * 🔴 Al contrario que un 4403, esto no dice «tu credencial no vale»: dice que
   *    no se ha podido PEDIR. Un servidor que reinicia o un WiFi con hipo son
   *    transitorios, y rendirse aqui dejaria la pagina muerta hasta recargarla.
   */
  private sinTestigo(mensaje: string): void {
    this.avisar({ nivel: 'error', mensaje })
    if (this.opciones.reconectar !== true) return
    const espera = esperaReconexion(this.intentos++, this.opciones.aleatorio)
    const programar = this.opciones.programar ?? setTimeout
    this.reconexionProgramada = programar(() => {
      this.reconexionProgramada = null
      this.conectar()
    }, espera)
  }

  private abrir(protocolos?: string[]): void {
    // 🔴 Cancela una reconexion ya programada ANTES de nada: si no, un
    //    `conectar()` manual mientras hay un temporizador pendiente lo deja
    //    huerfano —solo se sobrescribia la referencia— y ese temporizador
    //    dispara mas tarde, incluso DESPUES de un `cerrar()`. Medido: 3 sockets
    //    contra 1 en el control.
    if (this.reconexionProgramada !== null) {
      clearTimeout(this.reconexionProgramada)
      this.reconexionProgramada = null
    }
    // 🔴 IDEMPOTENTE. Sin esta guarda, dos llamadas dejaban DOS sockets vivos:
    //    cada mensaje se entregaba dos veces, y el `onclose` del viejo cancelaba
    //    las llamadas pendientes del nuevo, que estaba sano.
    if (this.ws !== null) return

    const ws = this.fabrica(this.url, protocolos)
    this.ws = ws

    /*
     * ═════════════════════════════════════════════════════════════════════
     * 🔴🔴 PLAZO DE CONEXION. UN SOCKET COLGADO NO DA ERROR **NUNCA**.
     * ═════════════════════════════════════════════════════════════════════
     * Medido en el navegador el 2026-08-04 por la mañana, con el robot
     * encendido y sano:
     *
     *   ws://rvr-01.local:9090   🔴 12 s sin onopen, sin onerror, sin onclose
     *   ws://10.14.7.7:9090      🔴 12 s igual — MISMA FIRMA
     *   ws://192.168.1.58:9090   ✅ abre
     *   ws://192.168.1.200:9090  ✅ abre
     *
     * `rvr-NN.local` resolvia a CUATRO direcciones y el sistema las devolvia
     * en este orden: `fe80::…` (IPv6 link-local **sin zona**, que el navegador
     * no puede usar), `10.14.7.7` (la estatica del laboratorio, inalcanzable
     * desde casa), y despues las dos que si servian. Las dos primeras no
     * FALLABAN: se colgaban, y un SYN sin respuesta tarda ~21 s en rendirse,
     * asi que el navegador nunca llegaba a las buenas.
     *
     * ✅ **ESA CAUSA ESTA CERRADA EN EL ROBOT** desde la tarde del 2026-08-04
     *    (evidencia 74): una direccion por red con `[Match] SSID=` de
     *    systemd-networkd, y en avahi `use-ipv6=no` **mas**
     *    `publish-aaaa-on-ipv4=no` — sin lo segundo el registro `AAAA` se
     *    seguia anunciando por el transporte IPv4. Hoy `rvr-01.local` resuelve
     *    a **una sola** direccion y `ws://rvr-01.local:9090` **abre**: 4339 ms
     *    en frio, 2331 en caliente, verificado desde el navegador.
     *
     * 🔴 **Y este plazo NO sobra por eso**, por tres motivos medidos:
     *    · el aula esta **sin probar entera** — `05-atriz-lab.network` nunca ha
     *      casado con nada, y si el SSID difiere en un caracter el robot cae al
     *      netplan generico;
     *    · un robot apagado sigue dando exactamente esta firma: cuelgue mudo;
     *    · y sin `onclose` la reconexion con espera creciente **no llega ni a
     *      arrancar**, asi que el muro dejaba 16 conexiones colgadas.
     *
     * 🔴 Sin este plazo el muro dejaba **16 conexiones colgadas para siempre**
     *    y ninguna llamaba a `onclose`, o sea que la reconexion con espera
     *    creciente —que existe justo para esto— no llegaba a arrancar.
     *
     * Cerrar un socket en CONNECTING dispara su `onclose`, y con el sale por
     * el camino normal: aviso, cancelacion de pendientes y reintento.
     *
     * ⚠️ Esto NO arregla la direccion mala: la interfaz tiene que dejar apuntar
     *    a una IP concreta. Lo que arregla es que colgarse deje de ser
     *    invisible — que es la familia de fallo que este proyecto persigue.
     */
    const plazo = this.opciones.plazoConexion ?? PLAZO_CONEXION_MS
    if (plazo > 0) {
      const programar = this.opciones.programar ?? setTimeout
      this.plazoProgramado = programar(() => {
        this.plazoProgramado = null
        // Si ya no es el socket vigente, o ya abrio, no hay nada que cortar.
        if (this.ws !== ws || ws.readyState !== 0) return
        this.avisar({
          nivel: 'error',
          mensaje: `no se abrio el WebSocket a ${this.url} en ${plazo} ms. `
            + 'Un socket colgado no da error: puede ser que el nombre resuelva a una '
            + 'direccion inalcanzable desde esta red.',
        })
        ws.close()
      }, plazo)
    }

    ws.onopen = () => {
      // 🔴 C3: si mientras tanto YA hay un socket mas nuevo (`this.ws` cambio),
      //    este `onopen` es de un socket VIEJO/obsoleto: salir sin tocar nada.
      if (this.ws !== ws) return
      this.cancelarPlazo()
      // 🔴 `intentos` NO se reinicia aqui. Que el socket ABRA no prueba que el
      //    enlace sirva: con rosbridge reiniciandose, cada ciclo pasaba por
      //    `onopen` antes que por `onclose` y la espera se quedaba clavada en
      //    ~1 s para siempre — el antipatron del driver que esto evita.
      //    Se reinicia cuando llega un MENSAJE, que si lo prueba.
      // Al reconectar se resuscribe a TODO: rosbridge infiere el QoS mirando
      // los publicadores al suscribirse y no se reajusta despues.
      // 🔴 C2: cada topic en su propio try/catch. `suscribir()` ya impide que
      //    entre un topic invalido por la via publica, pero un solo topic que
      //    lance aqui (por la razon que sea) no debe arrastrar a los demas ni
      //    cortar el bucle de reanuncio de abajo -que es donde vive
      //    /emergency_stop.
      for (const topic of this.suscripciones.keys()) {
        try {
          this.enviar(opSubscribe(topic))
        } catch (error) {
          this.avisar({
            nivel: 'error',
            mensaje: `no se pudo re-suscribir a «${topic}»: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }
      // Se reanuncia TODO lo que estaba anunciado. No se limpia `anunciados` al
      // cerrar a proposito: asi /emergency_stop vuelve anunciado desde el primer
      // instante y pulsar la parada es UN mensaje, no un advertise + un publish.
      for (const topic of this.anunciados) {
        try {
          this.enviar(opAdvertise(topic))
        } catch (error) {
          this.avisar({
            nivel: 'error',
            mensaje: `no se pudo re-anunciar «${topic}»: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }
    }

    ws.onmessage = (e: MessageEvent) => {
      // 🔴 C3: mensaje de un socket VIEJO despues de que `this.ws` ya apunte
      //    a otro (una reconexion rapida puede dejar el viejo entregando
      //    mensajes un rato). No debe alimentar `entrante()` con datos de un
      //    socket que ya no es el vigente.
      if (this.ws !== ws) return
      let m: unknown
      try {
        m = JSON.parse(String(e.data))
      } catch {
        // Un mensaje ilegible no puede tumbar el manejador entero ni pasar mudo.
        this.avisar({ nivel: 'error', mensaje: 'mensaje entrante ilegible: JSON invalido' })
        return
      }
      this.entrante(m as Parameters<typeof this.entrante>[0])
    }

    /*
     * 🆕 FASE B (A7): `evento` es OPCIONAL porque los dobles de las pruebas
     *    llaman `this.onclose?.()` sin argumentos, mientras el WebSocket real
     *    siempre pasa un `CloseEvent`. Sin evento se cae en el caso «reintentar
     *    y en silencio», que es exactamente lo que hacia esta clase antes.
     *
     * ⚠️ Y por eso hay una prueba que dispara un cierre CON un 4403 de verdad:
     *    si el camino nuevo solo se ejercitara con dobles sin evento, estaria
     *    sin cubrir y nadie lo notaria.
     */
    ws.onclose = (evento?: { code?: number; reason?: string }) => {
      // 🔴🔴 C3, EL CRITICO: el `close()` de un WebSocket real es ASINCRONO.
      //    `cerrar()` anula `this.ws` de inmediato (sincrono, deliberado) y un
      //    `conectar()` justo despues (el boton "Reconectar" tipico:
      //    `cerrar(); conectar()`) ya deja `this.ws` apuntando al socket
      //    NUEVO antes de que este `onclose` DEL VIEJO llegue a disparar. Sin
      //    esta guarda, `this.ws = null` de aqui abajo anulaba el socket
      //    NUEVO y VIVO: medido, `conectado` pasaba a `false` con el socket
      //    nuevo en OPEN y `/odom` seguiendo entrando -telemetria viva mas
      //    parada muerta (`publicar('/emergency_stop')` lanzando para
      //    siempre), la cancelacion de las llamadas en vuelo del socket sano
      //    (`pendientes.cancelarTodas`), y el corte del bucle de
      //    teleoperacion via `oyentesCierre`. Un `onclose` que no es el del
      //    socket vigente no debe tocar NADA de este estado.
      if (this.ws !== ws) return
      this.cancelarPlazo()
      this.ws = null
      // 🔴 NO se limpia `anunciados` aqui: ver el comentario del bucle de
      //    reanuncio en `onopen`. Limpiarlo dejaba ese bucle recorriendo
      //    siempre un conjunto vacio -codigo muerto- y perdia el reanuncio
      //    anticipado justo donde mas importa, /emergency_stop.
      this.pendientes.cancelarTodas('se cerro el WebSocket')
      // 🔴 El OTRO camino de cierre. Sin esto, una caida del WiFi -que es la que
      //    de verdad ocurre- dejaria el recuerdo vivo y las tarjetas seguirian
      //    enseñando el ultimo voltaje de un robot que ya no contesta.
      this.olvidar()
      for (const cb of this.oyentesCierre) cb()
      // 🔴 NO se libera la parada de emergencia al reconectar: liberarla es
      //    siempre un acto humano deliberado.
      // 🔴 Y esto NUNCA se alcanza tras un `cerrar()` deliberado: `cerrar()`
      //    ya dejo `this.ws` en `null` de forma SINCRONA (ver mas abajo), asi
      //    que la guarda de arriba (`this.ws !== ws`) sale antes de llegar
      //    aqui. Por eso ya no hace falta una bandera aparte para distinguir
      //    «lo pidio el usuario» de «se cayo el enlace» -habia una
      //    (`cierreDeliberado`) y quedo muerta tras el arreglo de R1:
      //    medido quitandola, las 87 pruebas siguen en verde. Sin la guarda
      //    de C3 esto SI haria falta -era su version anterior, cuando
      //    `onclose` corria sin ella y un `cerrar()` levantaba un socket
      //    nuevo que seguia recibiendo /scan —el 83 % del trafico— sin que
      //    nadie supiera que existia.
      /*
       * 🔴🔴 HAY CIERRES QUE NO TIENE SENTIDO REINTENTAR, Y REINTENTARLOS HACE
       *    DAÑO. Si el robot cerro porque no acepta la credencial (4401/4403/
       *    4404), la espera creciente dejaria «reconectando…» en bucle —hasta
       *    el minuto entre intentos— mientras el robot ya dijo con todas las
       *    letras *«esa credencial es para otro robot»*. Un motivo que existe y
       *    no llega a quien tiene que leerlo es la firma de fallo que este
       *    proyecto persigue.
       *
       * 🔴 El 1013 (la Pi sin hora, sin RTC) SI se reintenta aunque venga del
       *    mismo mecanismo: se arregla solo en ~18 s. La distincion vive en
       *    `rechazo.ts` con sus 17 pruebas, no aqui.
       */
      const lectura = leerCierre(evento?.code ?? 0, evento?.reason ?? '')
      if (lectura.explicacion !== null) {
        this.avisar({ nivel: 'aviso', mensaje: lectura.explicacion })
      }
      if (this.opciones.reconectar && lectura.reintentar) {
        const espera = esperaReconexion(this.intentos++, this.opciones.aleatorio)
        const programar = this.opciones.programar ?? setTimeout
        this.reconexionProgramada = programar(() => {
          this.reconexionProgramada = null
          this.conectar()
        }, espera)
      }
    }
  }

  cerrar(): void {
    // 🔴 Lo PRIMERO: invalida un testigo en vuelo. Sin esto, un `cerrar()`
    //    mientras se pedia la credencial dejaba llegar la respuesta despues y
    //    abrir un socket que nadie habia pedido — telemetria viva a espaldas
    //    del usuario, que es exactamente el sintoma de C3 por otra puerta.
    this.generacion++
    if (this.reconexionProgramada !== null) {
      clearTimeout(this.reconexionProgramada)
      this.reconexionProgramada = null
    }
    // Sin esto, cerrar un transporte que estaba CONNECTING dejaba vivo su
    // plazo: disparaba despues, sobre `this.ws` ya en `null`, y aunque la
    // guarda lo descarta, avisaba de un fallo de algo que el usuario cerro.
    this.cancelarPlazo()
    // 🔴 R1: el `close()` de un WebSocket real es ASINCRONO (ver el comentario
    //    de C3 en `ws.onclose`, mas abajo), asi que su `onclose` diferido no
    //    ha disparado todavia en este punto. La guarda de C3 (`this.ws !== ws`)
    //    lo va a descartar en cuanto llegue, porque `this.ws` esta a punto de
    //    quedar en `null` -y eso es CORRECTO para un socket viejo tras un
    //    `cerrar(); conectar()`, pero significa que NO podemos confiar en que
    //    ese `onclose` haga el desmontaje: hay que hacerlo aqui, explicito,
    //    ANTES de anular `this.ws`. Sin esto, un `cerrar()` a secas ya no
    //    cancelaba las llamadas pendientes ni avisaba a `oyentesCierre` -la
    //    misma atribucion falsa de I1 (pendientes que vencen su plazo y
    //    culpan al robot), reintroducida por otra puerta.
    // Solo si habia algo que cerrar: si `this.ws` ya era `null` (nunca se
    // conecto, o ya se habia caido y su propio `onclose` ya hizo este mismo
    // desmontaje), no hay nada que cancelar ni que avisar dos veces.
    if (this.ws !== null) {
      this.ws.close()
      this.pendientes.cancelarTodas('se cerro el WebSocket')
      this.olvidar()
      // Sus promesas ya se rechazaron arriba; dejar los oyentes vivos seria una
      // fuga y, peor, un avance de una reconexion podria llegarle a un objetivo
      // que ya nadie espera.
      this.oyentesAvance.clear()
      for (const cb of this.oyentesCierre) cb()
      this.ws = null
    }
  }

  private enviar(op: unknown): void {
    this.ws?.send(JSON.stringify(op))
  }

  private entrante(m: {
    op: string; topic?: string; msg?: unknown; id?: string; values?: unknown; result?: boolean
  }): void {
    // Un mensaje que llega SI prueba que el enlace sirve. Ver `onopen`.
    this.intentos = 0

    if (m.op === 'publish' && m.topic) {
      const ahora = Date.now()
      this.ultimaLlegada.set(m.topic, ahora)
      this.ultimoMensaje.set(m.topic, { valor: m.msg, recibidoEn: ahora })
      for (const cb of this.suscripciones.get(m.topic) ?? []) cb(m.msg)
      return
    }
    if (m.op === 'service_response' && m.id) {
      // 🔴 rosbridge manda `result: false` cuando el servicio FALLA, con el
      //    motivo REAL en `values` (call_service.py). Resolverlo como exito
      //    tiraba ese motivo y lo sustituia por una conjetura ocho segundos
      //    despues —«no llego ningun /scan, puede que el LIDAR no haya
      //    arrancado»—, apuntando al sitio equivocado. Es «mide antes de
      //    atribuir» al reves, y escrito en el mensaje que lee el alumno.
      if (m.result === false) {
        this.pendientes.rechazar(m.id, `el servicio fallo: ${String(m.values)}`)
        return
      }
      this.pendientes.resolver(m.id, m.values)
      return
    }

    /*
     * ── ACCIONES ────────────────────────────────────────────────────────────
     * El avance NO resuelve nada: solo avisa. Una accion puede mandar decenas
     * de `action_feedback` antes del unico `action_result`, y confundirlos
     * cerraria la navegacion en el primer parte de progreso.
     */
    if (m.op === 'action_feedback' && m.id) {
      this.oyentesAvance.get(m.id)?.(m.values)
      return
    }
    if (m.op === 'action_result' && m.id) {
      this.oyentesAvance.delete(m.id)
      // 🔴 MISMA FORMA QUE `service_response`, y medida contra el robot: al
      //    fallar, `values` llega como CADENA («No action server available»),
      //    no como el objeto de resultado. Resolverlo como exito pondria esa
      //    frase donde la pantalla espera una pose.
      if (m.result === false) {
        this.pendientes.rechazar(m.id, `la accion fallo: ${String(m.values)}`)
        return
      }
      this.pendientes.resolver(m.id, m.values)
      return
    }
  }

  /**
   * Manda un objetivo de accion y espera su RESULTADO. Los avances llegan por
   * `alAvance`, que se registra antes de enviar.
   *
   * 🔴 LLEVA PLAZO LOCAL, Y NO ES SIMETRICO CON `llamar()`. En un servicio el
   *    plazo lo negocia rosbridge; aqui **no hay campo `timeout`** en el `op`,
   *    asi que si el objetivo nunca termina la promesa se queda colgada. Y
   *    medido: un `op` que rosbridge no entiende **no produce ni un byte de
   *    respuesta** —silencio absoluto en 4 s—, o sea que una errata en el nombre
   *    de la accion es indistinguible de «sigue navegando».
   *
   * ⚠️ El plazo por defecto es LARGO a proposito (5 min): una navegacion de
   *    verdad tarda, y un plazo corto cancelaria la espera de un robot que va
   *    bien. Quien llame puede acortarlo.
   */
  enviarObjetivo(
    accion: string,
    tipo: string,
    args: unknown,
    opciones: { ms?: number; alAvance?: (v: unknown) => void } = {},
  ): { id: string; resultado: Promise<unknown> } {
    const ms = opciones.ms ?? PLAZO_ACCION_MS
    if (!this.conectado) {
      return {
        id: '',
        resultado: Promise.reject(
          new Error(`sin conexion con el robot: el objetivo de «${accion}» NO se ha enviado`),
        ),
      }
    }
    const id = `atriz-act-${++this.contador}`
    // Mismo orden que en `llamar()`, y por el mismo fallo ya pagado: la op se
    // construye ANTES de registrar la pendiente, porque `opSendActionGoal`
    // lanza si la accion no esta en la lista blanca — y una promesa registrada
    // antes del throw queda huerfana y se autorrechaza sola minutos despues.
    const op = opSendActionGoal(accion, tipo, args, id)
    if (opciones.alAvance) this.oyentesAvance.set(id, opciones.alAvance)
    const resultado = this.pendientes.registrar(id, ms)
    this.enviar(op)
    return { id, resultado }
  }

  /**
   * Cancela un objetivo en marcha.
   *
   * ⚠️ NO resuelve ni rechaza la promesa: rosbridge contesta igualmente con un
   *    `action_result` —con `status` de cancelado—, y es ese el que cierra la
   *    espera. Cerrarla aqui dejaria la respuesta real sin dueño.
   */
  cancelarObjetivo(accion: string, id: string): void {
    if (!this.conectado) return
    this.enviar(opCancelActionGoal(accion, id))
  }

  suscribir(topic: string, cb: Manejador): () => void {
    const nueva = !this.suscripciones.has(topic)
    // 🔴 C2: validar ANTES de tocar el Map, este conectado o no.
    //    `opSubscribe(topic)` lanza aqui, en el sitio del error, con el Map
    //    todavia intacto -antes solo se validaba `if (nueva && this.conectado)`,
    //    asi que:
    //    - Desconectado: no lanzaba nada aqui. El fallo aparecia MAS TARDE,
    //      dentro de `onopen`, y ahi la excepcion escapaba del manejador sin
    //      procesar el resto de topics ni el reanuncio.
    //    - Conectado: lanzaba, pero DESPUES de mutar el Map y ANTES de
    //      devolver la funcion de baja: la entrada quedaba dentro sin
    //      ninguna forma publica de quitarla -zombie para siempre.
    const op = nueva ? opSubscribe(topic) : null
    if (nueva) this.suscripciones.set(topic, new Set())
    this.suscripciones.get(topic)!.add(cb)
    if (op && this.conectado) this.enviar(op)
    return () => {
      const oyentes = this.suscripciones.get(topic)
      if (!oyentes) return
      oyentes.delete(cb)
      // 🔴 Al quedarse SIN oyentes hay que decirselo AL ROBOT, no solo dejar de
      //    escuchar. Si no, /scan —el 83 % del trafico por robot— sigue llegando
      //    para siempre, y la reconexion se resuscribe a un topic que ya nadie
      //    quiere. Silencioso y caro.
      if (oyentes.size === 0) {
        this.suscripciones.delete(topic)
        if (this.conectado) this.enviar(opUnsubscribe(topic))
      }
    }
  }

  publicar(topic: string, msg: unknown): void {
    // 🔴 LANZA si no hay enlace. `this.ws?.send()` no-opeaba EN SILENCIO, y por
    //    aqui pasa /emergency_stop: una parada perdida sin que nadie se entere
    //    es el fallo mas caro y mas repetido de este proyecto. Quien publique
    //    tiene que poder decirle al usuario que NO se envio.
    if (!this.conectado) {
      throw new Error(`sin conexion con el robot: «${topic}» NO se ha enviado`)
    }
    if (!this.anunciados.has(topic)) {
      this.enviar(opAdvertise(topic))
      this.anunciados.add(topic)
    }
    this.enviar(opPublish(topic, msg))
  }

  /**
   * `ms` es el plazo que se le pide a ROSBRIDGE (se manda como `timeout`, en
   * segundos: ver `opCallService`). El temporizador LOCAL de verdad es mayor
   * -`ms + MARGEN_PLAZO_LOCAL_MS`-, a proposito: ver el comentario de
   * `MARGEN_PLAZO_LOCAL_MS`, arriba. Asi rosbridge tiene sitio para contestar
   * con el motivo REAL antes de que el generico local lo sustituya.
   */
  llamar(servicio: string, args: unknown = {}, ms = 5000): Promise<unknown> {
    // Mismo motivo que `publicar`: sin enlace se dice en el acto, no se espera
    // cinco segundos a un plazo que ya se sabe que va a vencer.
    if (!this.conectado) {
      return Promise.reject(new Error(`sin conexion con el robot: «${servicio}» NO se ha llamado`))
    }
    const id = `atriz-${++this.contador}`
    // 🔴 I1: construir la op ANTES de registrar. `opCallService()` lanza en
    //    el acto si el servicio no esta en la lista blanca -y antes eso
    //    pasaba DESPUES de `registrar()`, que ya habia creado la promesa y su
    //    temporizador. La promesa quedaba huerfana (nadie la recibe: el throw
    //    corta `llamar()` antes de `return p`) y 5 s despues rechazaba sola,
    //    sin que nadie la escuchara, con el «sin respuesta... puede estar
    //    denegado o el robot puede estar caido» generico -el cliente se
    //    autorrechazo la llamada y mando a diagnosticar el robot.
    const op = opCallService(servicio, args, id, ms / 1000)
    const p = this.pendientes.registrar(id, ms + MARGEN_PLAZO_LOCAL_MS)
    this.enviar(op)
    return p
  }

  /**
   * El último mensaje recibido de un topic, con cuándo llegó. `null` = no hay
   * ninguno, **o el enlace se cerró** — que para quien lo pinta es lo mismo:
   * no hay nada que se pueda afirmar de este robot ahora.
   *
   * ⚠️ Quien lo use TIENE que enseñar la edad al lado. Pintar los 7,67 V de
   *    hace 29 s como si fueran de ahora es mentir, y ese es exactamente el
   *    fallo del que este proyecto se defiende con `antiguedad_termico_s` en el
   *    robot: una temperatura plana puede ser el mismo dato repetido.
   *
   * 🔴 Y NO vale para todo: sembrar `/scan` con un barrido viejo dibujaría una
   *    geometría que ya no existe. Por eso esto es opt-in por tarjeta y no un
   *    cambio en `useTopic`.
   */
  ultimoDe(topic: string): { valor: unknown; recibidoEn: number } | null {
    return this.ultimoMensaje.get(topic) ?? null
  }

  /**
   * Olvida lo recibido. Lo llaman los DOS caminos de cierre —`cerrar()` y el
   * `onclose` de una caída—, porque un recuerdo que sobreviva al enlace es un
   * robot muerto con aspecto de vivo.
   */
  private olvidar(): void {
    this.ultimoMensaje.clear()
  }

  /** null = no ha llegado ninguno todavia. Es lo que alimenta salud.ts. */
  msDesdeUltimo(topic: string): number | null {
    const t = this.ultimaLlegada.get(topic)
    return t === undefined ? null : Date.now() - t
  }
}
