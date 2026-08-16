'use client'

/**
 * Teleoperacion. Es la ULTIMA pantalla del orden de construccion, y no por
 * dificultad: **ninguna de las diez practicas del laboratorio teleopera**. El
 * producto es el terminal; esto es la herramienta de servicio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LAS CUATRO REGLAS QUE ESTA PANTALLA NO PUEDE ROMPER
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. **Se publica en `/cmd_vel_raw`, NUNCA en `/cmd_vel`.** `/cmd_vel` es la
 *    SALIDA del `collision_monitor`: publicar ahi funciona y **salta la capa de
 *    seguridad entera** sin ningun aviso. Aqui no se publica a mano: lo hace
 *    `useTeleoperacion`, que ya lo acierta.
 *
 * 2. **Una sola `Teleoperacion` por pantalla.** `useTeleoperacion()` crea una
 *    instancia con su propio bucle de 10 Hz; dos componentes llamandolo serian
 *    dos bucles publicando twists distintos contra el mismo robot. Por eso el
 *    boton de parada la recibe como prop en vez de crearse la suya.
 *
 * 3. **No hay boton de liberar la parada.** Ver `BotonParada`.
 *
 * 4. **El bucle muere con la pantalla.** La limpieza de `useTeleoperacion` llama
 *    a `desmontar()`. Sin eso, cambiar de pestaña dejaria el robot conduciendo
 *    con nadie sujetando nada.
 *
 * 📝 La red de seguridad de abajo: el watchdog del driver corta a los 0,3 s sin
 * `cmd_vel_raw` (medido: para en 527 ms y 7,9 cm). Todo lo de aqui esta pensado
 * para no depender de el, pero esta ahi.
 */

