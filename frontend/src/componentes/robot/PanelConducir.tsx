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
import type { PointerEvent as EventoPuntero } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { ACCION_MONITOR, useTopic } from '@/hooks/useTopic'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { ORDEN_ENVIADA, textoDeConfirmacion } from '@/lib/interfaz/lenguaje'
import {
  SIN_DATO, horaCorta, metrosPorSegundo, numero, partirUnidad, radianesPorSegundo,
} from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { PanelEnlace } from './EstadoEnlace'
import { useMuestreo } from './useMuestreo'

/**
 * Las dos velocidades que ofrece esta pantalla, en m/s. Las dos estan MEDIDAS:
 * pidiendo 0,20 la meseta real es 0,199 (100 %) y se alcanza en ~0,5 s de rampa.
 * El tope del robot es 0,40, que aqui no se ofrece: teleoperar a ciegas desde un
 * navegador no es el sitio para la velocidad maxima.
 */
const VELOCIDADES = [0.1, 0.2] as const

/** rad/s. Entre 0,5 y 2,0 el robot cumple el 99-102 % de lo comandado. */
const GIRO = 0.8

type EstadoBarrido =
  | { clase: 'SIN_PEDIR' }
  | { clase: 'ARRANCANDO' }
  | { clase: 'HAY_SCAN'; hora: string }
  | { clase: 'FALLO'; detalle: string; hora: string }
  | { clase: 'PARADO_PEDIDO'; hora: string }

function Barrido({ teleoperacion }: { teleoperacion: ControlTeleoperacion }) {
  const { transporte, conectado } = useRobot()
  const [estado, setEstado] = useState<EstadoBarrido>({ clase: 'SIN_PEDIR' })

  const arrancar = async () => {
    setEstado({ clase: 'ARRANCANDO' })
    try {
      // 🔴 Esto espera un `/scan` DE VERDAD, no el codigo de retorno de
      //    `/start_scan`. El servicio puede responder que si y no llegar ni un
      //    barrido -y el sintoma seria «el robot no obedece», buscado en el sitio
      //    equivocado.
      await teleoperacion.arrancarBarrido()
      setEstado({ clase: 'HAY_SCAN', hora: horaCorta(Date.now()) })
    } catch (error) {
      setEstado({
        clase: 'FALLO',
        detalle: error instanceof Error ? error.message : String(error),
        hora: horaCorta(Date.now()),
      })
    }
  }

  const parar = async () => {
    try {
      await transporte.llamar('/stop_scan')
      setEstado({ clase: 'PARADO_PEDIDO', hora: horaCorta(Date.now()) })
    } catch (error) {
      setEstado({
        clase: 'FALLO',
        detalle: error instanceof Error ? error.message : String(error),
        hora: horaCorta(Date.now()),
      })
    }
  }

  return (
    <Tarjeta
      titulo="Barrido del LIDAR"
      subtitulo="Sin /scan el robot NO se puede conducir: la capa de seguridad bloquea el movimiento."
    >
      {/* `px-5 pt-4`: el cuerpo de `Tarjeta` va a sangre para que las rejillas
          lleguen al canto, asi que lo que no es rejilla pone su relleno. */}
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        <button
          type="button"
          disabled={!conectado || estado.clase === 'ARRANCANDO'}
          onClick={() => void arrancar()}
          /* Mismo motivo que la pildora de velocidad: `--primary` vale el mismo
             RGB que `--bloque-vivo`, o sea vocabulario de ESTADO. Aqui manda el
             tono de la pantalla. */
          className="rounded-md bg-[rgb(var(--seccion-conducir))] px-4 py-2 text-sm font-medium text-white focus-ring hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
        >
          {estado.clase === 'ARRANCANDO' ? 'Esperando un /scan real…' : 'Arrancar barrido'}
        </button>
        <button
          type="button"
          disabled={!conectado}
          onClick={() => void parar()}
          /* 🔴 `rounded-md`, que le faltaba: este boton y el de al lado son
             hermanos y tenian radios DISTINTOS —14 px contra 0—, o sea una
             pildora pegada a una caja de esquina viva. Se ve a 2,4× en un
             recorte, y `PanelTerminal` ya deja escrito que la forma tambien es
             vocabulario. */
          className="rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground focus-ring hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
        >
          Parar barrido
        </button>
      </div>

      <div className="mt-3 space-y-2 px-5 pb-4">
        {estado.clase === 'SIN_PEDIR' && (
          <p className="text-sm text-muted-foreground max-w-prose">
            El barrido arranca <strong>apagado</strong> con el robot, a propósito: si no, el X2 giraría
            a 11,8 Hz las 24 horas en los 16 robots en vez de a 2,7. Que el robot no se mueva antes de
            pulsar aquí no es una avería.
          </p>
        )}
        {estado.clase === 'HAY_SCAN' && (
          <Aviso nivel="NOTA" titulo={`barrido confirmado por un /scan real · ${estado.hora}`}>
            Ha llegado un barrido de verdad, no solo una respuesta del servicio. Es lo único que
            prueba que el LIDAR está entregando datos.
          </Aviso>
        )}
        {estado.clase === 'PARADO_PEDIDO' && (
          <Aviso nivel="ATENCION" titulo={`${ORDEN_ENVIADA} · ${estado.hora}`}>
            {textoDeConfirmacion('/stop_scan')} El tambor no se detiene del todo: baja de 11,8 Hz a
            2,7, que es su reposo. Pararlo entero exigiría cortarle los 5 V.
          </Aviso>
        )}
        {estado.clase === 'FALLO' && (
          <Aviso nivel="ERROR" titulo={`no hay barrido · ${estado.hora}`}>{estado.detalle}</Aviso>
        )}
      </div>
    </Tarjeta>
  )
}

