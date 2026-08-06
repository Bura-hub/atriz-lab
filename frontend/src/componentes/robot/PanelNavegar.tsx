'use client'

/**
 * NAVEGAR: el mapa, dónde cree AMCL que está el robot, y mandarle un objetivo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTA PANTALLA NACE SABIENDO QUE HOY NO PUEDE FUNCIONAR, Y LO DICE
 * ═══════════════════════════════════════════════════════════════════════════
 * `atriz-nav.service` está instalado y **NO habilitado** a propósito: Nav2 cuesta
 * ~58 % de un núcleo, la Pi se alimenta del USB del RVR, y la autonomía (~2 h) ya
 * no cubre una clase. Sin ese servicio no hay `/map`, ni `/amcl_pose`, ni
 * servidor de acción — medido hoy: un objetivo a `/navigate_to_pose` contesta
 * «No action server available».
 *
 * Y falta lo otro: **no existe un mapa del aula**. Sin él AMCL no tiene contra
 * qué localizar.
 *
 * → Así que lo primero de esta pantalla es un diagnóstico, no un dibujo. Un
 *   canvas vacío se lee como «la interfaz está rota»; una frase que dice qué
 *   falta se lee como lo que es.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 RETRACTADO EL 2026-08-06: LA «TRAMPA DE LA DURABILIDAD» NO EXISTE AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 * Este bloque decía que `/map` podía no llegar nunca: va `TRANSIENT_LOCAL`,
 * rosbridge se suscribe VOLATILE si no se le manda `qos`, y un VOLATILE empareja
 * con un TRANSIENT_LOCAL pero —en teoría— **no recibe lo ya publicado**. La
 * pantalla llevaba una rama entera dedicada a diagnosticar esa firma.
 *
 * Se midió en cuanto hubo un mapa de verdad, y **es falso**. Cinco suscripciones
 * NUEVAS a `/map`, contra un `slam_toolbox` que republica cada 5 s:
 *
 *     41 ms · 38 ms · 44 ms · 44 ms · 48 ms
 *
 * Si el latch no se entregara, una suscripción en un instante cualquiera tendría
 * que esperar del orden de 2,5 s de media. Cinco de cinco a ~40 ms **no es
 * casualidad: rosbridge SÍ entrega el valor latcheado.**
 *
 * → Así que la rama sigue existiendo —AMCL puede hablar con el mapa mudo por
 *   otras razones— pero **ya no acusa a la durabilidad**: la descarta con la
 *   medida, que es lo contrario de lo que hacía. Una pantalla que envía a
 *   investigar una causa ya refutada es peor que una que no dice nada.
 *
 * ⚠️ Lo medido es contra `slam_toolbox`. Con AMCL el publicador es `map_server`,
 *    que emite **una sola vez**; el mecanismo de QoS es el mismo en los dos
 *    lados, así que lo esperable es que también llegue — pero eso **no está
 *    medido**, y la pantalla lo dice con esas palabras en vez de dar por hecho
 *    que se generaliza.
 */

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useSesion } from '@/hooks/ContextoSesion'
import { SIN_DATO, aGrados, grados, horaCorta, metros, numero, yawDeCuaternion } from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import {
  cuaternionDeYaw, mundoAPixel, pixelAMundo, pixelesDeMapa, recuentoDeCeldas,
} from '@/lib/robot/mapa'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Dato } from '@/componentes/ui/Dato'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const ACCION = '/navigate_to_pose'
const TIPO_ACCION = 'nav2_msgs/action/NavigateToPose'

/** Los tres colores del mapa. Salen del vocabulario, no de literales sueltos. */
const COLORES = {
  LIBRE: [246, 245, 243] as [number, number, number],
  OCUPADA: [30, 30, 36] as [number, number, number],
  // 🔴 Un gris CLARAMENTE distinto del libre: si se parecen, lo no explorado se
  //    lee como explorado y sobre eso se planifican rutas.
  DESCONOCIDA: [176, 178, 186] as [number, number, number],
}

interface Objetivo { id: string; x: number; y: number; hora: string }