import { useEffect, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { ACCION_MONITOR, useTopic } from '@/hooks/useTopic'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import {
  SIN_DATO, horaCorta, metrosPorSegundo, partirUnidad, radianesPorSegundo,
} from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { interpretarSeguridad, seMueve } from '@/lib/interfaz/seguridad'
import { Monitor, Pedido, Veredicto, resumirBarrido } from '@/lib/robot/barrido'
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'
import { OrdenMando, V_MIN } from '@/lib/interfaz/palanca'
import { DeslizadorVelocidad, LoQuePido, Palanca } from './MandoPalanca'
import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { PanelEnlace } from './EstadoEnlace'
import { useMuestreo } from './useMuestreo'

/*
 * 📝 AQUI VIVIAN `VELOCIDADES` (0,10 y 0,20) y `GIRO` (0,8 rad/s), y se fueron
 *    con la cruz de mando el 2026-08-16.
 *
 * Las dos velocidades eran las UNICAS que ofrecia esta pantalla, y su comentario
 * decia lo importante: **estan medidas** —pidiendo 0,20 la meseta real es 0,199,
 * el 100 %, y se alcanza en ~0,5 s de rampa—. Eso no se pierde: siguen siendo
 * los dos extremos del deslizador, y `lib/interfaz/palanca.ts` usa 0,10 como
 * suelo por el mismo motivo.
 *
 * `GIRO` era fijo. Ahora el giro es continuo entre 0,5 y 1,2 rad/s, que sigue
 * dentro de la banda donde esta medido que el robot cumple el 99-102 %.
 *
 * 🔴 Y el tope de 0,40 m/s sigue SIN ofrecerse, que es una decision escrita:
 *    «teleoperar a ciegas desde un navegador no es el sitio para la velocidad
 *    maxima». El deslizador llega a 0,20, no a 0,40.
 */

/**
 * EL BARRIDO DEL LIDAR — el primer bloque de esta pantalla, y con motivo.
 *
 * 👤 Subido aqui el 2026-08-16 a peticion del usuario. Estaba de CUARTA tarjeta,
 *    segunda de la columna izquierda, debajo de «Enlace». Y sin barrido el Mando
 *    —la tarjeta hero, la primera— **no hace nada**: la capa de seguridad
 *    bloquea el movimiento. O sea que el orden estaba invertido: lo que hay que
 *    resolver primero salia el cuarto.
 */
function Barrido({ teleoperacion }: { teleoperacion: ControlTeleoperacion }) {
  const { transporte, conectado } = useRobot()
  const [pedido, setPedido] = useState<Pedido>({ clase: 'NADA' })

  /*
   * 🔴 EL MONITOR YA ESTA SUSCRITO EN ESTA PANTALLA, asi que leerlo aqui cuesta
   *    CERO. Es lo unico gratis que sabe algo del barrido: publica
   *    `polygon_name: 'invalid source'` cuando no le llega `/scan`.
   *
   * ⚠️ Y su limite es duro: **solo habla cuando procesa una orden de
   *    movimiento**. Con el robot quieto no llega nada, y eso es «no se sabe»,
   *    nunca «encendido». `resumirBarrido()` lo respeta.
   *
   * 🔴 El testigo directo seria `/scan`, y NO se paga aqui: son 66,98 kB/s por
   *    robot —el 83 % de todo su trafico— y con dieciseis pestañas ~8,6 Mbit/s.
   *    El rail tiene escrito que «Lo que ve» es una pestaña aparte justo por eso.
   */
  const monitorCrudo = useTopic(transporte, '/collision_monitor_state')
  const seguridad = interpretarSeguridad(monitorCrudo)
  const monitor: Monitor = monitorCrudo === null
    ? 'NO_SE_SABE'
    : (seguridad.faltaBarrido ? 'FALTA_BARRIDO' : 'HAY_BARRIDO')

  const veredicto = resumirBarrido(pedido, monitor)

  const arrancar = async () => {
    setPedido({ clase: 'ARRANCANDO' })
    try {
      // 🔴 Esto espera un `/scan` DE VERDAD, no el codigo de retorno de
      //    `/start_scan`. El servicio puede responder que si y no llegar ni un
      //    barrido -y el sintoma seria «el robot no obedece», buscado en el sitio
      //    equivocado.
      await teleoperacion.arrancarBarrido()
      setPedido({ clase: 'ARRANCADO', hora: horaCorta(Date.now()) })
    } catch (error) {
      setPedido({
        clase: 'FALLO',
        detalle: error instanceof Error ? error.message : String(error),
        hora: horaCorta(Date.now()),
      })
    }
  }

  const parar = async () => {
    try {
      await transporte.llamar('/stop_scan')
      setPedido({ clase: 'PARADO', hora: horaCorta(Date.now()) })
    } catch (error) {
      setPedido({
        clase: 'FALLO',
        detalle: error instanceof Error ? error.message : String(error),
        hora: horaCorta(Date.now()),
      })
    }
  }

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 👤 UNA FRANJA, NO UNA TARJETA (2026-08-16) — «hay una seccion muy grande
   *    para el barrido del LIDAR»
   * ═══════════════════════════════════════════════════════════════════════════
   * Tenia razon, y era culpa mia de esta misma sesion: al subirla al primer
   * puesto le puse titulo, subtitulo, insignia, dos botones, un parrafo y un
   * aviso — o sea que la PRECONDICION del Mando ocupaba mas que el Mando.
   *
   * Ahora es una franja de una linea: **estado + dos botones**, y nada mas. La
   * explicacion larga aparece SOLO cuando hace falta, que es cuando la capa de
   * seguridad esta bloqueando.
   *
   * 📌 Es la misma leccion que la parada: lo que tiene que estar SIEMPRE a la
   *    vista tiene que ocupar lo que ocupa un mando, no lo que ocupa un texto.
   */
  return (
    <div className="vidrio rounded-ficha">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
        <span className="microetiqueta shrink-0">barrido del LIDAR</span>
        {/*
          🔴 EL ESTADO VA PRIMERO Y AL LADO DE LOS BOTONES, no debajo en prosa.
             Aqui vivia una frase fija —«el barrido arranca APAGADO con el
             robot»— que se pintaba en cada carga de pagina: una explicacion
             general ocupando el hueco donde alguien busca el estado ACTUAL.
             Enciende el barrido, recarga, y afirmaba «apagado» sobre un LIDAR
             girando a 11,8 Hz.
        */}
        <Insignia tono={TONO_BARRIDO[veredicto.clase]}>{veredicto.titulo}</Insignia>
        {veredicto.enVivo && <span className="microetiqueta">lo dice el robot</span>}

        {/* `ml-auto`: los mandos al canto derecho, como en un frontal. */}
        <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!conectado || pedido.clase === 'ARRANCANDO'}
          onClick={() => void arrancar()}
          /* Mismo motivo que la pildora de velocidad: `--primary` vale el mismo
             RGB que `--bloque-vivo`, o sea vocabulario de ESTADO. Aqui manda el
             tono de la pantalla. */
          className="rounded-md bg-[rgb(var(--seccion-conducir))] px-4 py-2 text-sm font-medium text-white focus-ring hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
        >
          {pedido.clase === 'ARRANCANDO' ? 'Esperando un /scan real…' : 'Arrancar barrido'}
        </button>
        <button
          type="button"
          disabled={!conectado}
          onClick={() => void parar()}
          /* 🔴 `rounded-md`, que le faltaba: este boton y el de al lado son
             hermanos y tenian radios DISTINTOS —14 px contra 0—, o sea una
             pildora pegada a una caja de esquina viva. Se ve a 2,4x en un
             recorte, y `PanelTerminal` ya deja escrito que la forma tambien es
             vocabulario. */
          className="rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground focus-ring hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
        >
          Parar barrido
        </button>
        </div>
      </div>

      {/*
        🔴 EL DETALLE SOLO CUANDO APORTA. Con «no se sabe» —el caso mas
           frecuente— la frase explica por que no se sabe, y eso cabe en una
           linea pequeña. Cuando la capa de seguridad bloquea, el aviso entero.
      */}
      <div className="space-y-2 px-5 pb-3.5">
        <p className="max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          {veredicto.detalle}
        </p>

        {/*
          ═══════════════════════════════════════════════════════════════════════
          👤 «UN MODO PARA CONDUCIR CON EL BARRIDO APAGADO» — 2026-08-16
          ═══════════════════════════════════════════════════════════════════════
          Pedido por el usuario. Auditado sobre el codigo del robot ANTES de
          contestar, y la respuesta es que **por aqui no se puede, y esta cerrado
          a proposito**:

            robot.launch.py:364  ESCRIBIR = ['/cmd_vel_raw','/emergency_stop','/initialpose']
            collision_monitor.yaml:131  source_timeout: 0.5
                                  :128  «sin LIDAR el robot NO SE PUEDE CONDUCIR»

          `move_timed`, `raw_motors`, `move_to_pose`, `move_to_pos_and_yaw` y
          `set_ir_mode` estan los cinco FUERA de la lista blanca — y el driver lo
          dice en `rvr_driver_node.py:3132`: «ESTOS CUATRO SE SALTAN EL
          collision_monitor… le hablan al RVR por el puerto serie». Tampoco se
          puede parar el monitor: no hay servicio de ciclo de vida permitido y
          `params_glob` esta vacio.

          🔴 PERO EL CAMINO EXISTE, y no es este: es el Taller. El agente del
             9443 ejecuta Python del alumno con `rclpy` nativo y alcanza esos
             servicios. El propio proyecto lo tiene escrito — «No es una frontera
             de seguridad».

          👤 Decision del usuario: **no se abre nada; se DICE donde si se puede**,
             con su advertencia. Un callejon mudo se convierte en una salida
             etiquetada, sin tocar la capa de seguridad.
        */}
        {veredicto.clase === 'SIN_BARRIDO' && (
          <Aviso nivel="ATENCION" titulo="Sin barrido no se mueve, y no es una avería">
            La capa de seguridad bloquea el movimiento cuando no le llega <code>/scan</code>: sin
            él, el robot no puede saber si hay algo delante. <strong>Medido</strong>: 0,0 cm con el
            barrido apagado contra 9,9 cm de control.{' '}
            <strong>Si el LIDAR está roto</strong> y aun así necesitas mover el robot, se hace
            desde el <strong>Taller</strong> con <code>rclpy</code> — y ahí{' '}
            <strong>no hay capa de seguridad</strong>: nada frena al robot salvo la parada de
            emergencia.
          </Aviso>
        )}
      </div>
    </div>
  )
}