interface Mando {
  etiqueta: string
  v: number
  w: number
  columna: string
  /** Grados que se gira el chevron. 0 = adelante, y el resto en sentido horario. */
  giro: number
}

function CruzDeMando({
  teleoperacion, velocidad, alFallar,
}: {
  teleoperacion: ControlTeleoperacion
  velocidad: number
  alFallar: (mensaje: string) => void
}) {
  const { conectado } = useRobot()

  const pararSeguro = () => {
    try {
      teleoperacion.parar()
    } catch (error) {
      // `parar()` corta el bucle ANTES de publicar, asi que aunque el publish
      // falle el robot deja de recibir mando y el watchdog lo para en <=0,3 s.
      // Se cuenta igual: quien conduce tiene que saber que el enlace se cayo.
      alFallar(error instanceof Error ? error.message : String(error))
    }
  }

  const empezar = (m: Mando) => (e: EventoPuntero<HTMLButtonElement>) => {
    // Con captura de puntero, el `pointerup` llega a este mismo boton aunque el
    // dedo o el raton se salgan de el mientras se conduce.
    e.currentTarget.setPointerCapture(e.pointerId)
    teleoperacion.mover(m.v * velocidad, m.w * GIRO)
  }

  const mandos: readonly Mando[] = [
    { etiqueta: 'Adelante', v: 1, w: 0, columna: 'col-start-2 row-start-1', giro: 0 },
    { etiqueta: 'Izquierda', v: 0, w: 1, columna: 'col-start-1 row-start-2', giro: -90 },
    { etiqueta: 'Derecha', v: 0, w: -1, columna: 'col-start-3 row-start-2', giro: 90 },
    { etiqueta: 'Atrás', v: -1, w: 0, columna: 'col-start-2 row-start-3', giro: 180 },
  ]

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 LA CRUZ, CON LA FORMA DE LA MAQUETA Y NO CON LA QUE HABIA
   * ═══════════════════════════════════════════════════════════════════════════
   * Esto eran cinco pastillas grises con las palabras «Adelante / Izquierda /
   * Parar / Derecha / Atrás» en una malla de 3×3, y no se parecia en nada a
   * `conducir_laboratorio_atriz/screen.png`: alli es una CRUZ de celdas
   * cuadradas con chevrones, y **la parada en el centro**, marcada.
   *
   * La forma no es capricho: un mando direccional se reconoce por su silueta
   * antes de leer nada, y con la palabra dentro cada celda tenia un ancho
   * distinto — la cruz se deshacia.
   *
   * ⚠️ Y LAS PALABRAS NO SE PIERDEN. Cada celda lleva su `aria-label` y su
   *    `title`: el glifo es para el ojo, el nombre sigue estando para un lector
   *    de pantalla y para quien deja el puntero encima. Una flecha es una
   *    convencion universal; el centro, que es el que para, ademas lleva su
   *    palabra escrita debajo del punto.
   */
  const celda = 'flex aspect-square select-none touch-none items-center justify-center '
    + 'rounded-[14px] border border-[rgb(var(--filo)/0.14)] bg-[rgb(var(--vidrio)/0.025)] '
    + 'text-foreground focus-ring transition-[background-color,border-color,transform] '
    + 'duration-[var(--t-pulsacion)] ease-[cubic-bezier(0.23,1,0.32,1)] '
    // 🔴 0.6 y no 0.35: la silueta del mando es lo que ENSEÑA de que va esta
    //    pantalla, y con el robot apagado —el estado mas frecuente— se borraba.
    //    Que este desactivado ya lo dicen el cursor, el pie y la franja.
    + 'disabled:opacity-60 disabled:cursor-not-allowed'

  return (
    // 🔴 `shrink-0` Y ANCHO FIJO. Con `max-w-` dentro de un flex, el padre lo
    //    comprimia hasta ~34 px por celda: la cruz salia del tamaño de un icono
    //    y las celdas, al ser cuadradas con radio 14, se veian como circulos.
    //    Un mando direccional se reconoce por su silueta antes de leer nada.
    <div className="grid w-[16.5rem] shrink-0 grid-cols-3 grid-rows-3 gap-2.5">
      {mandos.map((m) => (
        <button
          key={m.etiqueta}
          type="button"
          disabled={!conectado}
          aria-label={m.etiqueta}
          title={m.etiqueta}
          onPointerDown={empezar(m)}
          onPointerUp={pararSeguro}
          onPointerCancel={pararSeguro}
          onLostPointerCapture={pararSeguro}
          /*
            Al pulsar, la celda se llena con el tono de ESTA pantalla. Es
            realimentacion de la interaccion —«te he oido»—, no un estado del
            robot: por eso usa el eje de identidad y no uno de los tres colores
            del vocabulario de estado, que significan otra cosa.
          */
          className={`${m.columna} ${celda} hover:border-[rgb(var(--seccion-conducir)/0.45)] hover:bg-[rgb(var(--seccion-conducir)/0.07)] active:scale-[0.96] active:border-[rgb(var(--seccion-conducir))] active:bg-[rgb(var(--seccion-conducir))] active:text-white`}
        >
          {/*
            🔴 EL CHEVRON LLENA SU VIEWBOX, Y ANTES OCUPABA 9/24 DE ALTO.
               Con `h-7` sobre una celda de 80 px el triangulo medía ~15×10 px:
               el objeto principal de la pantalla —lo unico que hace que esto se
               llame «Conducir»— era lo mas tenue que habia en ella. El path va
               ahora de y=3,5 a y=18 y el svg sube a `h-9`, asi que el chevron
               pasa de ~15 px a ~34, a la altura de las cifras de al lado.
          */}
          {/*
            🔴 LA RONDA ANTERIOR MIDIO LA CAJA Y NO LA TINTA. Se lleno el viewBox
               y se subio a `h-9`, pero sobre una celda de 81 px eso sigue siendo
               un triangulo de ~22×26: el 27 % de la celda, no el 34 que se creia
               haber conseguido. Es la misma forma de error que persigue este
               proyecto —comprobar el numero que se toco en vez del efecto— y la
               pillo un revisor midiendo pixeles sobre un recorte a 2,4×.
          */}
          <svg viewBox="0 0 24 24" className="h-11 w-11" aria-hidden="true"
            style={{ transform: `rotate(${m.giro}deg)` }}>
            <path d="M12 2 L22 20 H2 Z" fill="currentColor" />
          </svg>
        </button>
      ))}

      {/*
        EL CENTRO ES LA PARADA, como en la maqueta. No manda `v=0 w=0` por un
        camino distinto: llama al mismo `parar()` que el soltar de las flechas,
        que corta el bucle ANTES de publicar.
      */}
      <button
        type="button"
        disabled={!conectado}
        aria-label="Parar"
        title="Parar"
        onClick={pararSeguro}
        className={`col-start-2 row-start-2 ${celda} hover:border-[rgb(var(--destructive)/0.5)] active:scale-[0.96]`}
      >
        {/*
          🔴 LA TECLA MAS PESADA DE LA CRUZ, Y ERA LA MAS LIGERA. Un punto de
             14 px contra flechas de ~22, con la palabra a 9 px debajo: la tecla
             que se pulsa CON PRISA tenia la menor masa de las cinco. Ahora es un
             disco lleno de 34 px con la palabra dentro. En un mando, la tecla de
             parar tiene que encontrarse sin mirar.

          📝 `--destructive` y no `--estado-ir`: los `--estado-*` significan «esto
             es un HECHO sobre el robot», y este control esta en reposo. Desde que
             los dos tokens dejaron de valer lo mismo, la diferencia se ve.
        */}
        <span className="flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full bg-[rgb(var(--destructive))]">
          {/*
            ⚠️ 8 px y sin traqueo: a 9 px con `tracking-[0.06em]` la palabra medía
               32,5 px dentro de un disco de 33,6, así que **las esquinas de la P
               y de la última R caían fuera del círculo** y se pintaban sobre el
               papel. A 1× la tecla se leía como un borrón. Medido en un recorte
               a 8×; a tamaño normal no se ve, y por eso la hizo mal quien la
               escribió —yo— y la encontró quien la miró con lupa.
          */}
          <span className="text-[8px] font-semibold uppercase text-white">parar</span>
        </span>
      </button>
    </div>
  )
}