export function PanelNavegar() {
  const { transporte, conectado } = useRobot()
  const { usuario } = useSesion()
  const mapa = useTopic(transporte, '/map')
  const pose = useTopic(transporte, '/amcl_pose')
  const lienzo = useRef<HTMLCanvasElement | null>(null)

  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [avance, setAvance] = useState<number | null>(null)
  const [desenlace, setDesenlace] = useState<{ hora: string; texto: string; malo: boolean } | null>(null)

  const tono = { '--tono-seccion': 'var(--seccion-navegar)' } as CSSProperties

  /* ── Dibujar ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const c = lienzo.current
    if (c === null || mapa === null) return
    const px = pixelesDeMapa(mapa.info, mapa.data, COLORES)
    // `null` = el mensaje no cuadra consigo mismo. No se dibuja nada: un mapa
    // plausible y equivocado es peor que un hueco.
    if (px === null) return
    c.width = mapa.info.width
    c.height = mapa.info.height
    const ctx = c.getContext('2d')
    if (ctx === null) return
    ctx.putImageData(new ImageData(px, mapa.info.width, mapa.info.height), 0, 0)

    // El robot, encima. Solo si AMCL ha dicho dónde está.
    const p = pose?.pose?.pose
    const x = numeroValido(p?.position?.x)
    const y = numeroValido(p?.position?.y)
    const yaw = yawDeCuaternion(p?.orientation)
    if (x === null || y === null) return
    const { px: cx, py: cy } = mundoAPixel(mapa.info, x, y)
    const radio = Math.max(2, 0.145 / mapa.info.resolution)   // el radio real del robot
    ctx.beginPath()
    ctx.arc(cx, cy, radio, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(190,42,22,0.85)'
    ctx.fill()
    if (yaw !== null) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      // −sin porque el eje Y del canvas apunta al revés que el del mundo.
      ctx.lineTo(cx + Math.cos(yaw) * radio * 2.4, cy - Math.sin(yaw) * radio * 2.4)
      ctx.strokeStyle = 'rgba(190,42,22,0.85)'
      ctx.lineWidth = Math.max(1, radio / 3)
      ctx.stroke()
    }
  }, [mapa, pose])

  /* ── Mandar un objetivo ──────────────────────────────────────────────── */
  const alPulsarMapa = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // `puedeNavegar` primero: sin servidor de accion el objetivo solo produciria
    // un error, y el gesto ya esta desaconsejado en pantalla.
    if (mapa === null || pose === null || usuario === null || objetivo !== null) return
    const c = lienzo.current
    if (c === null) return
    const caja = c.getBoundingClientRect()
    // Del píxel de PANTALLA al píxel del canvas: el canvas se escala con CSS.
    const px = ((e.clientX - caja.left) / caja.width) * c.width
    const py = ((e.clientY - caja.top) / caja.height) * c.height
    const { x, y } = pixelAMundo(mapa.info, px, py)
    const hora = horaCorta(Date.now())

    const { id, resultado } = transporte.enviarObjetivo(ACCION, TIPO_ACCION, {
      pose: {
        header: { frame_id: 'map' },
        pose: { position: { x, y, z: 0 }, orientation: cuaternionDeYaw(0) },
      },
    }, {
      alAvance: (v) => {
        const d = numeroValido((v as { feedback?: { distance_remaining?: number } })?.feedback?.distance_remaining)
        if (d !== null) setAvance(d)
      },
    })
    setObjetivo({ id, x, y, hora })
    setAvance(null)
    setDesenlace(null)
    resultado.then(
      () => setDesenlace({ hora: horaCorta(Date.now()), texto: 'Nav2 dio el objetivo por terminado. Mira el robot: esto dice que la acción acabó, no dónde acabó.', malo: false }),
      (err: Error) => setDesenlace({ hora: horaCorta(Date.now()), texto: err.message, malo: true }),
    ).finally(() => { setObjetivo(null); setAvance(null) })
  }, [mapa, pose, usuario, objetivo, transporte])

  /* ── Los tres estados ────────────────────────────────────────────────── */
  const hayMapa = mapa !== null
  const hayPose = pose !== null
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴 HAY MAPA **SIN** PODER NAVEGAR, y es el estado en el que se probó esto.
   * ═══════════════════════════════════════════════════════════════════════════
   * `slam.launch.py` levanta `slam_toolbox` y ya hay `/map` — pero Nav2 sigue
   * parado, así que **no existe el servidor de `/navigate_to_pose`**: un
   * objetivo contesta «No action server available», medido.
   *
   * Sin esta distinción la pantalla decía «pulsa en el mapa para mandar al
   * robot» sobre un robot que no puede recibir el objetivo. Invitar a un gesto
   * que va a fallar es peor que no ofrecerlo: quien lo pulsa busca el fallo en
   * su clic.
   *
   * ⚠️ Se deduce de `/amcl_pose`, no se pregunta: AMCL y el servidor de acción
   *    vienen del MISMO launch, así que sin AMCL no hay a quién mandar nada. No
   *    es una comprobación directa, y por eso la pantalla dice «parece» y manda
   *    a mirar el robot en vez de afirmarlo.
   */
  const puedeNavegar = hayPose
  const recuento = hayMapa ? recuentoDeCeldas(mapa.data) : null
  const total = recuento === null ? 0 : recuento.LIBRE + recuento.OCUPADA + recuento.DESCONOCIDA

  return (
    <div className="space-y-8" style={tono}>
      <Grupo titulo="El mapa" fuente="/map y /amcl_pose · los dos vienen de Nav2, que hoy no arranca solo">
        {!hayMapa && !hayPose ? (
          <Tarjeta titulo="Nav2 no está corriendo" subtitulo="Y no es una avería: está así a propósito.">
            <Aviso nivel="NOTA" titulo="Qué falta para que esta pantalla haga algo">
              No llega ni <code>/map</code> ni <code>/amcl_pose</code>. El servicio de navegación
              está <strong>instalado y sin habilitar</strong> en los robots: Nav2 cuesta ~58 % de un
              núcleo y la Pi se alimenta de la batería del RVR, cuya autonomía (~2 h) ya no cubre
              una clase. Se arranca en el robot con <code>systemctl start atriz-nav</code>.
            </Aviso>
            <div className="mt-3">
              <Aviso nivel="ATENCION" titulo="Y aunque se arranque, falta el mapa del aula">
                AMCL localiza <strong>contra un mapa que no existe todavía</strong>. Hay que
                recorrer el aula con SLAM y guardarlo primero. Sin eso no hay nada que dibujar aquí
                ni sitio al que mandar el robot.
              </Aviso>
            </div>
          </Tarjeta>
        ) : hayPose && !hayMapa ? (
          <Tarjeta titulo="AMCL habla, pero el mapa no llega" subtitulo="Y hay una causa que ya se puede descartar.">
            {/*
              🔴 ESTE AVISO DECIA «sospecha de la durabilidad», y se MIDIO que no
                 era eso. Descartar una causa con datos vale tanto como señalar
                 la buena: lo que sobra es mandar a investigar lo ya refutado.
            */}
            <Aviso nivel="NOTA" titulo="No es la durabilidad de la suscripción: está medida">
              Se comprobó con cinco suscripciones nuevas a <code>/map</code> contra un mapa vivo, y
              el primer mensaje llegó en <strong>38-48 ms</strong> las cinco veces. Si el valor
              latcheado no se entregara habría que esperar segundos. Así que{' '}
              <strong>rosbridge sí recibe mapas ya publicados</strong>, y esa vía queda descartada.
            </Aviso>
            <div className="mt-3">
              <Aviso nivel="ATENCION" titulo="Dónde mirar entonces">
                Que <code>map_server</code> esté vivo y con un fichero de mapa que exista, y que el
                mapa se esté publicando de verdad. <strong>Nada de esto se ve desde aquí</strong>:
                hay que mirarlo en el robot.
                <br /><br />
                ⚠️ Y una diferencia sin medir: lo de arriba se comprobó contra{' '}
                <code>slam_toolbox</code>, que republica cada 5 s. Con AMCL el mapa lo emite{' '}
                <code>map_server</code> <strong>una sola vez</strong>. El mecanismo es el mismo, así
                que lo esperable es que también llegue — pero esperable no es medido.
              </Aviso>
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta
            titulo="Mapa"
            subtitulo={!puedeNavegar
              ? 'El mapa se está construyendo. Todavía no hay a quién mandar un objetivo.'
              : usuario === null
                ? 'Pulsa en el mapa para mandar al robot… con sesión iniciada.'
                : 'Pulsa en el mapa para mandar al robot a ese punto.'}
          >
            {!puedeNavegar && (
              <div className="mb-3">
                <Aviso nivel="NOTA" titulo="Esto parece SLAM, no Nav2: hay mapa pero no navegación">
                  Llega <code>/map</code> pero no <code>/amcl_pose</code>, y los dos salen del
                  mismo arranque de Nav2. Así que el mapa se está dibujando —eso funciona— pero{' '}
                  <strong>no hay servidor al que mandarle un objetivo</strong>: pulsar aquí
                  contestaría «no hay servidor de acción». Es lo que pasa con{' '}
                  <code>slam.launch.py</code> a solas, que es justo lo que hace falta para{' '}
                  <strong>crear</strong> el mapa.
                  <br /><br />
                  Para navegar hace falta el mapa guardado y AMCL. Y esto se deduce de que no
                  llegue <code>/amcl_pose</code>, no se pregunta: si crees que Nav2 sí está
                  levantado, míralo en el robot.
                </Aviso>
              </div>
            )}
            <div className="rejilla mb-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* `cm` y no `cm/celda`: `Dato` parte el valor por su primer numero
                  y pinta el resto como UNIDAD, asi que «cm/celda» salia a 22 px y
                  partido en dos renglones. Lo que sobra va a la nota. */}
              <Dato
                etiqueta="Resolución"
                valor={hayMapa ? `${numero(mapa.info.resolution * 100, 1)} cm` : SIN_DATO}
                nota="por celda"
              />
              <Dato etiqueta="Tamaño" valor={hayMapa ? `${mapa.info.width} × ${mapa.info.height}` : SIN_DATO} />
              {/*
                🔴 EL PORCENTAJE DE DESCONOCIDO, y no es una curiosidad: es lo que
                   evita la conclusión falsa más común con SLAM. Un robot que no se
                   ha movido produce un mapa 92,9 % desconocido y está SANO.
              */}
              <Dato
                etiqueta="Sin explorar"
                valor={recuento === null || total === 0 ? SIN_DATO : `${numero((recuento.DESCONOCIDA / total) * 100, 1)} %`}
                nota="Un mapa nuevo es casi todo esto, y no es un fallo."
              />
              <Dato
                etiqueta="Pose de AMCL"
                valor={hayPose
                  ? `${metros(numeroValido(pose.pose?.pose?.position?.x))} · ${grados(aGrados(yawDeCuaternion(pose.pose?.pose?.orientation) ?? 0))}`
                  : SIN_DATO}
                nota={hayPose ? undefined : 'No llega con el robot quieto: AMCL solo actualiza tras moverse 0,15 m.'}
              />
            </div>

            <canvas
              ref={lienzo}
              onClick={alPulsarMapa}
              /*
                🔴🔴 EL TAMAÑO DEL MAPA, EN DOS INTENTOS FALLIDOS Y UNO BUENO.
                     Las tres versiones se vieron en captura; ninguna la vio tsc.

                1. `w-full` a secas: un mapa de 69×82 celdas se estiraba a
                   ~1050 px de ancho y **1250 de alto**. Ocupaba la pantalla
                   entera y había que hacer scroll para ver un cuarto de
                   3,45 × 4,10 m.
                2. `max-h-[62vh] w-auto`: el tope de altura **nunca entraba**,
                   porque `w-auto` toma el ancho INTRÍNSECO del canvas —69 px—.
                   El mapa salió como una miniatura de 70×85. Cambiar un defecto
                   por su opuesto.
                3. Esta: el tope de ALTURA se traduce a un tope de ANCHO con la
                   proporción real del mapa, así que crece todo lo que puede sin
                   pasarse de alto y **sin deformarse**. Un mapa cuadrado y uno
                   apaisado se comportan los dos bien.

                `image-rendering: pixelated`: una celda son 5 cm, y suavizarlas
                inventaría paredes intermedias que el robot no ve.
              */
              style={hayMapa && mapa.info.height > 0
                ? { width: `min(100%, calc(62vh * ${mapa.info.width / mapa.info.height}))` }
                : undefined}
              className={`mx-auto block h-auto rounded-md border border-[rgb(var(--filo)/0.16)] [image-rendering:pixelated] ${
                puedeNavegar && usuario !== null && objetivo === null ? 'cursor-crosshair' : 'cursor-not-allowed'
              }`}
            />

            {usuario === null && (
              <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                Mandar al robot a un punto <strong>exige iniciar sesión</strong>, igual que liberar
                una parada: es una orden que mueve un robot en una sala con gente.
              </p>
            )}

            {objetivo !== null && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-sm">
                  Navegando a <strong>{numero(objetivo.x, 2)}, {numero(objetivo.y, 2)}</strong>{' '}
                  · desde las {objetivo.hora}
                  {avance !== null && <> · quedan <strong>{metros(avance)}</strong></>}
                </span>
                <button
                  type="button"
                  onClick={() => transporte.cancelarObjetivo(ACCION, objetivo.id)}
                  className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-3 py-1.5 text-sm font-semibold"
                >
                  Cancelar
                </button>
              </div>
            )}

            {desenlace !== null && (
              <div className="mt-3" role="alert">
                <Aviso nivel={desenlace.malo ? 'ERROR' : 'NOTA'} titulo={`${desenlace.malo ? 'El objetivo falló' : 'Objetivo terminado'} · ${desenlace.hora}`}>
                  {desenlace.texto}
                </Aviso>
              </div>
            )}

            <Contexto>
            <p>
              El punto que se pulsa va con <strong>rumbo cero</strong>: esta pantalla dice a dónde
              ir, no mirando a dónde llegar. Nav2 da por bueno el objetivo dentro de su tolerancia
              de rumbo, y se ha medido que el robot llega girado <strong>10-14°</strong> respecto a
              lo pedido. Si el rumbo final importa para lo que estés midiendo, corrígelo a mano.
            </p>
            <p>
              Y que la acción termine <strong>no dice dónde terminó</strong>. El error de posición
              medido al llegar es de 8-10 cm, que es la tolerancia configurada. Para saber si el
              robot está donde querías, míralo.
            </p>
            </Contexto>
          </Tarjeta>
        )}
      </Grupo>

      {!conectado && (
        <Aviso nivel="ERROR" titulo="Sin enlace con el robot">
          No hay WebSocket, así que no se sabe nada de la navegación.
        </Aviso>
      )}
    </div>
  )
}