/**
 * El tono de cada veredicto.
 *
 * 🔴 `SIN_BARRIDO` es ATENCION y no GRAVE: el rojo de esta aplicacion se reserva
 *    para un HECHO POSITIVO —atasco confirmado, bateria critica— y el barrido
 *    apagado es el **estado normal en reposo** de los dieciseis robots. Pintarlo
 *    de rojo seria el muro siempre en alarma, que es como se deja de mirar.
 */
const TONO_BARRIDO: Readonly<Record<Veredicto['clase'], TonoInsignia>> = {
  SIN_BARRIDO: 'ATENCION',
  ENCENDIDO: 'BIEN',
  ARRANCANDO: 'NEUTRO',
  FALLO: 'ATENCION',
  NO_SE_SABE: 'NEUTRO',
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 AQUI VIVIA `CruzDeMando`, Y SE FUE CON SU MANDO (2026-08-16)
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 «los mandos no me acaban de gustar, deberia haber algo como un joystick».
 *
 * Eran cuatro celdas con chevrones en una malla de 3x3 y la parada en el centro,
 * conduciendo con `pointerdown`/`pointerup`. Funcionaba, y su limite era real:
 * **cuatro botones son cuatro ordenes excluyentes**. Para trazar un arco habia
 * que pulsar «adelante», soltar, pulsar «izquierda» — conducir a saltos.
 *
 * 📝 LO QUE SE CONSERVA DE ELLA, porque costo encontrarlo y sigue valiendo:
 *   · **captura de puntero**: sin ella, salirse del control mientras se conduce
 *     deja la orden puesta y el `pointerup` no llega. La palanca la usa igual.
 *   · **`touch-none`**: sin esto, arrastrar en una tableta desplaza la pagina y
 *     el navegador se queda el gesto — robot con la ultima orden y sin soltar.
 *   · **la silueta importa**: la cruz aprendio que sobre papel blanco un mando
 *     sin campo detras se lee como una rejilla a la que le faltan piezas. La
 *     palanca lleva su hueco fresado por lo mismo.
 *   · y que el mando **se reconoce por su forma antes de leer nada**, que es por
 *     lo que la palanca es un circulo con un puño y no una caja con flechas.
 *
 * 🔴 Se borra en vez de dejarse «por si acaso»: un componente sin consumidor es
 *    la misma familia que una clase CSS huerfana, y este repositorio lleva cinco.
 */

function LoQueResponde() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/odom')
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 AÑADIDO EL 2026-08-08: EL ALUMNO PIDE 60 cm, OBTIENE 26, Y NO RECIBE
   *      NINGÚN MENSAJE.
   * ═══════════════════════════════════════════════════════════════════════════
   * Medido en el robot ejecutando la misma práctica dos veces seguidas, sin
   * tocar nada: **26,4 cm y 59,5 cm**. La causa no es un fallo — es la capa de
   * seguridad frenando al 40 % — pero **el journal lo registra y el alumno no ve
   * nada**, así que la conclusión natural es «el robot no obedece».
   *
   * El dato que lo explica es el ANCHO, y esta pantalla no lo decía: el polígono
   * `Precaucion` mide **60 cm de largo × 40 de ANCHO**, centrado en el robot. Con
   * un robot de 21,7 cm de ancho, **cualquier cosa a menos de ~9 cm de un COSTADO
   * lo frena** — una pata de silla, un zócalo, tu propio pie— y lo frena aunque
   * el robot se esté alejando de ella.
   *
   * → Se pinta EN VIVO y AQUÍ, pegado a «medido», que es donde aparece la
   *   discrepancia. Ponerlo en un pie de página sería no ponerlo.
   *
   * ⚠️ Y cuesta ~0: `/collision_monitor_state` publica **al cambiar**, no cada
   *    tanto (0 mensajes en 12 s con el robot quieto). La otra cara es que **con
   *    el robot quieto no llega nada**, así que «sin mensaje» no es «todo bien»:
   *    es «no se sabe», y por eso el aviso solo aparece cuando SÍ hay mensaje.
   */
  const monitor = useTopic(transporte, '/collision_monitor_state')
  const lineal = ultimo?.twist?.twist?.linear
  const angular = ultimo?.twist?.twist?.angular

  /*
   * 🔴 SOLO LO MEDIDO DESDE EL 2026-08-16. Aqui habia CUATRO celdas —pedido y
   *    medido, lineal y giro— mezcladas en la misma rejilla. Con el mando nuevo,
   *    lo que se PIDE lo pinta `LoQuePido` al lado de la palanca, que es donde
   *    se decide; esto es lo que el robot RESPONDE, que es otra pregunta y llega
   *    por otro camino (`/odom`, a 16,5 Hz).
   *
   * 📌 Y no es solo orden: mezclarlas hacia que el «pedido» —un numero que sale
   *    de esta misma pantalla— tuviera el mismo peso visual que una medida del
   *    robot. Uno es una intencion y el otro un hecho.
   */
  const celdas: readonly { etiqueta: string; valor: string; propio: boolean }[] = [
    { etiqueta: 'medido · lineal', valor: metrosPorSegundo(numeroValido(lineal?.x)), propio: false },
    {
      etiqueta: 'medido · giro',
      valor: radianesPorSegundo(numeroValido(angular?.z)),
      propio: false,
    },
  ]

  // `LIMITAR` y `APROXIMACION` también recortan; solo `NO_HACER_NADA` no.
  const frenando = monitor !== null && monitor.action_type !== ACCION_MONITOR.NO_HACER_NADA

  /*
   * 🔴🔴 2026-08-09 · `APROXIMACION` NO ERA «TE ESTÁ FRENANDO».
   *
   * Este aviso repartía los cinco códigos en dos cajas —PARAR y «todo lo demás
   * te frena»— y ponía la acción 3 en la segunda, con el texto de `Precaucion`
   * y su 40 %. Lo medido con 24 estaciones en las cuatro direcciones es que la
   * acción 3 puede ser **inmovilización total**: 0,0 cm avanzando, 0,0° girando
   * y 0,0 cm retrocediendo, incluso alejándose del obstáculo.
   *
   * → Aquí, además, se puede hacer lo que la lógica pura no puede: **comprobar
   *   el efecto**. Esta tarjeta ya tiene delante la velocidad medida, así que
   *   distingue «recortado» de «congelado» mirando si el robot se mueve, en vez
   *   de deducirlo del código.
   */
  const aproximacion = monitor?.action_type === ACCION_MONITOR.APROXIMACION
  const congelado = aproximacion
    && seMueve(numeroValido(lineal?.x), numeroValido(angular?.z)) === false

  return (
    <div className="grid min-w-[17rem] flex-1 grid-cols-2 gap-2.5">
      {frenando && (
        <div className="col-span-2" role="status">
          <Aviso
            nivel={monitor.action_type === ACCION_MONITOR.PARAR || aproximacion
              ? 'ERROR'
              : 'ATENCION'}
            titulo={
              monitor.action_type === ACCION_MONITOR.PARAR
                ? 'La capa de seguridad está BLOQUEANDO el movimiento'
                : aproximacion
                  ? (congelado
                    ? 'El robot está BLOQUEADO y no puede salir solo'
                    : 'Hay algo a menos de 15 cm: el robot puede quedar bloqueado')
                  : 'La capa de seguridad te está frenando ahora mismo'
            }
          >
            {monitor.action_type === ACCION_MONITOR.PARAR
              ? <>El robot no se moverá mientras esto dure. Motivo del robot:{' '}
                <code>{monitor.polygon_name}</code>. Si pone <code>invalid source</code> es que no
                le llega el barrido del LIDAR, no que haya un obstáculo.</>
              : aproximacion
                ? <>{congelado
                  ? <>Se le está mandando movimiento y la velocidad medida es <strong>cero</strong>.</>
                  : <>Está dentro del círculo de aproximación (<code>{monitor.polygon_name}</code>).</>}{' '}
                  Esto <strong>no</strong> es ir más despacio: el mando entero —giro incluido— se
                  multiplica por el tiempo hasta la colisión, y con algo ya dentro ese factor
                  es <strong>cero</strong>. Medido en las cuatro direcciones: avanzar alejándose{' '}
                  <strong>0,0 cm</strong>, girar <strong>0,0°</strong>, retroceder{' '}
                  <strong>0,0 cm</strong>. <strong>No insistas ni pruebes marcha atrás</strong>:
                  retira el obstáculo o aparta el robot con la mano.</>
                : <>Vas a recorrer <strong>menos de lo que pides</strong>, y no es que el robot no
                  obedezca. El polígono <code>{monitor.polygon_name}</code> mide 60 cm de largo por{' '}
                  <strong>40 de ancho</strong>: con un robot de 21,7 cm, cualquier cosa a menos de
                  ~9 cm de un <strong>costado</strong> lo frena al 40 %, aunque te estés alejando de
                  ella. Medido: la misma orden dio 26,4 cm con algo cerca y 59,5 despejado.</>}
          </Aviso>
        </div>
      )}
      {celdas.map((c) => (
        <div
          key={c.etiqueta}
          /*
            La celda de lo PEDIDO lleva el tono de la pantalla; la de lo MEDIDO
            se queda neutra. Es la diferencia que importa de un vistazo: lo de
            color es lo que tu has elegido, lo neutro es lo que contesta el robot.
          */
          className={`rounded-[14px] border px-4 py-3.5 ${
            c.propio
              ? 'border-[rgb(var(--seccion-conducir)/0.3)] bg-[rgb(var(--seccion-conducir)/0.06)]'
              : 'border-[rgb(var(--filo)/0.12)] bg-[rgb(var(--vidrio)/0.02)]'
          }`}
        >
          <div className="microetiqueta">{c.etiqueta}</div>
          {/*
            🔴 ESTOS CUATRO NUMEROS SON LO QUE SE MIRA AL CONDUCIR, y estaban a
               20 px: mas pequeños que el titulo de la cabecera y a 7 px de la
               prosa de al lado. En la maqueta son lo mas grande de la pantalla.

            ⚠️ Y el hueco no se pinta como el valor: sin dato iba en la misma
               monoespaciada y el mismo tamaño que «0,100 m/s», asi que no se
               distinguia una medida de su ausencia — justo en la pantalla donde
               esa diferencia decide si crees que el robot te obedece.
          */}
          {/*
            🔴 ALTURA FIJA, IGUAL CON DATO Y SIN EL. Las dos celdas de MEDIDO
               tenian la altura de una `.cifra` con una raya de 18 px anclada
               arriba, asi que quedaban ~60 px de blanco muerto debajo y el par
               PEDIDO/MEDIDO se leia como dos cajas rotas en vez de como una
               comparacion. `h-9 items-center` iguala las cuatro.
          */}
          <div className="mt-1.5 flex h-9 items-center">
            {c.valor === SIN_DATO ? (
              <span className="hueco text-lg leading-none" title={SIN_DATO}>—</span>
            ) : (
              <span className="cifra">
                {partirUnidad(c.valor).numero}
                {partirUnidad(c.valor).unidad !== null && (
                  <span className="unidad">{partirUnidad(c.valor).unidad}</span>
                )}
              </span>
            )}
          </div>
          {/*
            🔴 LA AUSENCIA CON SU PALABRA. La raya era el unico elemento de la
               pantalla sin una: el idioma de esta aplicacion es que el color -y
               aqui el hueco- nunca va solo. Y decir POR QUE no hay dato importa
               mas aqui que en ningun sitio, porque quien mira esta celda esta
               intentando averiguar si el robot le obedece.
          */}
          {c.valor === SIN_DATO && !c.propio && (
            <div className="microetiqueta mt-1 !tracking-[0.08em]">no llega /odom</div>
          )}
        </div>
      ))}
    </div>
  )
}