/**
 * PEDIDO CONTRA MEDIDO — la pareja de la maqueta, y la pregunta real al conducir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE «PEDIDO» Y NO «MANDADO», QUE ES LO QUE DICE LA MAQUETA
 * ═══════════════════════════════════════════════════════════════════════════
 * La maqueta rotula `MANDADO (V)`, y esa palabra afirma algo que esta pantalla
 * **no sabe**: que la orden salio y llego. Lo unico cierto es la velocidad que
 * hay SELECCIONADA aqui, que es lo que se mandaria al pulsar. Un robot con el
 * enlace caido tendria un «mandado» de 0,20 m/s y un medido de 0,00, y el par se
 * leeria como «no obedece» cuando la causa es que no salio nada.
 *
 * ⚠️ Y el MEDIDO sale de `/odom`, que **ya se paga en esta pantalla**:
 *    `PanelEnlace` se suscribe por `useSalud` para tener un latido a 16,5 Hz.
 *    Esto no añade caudal — si lo añadiera, no se pondria: `/odom` son 13 kB/s.
 *
 * 📝 `useMuestreo` y no `useTopic`: a 16,5 Hz un numero re-renderizado en cada
 *    mensaje parpadea y no se puede leer. Es la misma decision que telemetria.
 */
function PedidoContraMedido({ velocidad }: { velocidad: number }) {
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

  const celdas: readonly { etiqueta: string; valor: string; propio: boolean }[] = [
    { etiqueta: 'pedido · lineal', valor: metrosPorSegundo(velocidad), propio: true },
    { etiqueta: 'medido · lineal', valor: metrosPorSegundo(numeroValido(lineal?.x)), propio: false },
    { etiqueta: 'pedido · giro', valor: `${numero(GIRO, 1)} rad/s`, propio: true },
    {
      etiqueta: 'medido · giro',
      valor: radianesPorSegundo(numeroValido(angular?.z)),
      propio: false,
    },
  ]

  // `LIMITAR` y `APROXIMACION` también recortan; solo `NO_HACER_NADA` no.
  const frenando = monitor !== null && monitor.action_type !== ACCION_MONITOR.NO_HACER_NADA

  return (
    <div className="grid min-w-[17rem] flex-1 grid-cols-2 gap-2.5">
      {frenando && (
        <div className="col-span-2" role="status">
          <Aviso
            nivel={monitor.action_type === ACCION_MONITOR.PARAR ? 'ERROR' : 'ATENCION'}
            titulo={monitor.action_type === ACCION_MONITOR.PARAR
              ? 'La capa de seguridad está BLOQUEANDO el movimiento'
              : 'La capa de seguridad te está frenando ahora mismo'}
          >
            {monitor.action_type === ACCION_MONITOR.PARAR
              ? <>El robot no se moverá mientras esto dure. Motivo del robot:{' '}
                <code>{monitor.polygon_name}</code>. Si pone <code>invalid source</code> es que no
                le llega el barrido del LIDAR, no que haya un obstáculo.</>
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
  const [velocidad, setVelocidad] = useState<number>(VELOCIDADES[0])
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
        subtitulo="Se conduce manteniendo pulsado. Al soltar, se manda parar. Se publica en /cmd_vel_raw, que es la ENTRADA de la capa de seguridad."
      >
        {/*
          🔴 MALLA, NO `flex-wrap`. Eran tres bloques de alturas 264 / 150 / 160
             px en una fila que envuelve, asi que bajo la columna de velocidad y
             bajo la malla de datos quedaban ~110 y ~100 px de blanco en forma de
             L. Con `grid-cols-[auto_1fr]` la cruz ocupa lo que necesita y todo
             lo demas se apila a su derecha llenando la altura.
        */}
        <div className="grid items-start gap-x-10 gap-y-6 px-5 py-5 lg:grid-cols-[auto_1fr]">
          {/*
            La cruz sobre un campo tenue: `craft-floor` pide que una silueta se
            recorte contra algo. Sobre papel blanco las cuatro esquinas vacias de
            la malla de 3×3 hacian que el bloque se leyera como una rejilla a la
            que le faltan piezas, no como una cruz.
          */}
          <div className="rounded-[18px] bg-[rgb(var(--vidrio)/0.025)] p-3">
            <CruzDeMando teleoperacion={teleoperacion} velocidad={velocidad} alFallar={setFalloLocal} />
          </div>

          {/* Velocidad y lecturas en UNA columna: son los dos hijos de la
              segunda celda de la malla, no dos celdas mas. */}
          <div className="space-y-5">
            <div>
              <p className="microetiqueta mb-1.5">Velocidad</p>
              <div className="flex gap-2">
                {VELOCIDADES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVelocidad(v)}
                    /*
                      🔴 EL TONO DE LA SECCION, NO `--primary`. `--primary` vale
                         `30 58 210`, que es **exactamente el mismo RGB que
                         `--bloque-vivo`**: la pildora seleccionada era un bloque
                         saturado del vocabulario de ESTADO usado como adorno de
                         un selector, y el segundo bloque saturado de una pantalla
                         cuyo unico color reservado deberia ser el rojo de la
                         parada. El seleccionado va en teal, igual que ya hacen
                         las celdas de PEDIDO y el `active:` del mando.
                    */
                    className={`rounded-md border px-3.5 py-2 text-sm focus-ring ${
                      velocidad === v
                        ? 'border-[rgb(var(--seccion-conducir))] bg-[rgb(var(--seccion-conducir))] text-white'
                        : 'border-border bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    {metrosPorSegundo(v)}
                  </button>
                ))}
              </div>
            </div>
            <PedidoContraMedido velocidad={velocidad} />

            <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              Giro fijo a {numero(GIRO, 1)} rad/s. Entre 0,5 y 2,0 rad/s el robot cumple el 99-102 %
              de lo que se le pide. El tope del robot son 0,40 m/s y esta pantalla no lo ofrece.
            </p>
          </div>
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

          <Barrido teleoperacion={teleoperacion} />
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
