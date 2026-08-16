'use client'

/**
 * NAVEGAR: el mapa, dónde cree AMCL que está el robot, y mandarle un objetivo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTA PANTALLA NACIÓ SABIENDO QUE NO PODÍA FUNCIONAR — Y YA FUNCIONA
 * ═══════════════════════════════════════════════════════════════════════════
 * Decía: «`atriz-nav.service` está instalado y NO habilitado […] sin ese servicio
 * no hay `/map`, ni `/amcl_pose`, ni servidor de acción», y que **no existe un
 * mapa**. Las dos cosas eran ciertas cuando se escribió y **dejaron de serlo el
 * 2026-08-07**: el supervisor del robot levanta Nav2 a petición, se mapeó un
 * cuarto y **Nav2 navegó de verdad**.
 *
 * ✅ Lo que sigue en pie, y por eso la unidad no está habilitada: Nav2 son ~58 %
 *    de un núcleo, la Pi se alimenta del USB del RVR y la autonomía (~2 h) ya no
 *    cubre una clase. **No arranca sola**; se pide desde el panel de arriba.
 *
 * ⏳ Y lo que falta de verdad es **el mapa del AULA** —lo mapeado es un cuarto—,
 *    que es tarea física del laboratorio.
 *
 * 🔴 **Pero nada de esto se afirma ya de forma estática.** El robot publica
 *    `hay_mapa` y los seis estados de `/estado_navegacion`: la pantalla PREGUNTA
 *    en vez de recordar. Es la lección que costó este párrafo — este cliente
 *    dedujo el estado del robot de cuándo se había subido el código, y **el
 *    repositorio dice qué existe; solo el robot dice qué está corriendo**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 ESTE FICHERO HACÍA 715 LÍNEAS, Y AHORA ORQUESTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se fue, y por qué cada corte cae donde cae:
 *
 *   `navegar/LienzoMapa`       el dibujo y la conversión píxel → mundo
 *   `navegar/FijarPose`        el modo «dónde está el robot», con su trampa
 *   `navegar/DiagnosticoMapa`  los tres estados en los que no hay nada que pintar
 *   `navegar/ResultadoObjetivo`  el desenlace, que era un párrafo de 400 caracteres
 *   `lib/robot/resultado_objetivo`  su lógica, probada en Node
 *
 * 📌 El criterio no es el número de líneas: es que **quien venga a tocar el
 *    dibujo no tenga que leer nada de Nav2, y al revés.** Antes había que leer
 *    las 715 para cambiar el color de una celda.
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
 */

import { CSSProperties, useCallback, useRef, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useSesion } from '@/hooks/ContextoSesion'
import { SIN_DATO, aGrados, grados, horaCorta, metros, numero, yawDeCuaternion } from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { cuaternionDeYaw, fronteraAbierta, recuentoDeCeldas } from '@/lib/robot/mapa'
import { QueDijoLaAccion, recorridoEntre } from '@/lib/robot/resultado_objetivo'
import { Aviso } from '@/componentes/ui/Aviso'
import { ControlNavegacion } from '@/componentes/robot/ControlNavegacion'
import { Contexto } from '@/componentes/ui/Contexto'
import { Dato } from '@/componentes/ui/Dato'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { MapaQueNoLlega, Nav2Parado, PareceSlamNoNav2 } from './navegar/DiagnosticoMapa'
import { ControlFijarPose, useFijarPose } from './navegar/FijarPose'
import { LienzoMapa, PuntoDelMapa } from './navegar/LienzoMapa'
import { ResultadoObjetivo } from './navegar/ResultadoObjetivo'
import { useMuestreo } from './useMuestreo'

const ACCION = '/navigate_to_pose'
const TIPO_ACCION = 'nav2_msgs/action/NavigateToPose'

interface Objetivo { id: string; x: number; y: number; hora: string }
interface Desenlace { hora: string; accion: QueDijoLaAccion; recorrido: number | null; motivo: string | null }

