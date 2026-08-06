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
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { ORDEN_ENVIADA, textoDeConfirmacion } from '@/lib/interfaz/lenguaje'
import { horaCorta, metrosPorSegundo, numero } from '@/lib/interfaz/formato'
import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { PanelEnlace } from './EstadoEnlace'

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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!conectado || estado.clase === 'ARRANCANDO'}
          onClick={() => void arrancar()}
          className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-ring hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
        >
          {estado.clase === 'ARRANCANDO' ? 'Esperando un /scan real…' : 'Arrancar barrido'}
        </button>
        <button
          type="button"
          disabled={!conectado}
          onClick={() => void parar()}
          className="border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground focus-ring hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
        >
          Parar barrido
        </button>
      </div>

      <div className="mt-3 space-y-2">
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
    { etiqueta: 'Adelante', v: 1, w: 0, columna: 'col-start-2 row-start-1' },
    { etiqueta: 'Izquierda', v: 0, w: 1, columna: 'col-start-1 row-start-2' },
    { etiqueta: 'Parar', v: 0, w: 0, columna: 'col-start-2 row-start-2' },
    { etiqueta: 'Derecha', v: 0, w: -1, columna: 'col-start-3 row-start-2' },
    { etiqueta: 'Atrás', v: -1, w: 0, columna: 'col-start-2 row-start-3' },
  ]

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-2 max-w-xs">
      {mandos.map((m) => (
        <button
          key={m.etiqueta}
          type="button"
          disabled={!conectado}
          onPointerDown={empezar(m)}
          onPointerUp={pararSeguro}
          onPointerCancel={pararSeguro}
          onLostPointerCapture={pararSeguro}
          className={`${m.columna} select-none touch-none rounded-md border border-border bg-secondary px-3 py-4 text-sm font-medium text-secondary-foreground focus-ring hover:bg-muted active:bg-primary active:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {m.etiqueta}
        </button>
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
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Tarjeta titulo="Enlace">
            <PanelEnlace />
          </Tarjeta>

          <Barrido teleoperacion={teleoperacion} />

      <Tarjeta
        titulo="Mando"
        subtitulo="Se conduce manteniendo pulsado. Al soltar, se manda parar. Se publica en /cmd_vel_raw, que es la ENTRADA de la capa de seguridad."
      >
        <div className="flex flex-wrap items-start gap-6">
          <CruzDeMando teleoperacion={teleoperacion} velocidad={velocidad} alFallar={setFalloLocal} />

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Velocidad</p>
              <div className="flex gap-2">
                {VELOCIDADES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVelocidad(v)}
                    className={`rounded-md border px-3 py-1.5 text-sm focus-ring ${
                      velocidad === v
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    {metrosPorSegundo(v)}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs">
              Giro fijo a {numero(GIRO, 1)} rad/s. Entre 0,5 y 2,0 rad/s el robot cumple el 99-102 %
              de lo que se le pide. El tope del robot son 0,40 m/s y esta pantalla no lo ofrece.
            </p>
          </div>
        </div>

        {!conectado && (
          <p className="text-sm text-muted-foreground mt-3">
            Sin enlace no se puede conducir, así que el mando está desactivado.
          </p>
        )}
      </Tarjeta>
        </div>

      <Tarjeta titulo="Lo que va a pasar y no es un fallo">
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2 max-w-prose">
          <li>
            <strong>Retroceder junto a una pared tarda más de lo esperado.</strong> El polígono de
            precaución es estático y se extiende 0,36 m hacia delante: mientras la pared esté dentro,
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