export function PanelConducir() {
  // 🔴 UNA sola instancia POR CONEXION, y la crea el proveedor — no esta
  //    pantalla. Desde que la parada vive en el marco, si esta pantalla siguiera
  //    llamando a `useTeleoperacion()` habria DOS instancias con dos bucles de
  //    10 Hz publicando en `/cmd_vel_raw` a la vez, que es exactamente lo que la
  //    regla 2 de la cabecera de este fichero prohíbe.
  const { conectado, teleoperacion } = useRobot()
  /*
   * 🔴 EL TECHO ARRANCA EN EL MINIMO MEDIDO. Era una de dos pildoras (0,10 y
   *    0,20); ahora es continuo entre las dos, y el valor de partida sigue
   *    siendo el mas lento — teleoperar empieza despacio, no a medio gas.
   */
  const [velocidad, setVelocidad] = useState<number>(V_MIN)
  /*
   * Lo que se esta pidiendo AHORA, venga de la palanca o del teclado. Vive aqui
   * y no dentro de la palanca porque lo pinta `LoQuePido`, que es su hermano:
   * dos estados serian dos verdades sobre la misma orden.
   */
  const [orden, setOrden] = useState<OrdenMando>({ v: 0, w: 0 })
  const [falloLocal, setFalloLocal] = useState<string | null>(null)

  /**
   * Si la pestaña se va a segundo plano, se manda parar.
   *
   * ⚠️ El robot pararia igual sin esto -los navegadores limitan `setInterval` a
   * ~1 Hz en segundo plano y el watchdog del driver corta a los 0,3 s-, pero eso
   * es dejar que el robot se pare por INANICION en vez de mandarlo parar. Con un
   * twist cero explicito, para en cuanto llegue el mensaje.
   *
   * 🔴 `parar()` publica, y `publicar()` LANZA si no hay enlace: se atrapa, se
   * apunta y NO se traga. Aunque nadie este mirando la pestaña en ese instante,
   * el aviso sigue ahi cuando vuelva -y el bucle ya se corto de todas formas,
   * porque `parar()` hace `detener()` antes de publicar.
   */
  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState !== 'hidden') return
      try {
        teleoperacion.parar()
      } catch (error) {
        setFalloLocal(error instanceof Error ? error.message : String(error))
      }
    }
    document.addEventListener('visibilitychange', alOcultarse)
    return () => document.removeEventListener('visibilitychange', alOcultarse)
  }, [teleoperacion])

  return (
    <div className="space-y-4">
      {/*
        🔴 LA PARADA YA NO SE REPITE AQUÍ: vive en la franja del marco, donde
        sale en las seis pestañas. Tenerla en las dos habría puesto DOS botones
        de parada en esta misma pantalla — y ante dos, quien tiene el robot
        moviéndose delante duda cuál pulsar. Esto es lo contrario de lo que la
        franja pretende.
      */}
      {teleoperacion.ultimoAviso !== null && (
        <Aviso nivel="ERROR" titulo="El bucle de mando se ha cortado">
          {teleoperacion.ultimoAviso.mensaje}
        </Aviso>
      )}
      {falloLocal !== null && (
        <Aviso nivel="ERROR" titulo="No se pudo enviar la orden de parar el movimiento">
          {falloLocal} — el bucle de mando ya está cortado, así que el robot deja de recibir órdenes
          y el vigilante del driver lo para en 0,3 s o menos.
        </Aviso>
      )}

      {/*
        🔴 DOS COLUMNAS A PARTIR DE `lg`, Y NO ES ESTETICA.
        En una sola columna cada panel medía 1104 px con el texto capado a
        `max-w-prose` (~600), así que la mitad derecha de la pantalla quedaba
        vacía y todo el contenido pegado a la izquierda. Medido en una captura
        a 1440 px de ancho.

        Los controles van a la izquierda —es lo que se toca— y las notas a la
        derecha. `items-start` impide que un panel se estire hasta la altura de
        su vecino dejando un hueco muerto abajo.
      */}
      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴🔴 EL BARRIDO VA EL PRIMERO, Y ERA EL CUARTO (2026-08-16)
        ═══════════════════════════════════════════════════════════════════════
        👤 Pedido por el usuario: «el barrido del LIDAR deberia reubicarse arriba
           para que sea mas visible».

        Y el argumento es mas fuerte que la visibilidad: **sin barrido el Mando
        no hace nada**. La capa de seguridad bloquea el movimiento cuando no le
        llega `/scan` —medido, 0,0 cm contra 9,9 del control—, asi que la tarjeta
        hero de esta pantalla era inutil hasta resolver una precondicion que
        vivia de CUARTA, en la segunda fila de la columna izquierda.

        📝 El comentario de abajo decia «lo demas —enlace, barrido,
           consecuencias— son PRECONDICIONES y notas. Van debajo». Media razon:
           el enlace y las consecuencias sí; el barrido no es una nota, es **la
           condicion de que el hero funcione**. Poner una precondicion despues de
           lo que condiciona es lo que hace que alguien pulse una flecha, no vea
           nada, y busque la averia en el robot.
      */}
      <Barrido teleoperacion={teleoperacion} />

      {/*
        🔴 EL MANDO ES EL HERO DE ESTA PANTALLA, Y ANTES ERA LO ULTIMO.
        Estaba metido como tercera tarjeta de la columna IZQUIERDA de una malla
        de dos, o sea en unos 240 px y al final del scroll — mientras la mitad
        derecha de la pantalla acababa vacia. En la maqueta
        (`conducir_laboratorio_atriz/screen.png`) el control direccional tiene su
        propio panel grande, y es lo unico razonable: esta pestaña se llama
        «Conducir» y lo que se viene a hacer aqui es conducir.

        Lo demas —enlace, barrido, consecuencias— son PRECONDICIONES y notas.
        Van debajo, en dos columnas.
      */}
      <Tarjeta
        titulo="Mando"
        /*
         * 🔴 SE DICE QUE HAY TECLADO, y no es un extra: una función que no se
         *    anuncia no existe. La cruz llevaba `focus-ring` desde siempre —o
         *    sea, prometía teclado con un anillo de foco— y no hacía nada al
         *    pulsar Enter. Ahora funciona y **se lee antes de tener que
         *    descubrirlo**.
         */
        /*
         * 📝 El texto describe el GESTO, y el gesto cambio el 2026-08-16: era
         *    «manteniendo pulsado» cuando el mando eran cuatro botones. Con una
         *    palanca se ARRASTRA. Una instruccion que describe un mando que ya
         *    no existe es de las que nadie relee.
         */
        subtitulo={
          'Arrastra la palanca, o mantén pulsadas las flechas / WASD. Al soltar se manda parar. '
          + 'Se publica en /cmd_vel_raw, que es la ENTRADA de la capa de seguridad.'
        }
      >
        {/*
          🔴 MALLA, NO `flex-wrap`. Eran tres bloques de alturas 264 / 150 / 160
             px en una fila que envuelve, asi que bajo la columna de velocidad y
             bajo la malla de datos quedaban ~110 y ~100 px de blanco en forma de
             L. Con `grid-cols-[auto_1fr]` la cruz ocupa lo que necesita y todo
             lo demas se apila a su derecha llenando la altura.
        */}
        {/*
          ═══════════════════════════════════════════════════════════════════════
          👤 EL MANDO, REDISEÑADO (2026-08-16) — «los mandos no me acaban de
             gustar, deberia haber algo como un joystick… la velocidad deberia
             poder regularse con un deslizador»
          ═══════════════════════════════════════════════════════════════════════
          Y la cruz de cuatro botones tenia un limite real, no solo estetico:
          **cuatro botones son cuatro ordenes excluyentes**. Para trazar un arco
          habia que pulsar «adelante», soltar, pulsar «izquierda» — conducir a
          saltos. La palanca da las dos componentes en un gesto.

          🔴 LA DISTRIBUCION TAMBIEN CAMBIA, y ese era el tercer punto del
             encargo. Antes: cruz a la izquierda y a su derecha una columna con
             velocidad, CUATRO celdas de pedido/medido y dos parrafos — o sea el
             mando compitiendo por el ancho con ocho cosas.
             Ahora: **la palanca manda en su fila** con lo que se le esta
             pidiendo justo al lado, y lo que el robot RESPONDE baja a su propia
             banda. Pedir y medir son dos preguntas distintas y estaban mezcladas
             en la misma rejilla.
        */}
        <div className="grid items-start gap-x-10 gap-y-6 px-5 py-5 lg:grid-cols-[auto_1fr]">
          <Palanca
            teleoperacion={teleoperacion}
            vMax={velocidad}
            alFallar={setFalloLocal}
            alCambiar={setOrden}
          />

          <div className="space-y-5">
            <DeslizadorVelocidad
              valor={velocidad}
              alCambiar={setVelocidad}
              desactivado={!conectado}
            />
            <LoQuePido orden={orden} />
          </div>
        </div>

        {/*
          🔴 LO QUE RESPONDE EL ROBOT VA EN SU PROPIA BANDA, debajo de la que
             decide. Pedir y medir son dos preguntas distintas y llegan por
             caminos distintos: lo primero sale de esta pantalla, lo segundo de
             `/odom` a 16,5 Hz. Tenerlas en la misma rejilla le daba a una
             intencion el peso visual de un hecho.
        */}
        <div className="border-t border-[rgb(var(--filo)/0.10)] px-5 py-4">
          <p className="microetiqueta mb-2.5">lo que responde el robot</p>
          <LoQueResponde />
        </div>

        {!conectado && (
          <p className="px-5 pb-4 text-sm text-muted-foreground">
            Sin enlace no se puede conducir, así que el mando está desactivado.
          </p>
        )}
      </Tarjeta>

      {/*
        Las PRECONDICIONES y las notas, en dos columnas. `items-start` impide
        que un panel se estire hasta la altura de su vecino dejando un hueco
        muerto abajo.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Tarjeta titulo="Enlace">
            <PanelEnlace />
          </Tarjeta>
        </div>

      <Tarjeta titulo="Lo que va a pasar y no es un fallo">
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2 max-w-prose">
          <li>
            <strong>Retroceder junto a una pared tarda más de lo esperado.</strong> El polígono de
            precaución es estático y mide 60 cm de largo por <strong>40 de ancho</strong>: mientras la pared esté dentro,
            la capa de seguridad frena al 40 % <em>aunque el robot se esté alejando</em>. Medido: un
            retroceso de 2 s a 0,15 m/s recorrió 14 cm en vez de 30. No es que no obedezca.
          </li>
          <li>
            <strong>Si esta pestaña pasa a segundo plano, el robot para.</strong> El navegador
            limita el temporizador a ~1 Hz y el vigilante del driver corta a los 0,3 s sin órdenes.
            Es el lado seguro, pero sorprende.
          </li>
          <li>
            <strong>Sin barrido del LIDAR el robot no se mueve.</strong> Medido: 0,0 cm contra 9,9
            del control. La capa de seguridad para el robot cuando <code>/scan</code> lleva 0,5 s sin
            llegar.
          </li>
          <li>
            <strong>Frenar deja algo de recorrido.</strong> La parada de la capa de seguridad son
            9,9 cm a 0,25 m/s y 10,6 cm a 0,40.
          </li>
        </ul>
      </Tarjeta>
      </div>
    </div>
  )
}