export function PanelNavegar() {
  const { transporte, conectado } = useRobot()
  const { usuario } = useSesion()
  const mapa = useTopic(transporte, '/map')
  const pose = useTopic(transporte, '/amcl_pose')
  /*
   * 🔴 `/odom` AQUI, Y LO PIDIO EL ROBOT CON ESTAS PALABRAS: «lo que sí se puede
   *    mostrar es el desplazamiento por `/odom`, que es la fuente que acierta a
   *    0,3-4,2 cm».
   *
   * El desenlace de la acción **miente en las dos direcciones** —`SUCCEEDED` a
   * 41 cm del objetivo, y `ABORTED` sobre un robot que llegó—, así que sin esto
   * la pantalla solo puede decir «míralo». Con esto da un número.
   *
   * 📌 Cuesta ~13 kB/s mientras la pestaña esté abierta. Se paga porque la
   *    alternativa es una pantalla que no puede decir nada cierto del resultado.
   */
  const { ultimo: odom } = useMuestreo(transporte, '/odom')

  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  /** Dónde estaba el robot según `/odom` al mandar el objetivo. */
  const partida = useRef<{ x: number; y: number } | null>(null)
  const [avance, setAvance] = useState<number | null>(null)
  const [desenlace, setDesenlace] = useState<Desenlace | null>(null)

  const tono = { '--tono-seccion': 'var(--seccion-navegar)' } as CSSProperties

  /*
   * El último `/odom` en una ref: se lee en el momento de pulsar y en el del
   * desenlace, no en cada render. Un estado aquí re-renderizaría el canvas del
   * mapa a 16,5 Hz.
   */
  const ultimoOdom = useRef<{ x: number; y: number } | null>(null)
  const op = odom?.pose?.pose?.position
  const opx = numeroValido(op?.x)
  const opy = numeroValido(op?.y)
  if (opx !== null && opy !== null) ultimoOdom.current = { x: opx, y: opy }

  const fijar = useFijarPose(transporte)

  /* ── Mandar un objetivo ──────────────────────────────────────────────── */
  const alPulsarMapa = useCallback((p: PuntoDelMapa) => {
    /*
     * 🔴 En modo «fijar pose» este gesto NO manda objetivos: mover el robot
     *    cuando alguien quería corregir su posición sería lo peor que puede
     *    hacer esta pantalla — y lo hizo una vez, ver `FijarPose`.
     *
     * El orden importa: **primero se consume la marca**, que es síncrona, y
     * sólo después se mira `modoPose`, que puede venir de un render anterior.
     */
    if (fijar.consumirClic()) return
    if (fijar.modoPose) return
    // Sin servidor de acción el objetivo sólo produciría un error, y el gesto ya
    // está desaconsejado en pantalla.
    if (mapa === null || pose === null || usuario === null || objetivo !== null) return
    const hora = horaCorta(Date.now())

    const { id, resultado } = transporte.enviarObjetivo(ACCION, TIPO_ACCION, {
      pose: {
        header: { frame_id: 'map' },
        pose: { position: { x: p.x, y: p.y, z: 0 }, orientation: cuaternionDeYaw(0) },
      },
    }, {
      alAvance: (v) => {
        const d = numeroValido((v as { feedback?: { distance_remaining?: number } })?.feedback?.distance_remaining)
        if (d !== null) setAvance(d)
      },
    })
    // Se anota la partida ANTES de que llegue el desenlace: si se leyera al
    // final no habría con qué comparar.
    partida.current = ultimoOdom.current
    setObjetivo({ id, x: p.x, y: p.y, hora })
    setAvance(null)
    setDesenlace(null)

    /*
     * 🔴🔴 LOS DOS DESENLACES MIENTEN, y por eso los dos se pintan igual: una
     *      lectura de `/odom` arriba y lo que dijo Nav2 debajo. El detalle de
     *      POR QUÉ mienten vive en `lib/robot/resultado_objetivo`, con pruebas.
     */
    const cerrar = (accion: QueDijoLaAccion, motivo: string | null) => setDesenlace({
      hora: horaCorta(Date.now()),
      accion,
      recorrido: recorridoEntre(partida.current, ultimoOdom.current),
      motivo,
    })
    resultado.then(
      () => cerrar('TERMINO', null),
      (err: Error) => cerrar('FALLO', err.message),
    ).finally(() => { setObjetivo(null); setAvance(null) })
  /*
   * 🔴 `fijar` VA EN LAS DEPENDENCIAS por la misma razón por la que antes iba
   *    `modoPose`: sin él, este callback se queda con el de cuando se creó y la
   *    guarda de arriba usaría un `modoPose` rancio — alguien que quisiera
   *    CORREGIR la pose del robot le mandaría un objetivo. Lo marcó eslint; el
   *    navegador no lo habría dicho, y `tsc` tampoco.
   */
  }, [mapa, pose, usuario, objetivo, transporte, fijar])

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
   * ⚠️ Se deduce de `/amcl_pose`, no se pregunta: AMCL y el servidor de acción
   *    vienen del MISMO launch, así que sin AMCL no hay a quién mandar nada. No
   *    es una comprobación directa, y por eso la pantalla dice «parece» y manda
   *    a mirar el robot en vez de afirmarlo.
   */
  const puedeNavegar = hayPose
  const recuento = hayMapa ? recuentoDeCeldas(mapa.data) : null
  const total = recuento === null ? 0 : recuento.LIBRE + recuento.OCUPADA + recuento.DESCONOCIDA
  // Un relleno por inundación sobre ~5000 celdas: gratis, y es lo único que
  // responde de verdad a «¿queda algo por mapear?».
  const frontera = hayMapa ? fronteraAbierta(mapa.info, mapa.data) : null
  const puedePulsar = puedeNavegar && usuario !== null && objetivo === null

  return (
    <div className="space-y-8" style={tono}>
      {/*
        🔴 PRIMERO EL CONTROL, DESPUES EL DIBUJO. Quien entra aquí sin Nav2
           corriendo ve un canvas vacío, y un canvas vacío se lee como «la
           interfaz está rota». Poner el arranque arriba convierte la pantalla en
           lo que es: primero se enciende, luego se mira.
      */}
      <Grupo titulo="Arrancar" fuente="/estado_navegacion · lo publica el supervisor del robot, a 1 Hz">
        <ControlNavegacion />
      </Grupo>

      <Grupo titulo="El mapa" fuente="/map y /amcl_pose · los dos vienen de Nav2, que hoy no arranca solo">
        {mapa === null && !hayPose ? (
          <Nav2Parado />
        ) : mapa === null ? (
          <MapaQueNoLlega />
        ) : (
          <Tarjeta
            titulo="Mapa"
            subtitulo={!puedeNavegar
              ? 'El mapa se está construyendo. Todavía no hay a quién mandar un objetivo.'
              : usuario === null
                ? 'Pulsa en el mapa para mandar al robot… con sesión iniciada.'
                : 'Pulsa en el mapa para mandar al robot a ese punto.'}
          >
            {!puedeNavegar && <div className="mb-3"><PareceSlamNoNav2 /></div>}

            <div className="rejilla mb-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* `cm` y no `cm/celda`: `Dato` parte el valor por su primer numero
                  y pinta el resto como UNIDAD, asi que «cm/celda» salia a 22 px y
                  partido en dos renglones. Lo que sobra va a la nota. */}
              <Dato
                etiqueta="Resolución"
                valor={`${numero(mapa.info.resolution * 100, 1)} cm`}
                nota="por celda"
              />
              <Dato etiqueta="Tamaño" valor={`${mapa.info.width} × ${mapa.info.height}`} />
              {/*
                🔴🔴 «FRONTERA», Y NO «% SIN EXPLORAR» — el porcentaje ENGAÑA en
                     cuanto la habitación se cierra, y costó conducir el robot en
                     círculos buscando algo que ya no existía.

                La rejilla es un rectángulo que envuelve al mapa, así que todo lo
                que hay FUERA de las paredes cuenta como desconocido para siempre.
                Medido en un cuarto real el 2026-08-06, tras mapearlo entero:

                    desconocido total ...... 2857 celdas (44,8 % del mapa)
                    desconocido ALCANZABLE ..    1 celda

                O sea: mapa terminado, y el número seguía diciendo «44,8 % sin
                explorar». Lo que responde a «¿queda algo por mapear?» es cuántas
                celdas grises se pueden ALCANZAR sin cruzar pared.

                📝 El porcentaje sigue a la vista en la nota, porque para un mapa
                   RECIÉN empezado sí es la cifra que evita la otra conclusión
                   falsa: un robot quieto produce 92,9 % desconocido y está sano.
              */}
              <Dato
                etiqueta="Frontera"
                // `celda` en singular cuando es una. Sale en pantalla y «1 celdas»
                // se lee como un descuido en una interfaz que pide que se la crea.
                valor={frontera === null
                  ? SIN_DATO
                  : `${numero(frontera, 0)} ${frontera === 1 ? 'celda' : 'celdas'}`}
                nota={frontera === 0
                  ? 'Cero: la habitación está cerrada. No queda nada alcanzable por mapear.'
                  : recuento === null || total === 0
                    ? undefined
                    : `Grises que se pueden alcanzar. Del mapa, ${numero((recuento.DESCONOCIDA / total) * 100, 1)} % es desconocido, casi todo fuera de las paredes.`}
              />
              <Dato
                etiqueta="Pose de AMCL"
                valor={hayPose
                  ? `${metros(numeroValido(pose.pose?.pose?.position?.x))} · ${grados(aGrados(yawDeCuaternion(pose.pose?.pose?.orientation) ?? 0))}`
                  : SIN_DATO}
                nota={hayPose ? undefined : 'No llega con el robot quieto: AMCL solo actualiza tras moverse 0,15 m.'}
              />
            </div>

            <LienzoMapa
              mapa={mapa}
              pose={pose}
              interactivo={puedePulsar}
              alPulsar={alPulsarMapa}
              alBajar={fijar.alBajar}
              alSoltar={fijar.alSoltar}
            />

            {usuario === null && (
              <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                Mandar al robot a un punto <strong>exige iniciar sesión</strong>, igual que liberar
                una parada: es una orden que mueve un robot en una sala con gente.
              </p>
            )}

            <ControlFijarPose fijar={fijar} deshabilitado={usuario === null} />

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

            {desenlace !== null && <ResultadoObjetivo {...desenlace} />}

            <Contexto>
            <p>
              El punto que se pulsa va con <strong>rumbo cero</strong>: esta pantalla dice a dónde
              ir, no mirando a dónde llegar. Nav2 da por bueno el objetivo dentro de su tolerancia
              de rumbo, y se ha medido que el robot llega girado <strong>10-14°</strong> respecto a
              lo pedido. Si el rumbo final importa para lo que estés midiendo, corrígelo a mano.
            </p>
            {/*
              🔴🔴 ESTE PÁRRAFO LLEVA **DOS** CORRECCIONES, Y LA SEGUNDA ES MÍA.

              (1) 2026-08-07 — decía «el error medido al llegar es de 8-10 cm,
                  que es la tolerancia configurada». El robot lo desmintió: con
                  un mapa viejo del mismo cuarto, Nav2 declaró SUCCEEDED a
                  41,3 cm. Era una cifra de un día bueno presentada como una
                  propiedad.

              (2) 2026-08-08 — al corregirlo escribí «con el cuarto remapeado el
                  mismo objetivo acabó a 6 cm», que es **n=1 presentado como
                  propiedad otra vez**. La réplica, mismo protocolo y misma marca:

                    mapa viejo      41,3 cm   AMCL 45,0   🔴 fuera de 10
                    remapeado · 1    6,1 cm   AMCL  8,9   ✅ dentro
                    remapeado · 2   11,8 cm   AMCL 15,2   🔴 fuera
                    remapeado · 3   11,3 cm   AMCL  8,2   🔴 fuera

                  Nav2 dijo SUCCEEDED **las cuatro veces**, con la tolerancia en
                  10 cm. Con el mapa fresco, **dos de tres quedaron fuera**: la
                  cifra honesta es ~10-12 cm, no los 10 que anuncia.

              📝 Cometí el mismo error que había señalado el día antes, con la
                 advertencia «n=1, esto pide repetirse» escrita al lado. **Ver el
                 error en el trabajo de otro no vacuna contra cometerlo.**

              → Lo que aguanta y sale reforzado: el mapa es la causa dominante, y
                el DESENLACE NO INFORMA DE LA PRECISIÓN. Eso es la forma, no la
                cifra, y es lo único sobre lo que se puede construir una promesa.
            */}
            <p>
              Y que la acción termine <strong>no dice dónde terminó</strong>. Nav2 declaró el mismo
              objetivo <strong>cumplido a 6,1 · 11,8 · 11,3 y 41,3 cm</strong>. Sobre el mapa
              fresco, <strong>dos de tres quedaron fuera</strong> de la tolerancia de 10. Y al
              revés también engaña: se midió a Nav2 <strong>abortando un objetivo que el robot
              cumplió</strong> diez segundos después. <strong>Ni terminar ni fallar dicen dónde
              está el robot.</strong> La cifra honesta sobre un mapa fresco es ~10-12 cm. Míralo.
            </p>
            {/*
              🔴 CORREGIDO EL 2026-08-09 (evidencia 97), y el error venía del robot.
              Esto decía «Nav2 no se cuela por huecos estrechos, los RODEA», con el
              engorde del mapa como mecanismo. ERA FALSO EN DOS SENTIDOS:

                · El rodeo NO lo causaba el ancho del hueco, sino un mapa de SLAM
                  construido con 160 cm de recorrido: 4 nodos, 49 celdas ocupadas.
                  Con un mapa hecho conduciendo, un hueco de 47 cm da plan RECTO
                  y el robot lo cruza. Lo mismo con AMCL sobre un mapa guardado.
                · Y por debajo del umbral NO rodea: no hay ruta y el planificador
                  se niega, que es un desenlace distinto.

              📌 La tasa de planes NO predice fallo, predice COSTE: con 3 de 8
                 planes cruzó 3 de 3, porque Nav2 replanifica hasta 35 veces por
                 trayecto y le basta con que el hueco esté abierto en algún momento.

              📝 Y ESTE PÁRRAFO ESTABA DENTRO DEL TEXTO DE FALLO, o sea que sólo se
                 leía cuando la acción fallaba — justo el caso en el que puede que
                 el robot haya llegado. Es contexto, es verdad siempre, y se lee
                 mejor ANTES de mandar el objetivo que después.
            */}
            <p>
              Si el robot tiene que pasar por un hueco, el ancho decide y está medido:
              por debajo de <strong>~45 cm</strong> no hay ruta y el planificador se niega. Entre{' '}
              <strong>~47 y 55</strong> sí pasa, pero puede tardar el triple y dar tumbos — eso no
              es un fallo, es un hueco demasiado justo. A partir de <strong>~60 cm</strong> cruza
              limpio. Y el mapa engorda los objetos ~5 cm por lado, así que el hueco físico tiene
              que ser mayor que el que mide la cinta.
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
