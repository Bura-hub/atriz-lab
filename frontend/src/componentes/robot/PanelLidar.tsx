'use client'

/**
 * LO QUE EL ROBOT VE. El barrido del YDLIDAR X2, dibujado en el marco del robot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTA PANTALLA CUESTA DINERO, Y ES LA UNICA QUE LO HACE
 * ═══════════════════════════════════════════════════════════════════════════
 * `/scan` es el **83 % del trafico de un robot**: ~67 kB/s de los 80,7 medidos
 * navegando. Todas las demas pantallas juntas cuestan menos que esta sola.
 *
 * → Por eso la suscripcion vive AQUI y no en el marco del robot: al salir de la
 *   ruta, `useTopic` da de baja y el `unsubscribe` llega al robot de verdad.
 *   Dejarlo puesto por descuido en 16 pestañas serian ~8,6 Mbit/s sobre la unica
 *   AP del aula.
 * → Y por eso el coste se **enseña en pantalla**. Un tope silencioso se escribe:
 *   quien lo mira tiene que saber que esto no es gratis.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LO QUE NO SE DIBUJA, Y POR QUE
 * ═══════════════════════════════════════════════════════════════════════════
 * De **260 puntos por barrido** (medido contra el robot el 2026-08-04), el
 * **83-89 % son validos**; el resto llegan como `Infinity` o `NaN`.
 * `puntosDelBarrido()` los descarta, y el recuento se enseña para que ese
 * porcentaje se lea como NORMAL y no como averia. ⚠️ Depende de la habitacion:
 * un rayo que no vuelve es un rayo que no encontro nada en 8 m. Pintar un hueco como 0
 * dibujaria un obstaculo pegado al robot que no existe — sobre una pantalla que
 * se usa para decidir si conducir, eso es peor que no dibujar nada.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useTeleoperacion } from '@/hooks/useTeleoperacion'
import {
  Punto, contarValidos, distanciaMinima, escala, puntosDelBarrido,
} from '@/lib/interfaz/barrido'
import { interpretarSeguridad } from '@/lib/interfaz/seguridad'
import { numero } from '@/lib/interfaz/formato'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Grupo } from '@/componentes/ui/Grupo'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/*
 * 🔴 EL LIENZO ES EL CONTENIDO DE ESTA PANTALLA, Y MEDIA 420 px EN UN PANEL DE
 *    1104. Visto en una captura a 1440 px de ancho: el dibujo ocupaba el 38 %
 *    del ancho disponible y el resto era blanco.
 *
 * Importa mas de lo que parece porque aqui la resolucion ES la informacion: el
 * X2 tira un rayo cada 1,7 cm a 0,68 m, asi que un objeto de 5 cm son 2-3
 * puntos. Con 420 px y 5 m de diametro, cada pixel vale 1,2 cm y esos 2-3
 * puntos caen casi encima. A 560 px son 0,9 cm por pixel y se separan.
 *
 * 🔴🔴 Y A 560 SEGUIA SOBRANDO MEDIA TARJETA. Medido en una captura de 1400 px:
 *      el lienzo eran 560 px centrados en una tarjeta de 1078, o sea **518 px
 *      (el 48 %) de papel en blanco a los costados**, mientras las tres lecturas
 *      iban en una franja de ancho completo debajo con celdas de 360 px que solo
 *      contenian una etiqueta de 10 px y una raya.
 *
 *      El cuerpo pasa a DOS COLUMNAS: el dibujo a la izquierda creciendo hasta
 *      700 px, y las lecturas apiladas en un rail de 18 rem a la derecha. Ahi
 *      cabe ademas el cartel de «no llega /scan», que antes iba SOBRE el lienzo
 *      tapando el tercio inferior y pisando los anillos.
 *
 * ⚠️ El tope sigue existiendo: el lienzo es cuadrado y tiene que caber sin
 *    desplazar. 700 px de alto entran en un portatil de aula.
 */
const LADO_MAX = 700      // px del lienzo, cuadrado. Es un TOPE, no un tamaño fijo
const RADIO_M = 2.5       // metros que caben del centro al borde

/**
 * Los colores del lienzo, LEIDOS DEL TEMA. No se eligen aqui.
 *
 * 🔴 Antes este componente preguntaba a `window.matchMedia('(prefers-color-
 *    scheme: dark)')`, que es una fuente DISTINTA de la que gobierna el resto de
 *    la interfaz. Con el sistema operativo en oscuro y la aplicacion en claro,
 *    el lienzo pintaba trazos de modo oscuro sobre fondo claro — en la pantalla
 *    que se usa para decidir si el paso esta libre.
 *    Ahora hay una sola fuente de verdad: los tokens ya calculados.
 */
export interface ColoresLienzo {
  linea: string
  texto: string
  punto: string
  robot: string
}

/**
 * ⚠️ Se lee UNA vez y se cachea. `/scan` llega a ~10 Hz y
 * `getComputedStyle()` fuerza calculo de estilo: hacerlo en cada barrido seria
 * pagar un reflow diez veces por segundo para releer cuatro colores que no
 * cambian.
 */
export function coloresDelTema(): ColoresLienzo {
  const raiz = getComputedStyle(document.documentElement)
  const t = (nombre: string, alfa = 1) => {
    const v = raiz.getPropertyValue(nombre).trim()
    // Los tokens se guardan como «R G B» para que Tailwind pueda componerles
    // alfa. Si falta uno, se cae a un gris legible en los dos temas en vez de
    // devolver una cadena vacia, que pintaria transparente sin dar error.
    return v === '' ? `rgb(128 128 128 / ${alfa})` : `rgb(${v} / ${alfa})`
  }
  return {
    linea: t('--border'),
    texto: t('--muted-foreground'),
    punto: t('--foreground'),
    robot: t('--muted-foreground'),
  }
}

/**
 * Dibuja el barrido. Toda la geometria viene ya resuelta de `barrido.ts`.
 *
 * ⚠️ `lado` va en pixeles CSS, no en pixeles del bufer. El contexto llega ya
 * escalado por `devicePixelRatio` desde `repintar()`: aqui se dibuja como si la
 * pantalla fuera de 1×, y esa es toda la diferencia entre un dibujo nitido y uno
 * borroso al agrandar el lienzo.
 */
function pintar(
  ctx: CanvasRenderingContext2D, lado: number, puntos: Punto[], col: ColoresLienzo,
): void {
  const k = escala(lado, RADIO_M)
  const c = lado / 2

  ctx.clearRect(0, 0, lado, lado)

  // Anillos de referencia cada medio metro, con su etiqueta.
  // 🔴 EL CUERPO DE LA ETIQUETA CRECE CON EL LIENZO. Estaba clavado en 10 px
  //    cuando el dibujo medía 560; al llegar a 700 esos 10 px son la única cosa
  //    de la pantalla que NO creció, y a 50 cm ya no se leen. Se acota entre 10 y
  //    13: es una leyenda, no puede competir con las lecturas del raíl.
  const cuerpo = Math.min(13, Math.max(10, Math.round(lado / 56)))
  ctx.strokeStyle = col.linea
  ctx.fillStyle = col.texto
  ctx.font = `${cuerpo}px system-ui, sans-serif`
  ctx.lineWidth = 1
  for (let m = 0.5; m <= RADIO_M; m += 0.5) {
    ctx.beginPath()
    ctx.arc(c, c, m * k, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillText(`${m.toFixed(1)} m`, c + 3, c - m * k + cuerpo + 1)
  }

  // Los puntos. 🔴 x del robot va hacia ARRIBA en pantalla, e y hacia la
  // IZQUIERDA: es REP-103 (x adelante, y a la izquierda) girado para que
  // «adelante» se vea arriba, que es como lo mira una persona.
  ctx.fillStyle = col.punto
  for (const p of puntos) {
    ctx.fillRect(c - p.y * k - 1.5, c - p.x * k - 1.5, 3, 3)
  }

  // El robot: 21,7 cm de ancho x 19,0 de largo, MEDIDO con cinta (con orugas).
  // La ficha de Sphero decia 0.218 x 0.185 y las dos estaban mal, ademas de
  // cruzadas. Se dibuja a escala para que el barrido tenga referencia real.
  ctx.strokeStyle = col.robot
  ctx.lineWidth = 1.5
  ctx.strokeRect(c - (0.217 / 2) * k, c - (0.190 / 2) * k, 0.217 * k, 0.190 * k)
  // La proa, para que se vea hacia donde mira.
  ctx.beginPath()
  ctx.moveTo(c, c - (0.190 / 2) * k)
  ctx.lineTo(c, c - (0.190 / 2) * k - 10)
  ctx.stroke()
}

/**
 * Una celda del raíl de lecturas: rótulo arriba, valor debajo.
 *
 * ⚠️ NO usa `Dato` a propósito. `Dato` pinta en `.cifra` —28-36 px— porque es
 * la malla principal de una pantalla de telemetría; esto es el raíl
 * SUBORDINADO de un dibujo que ya manda, y ahí la escala es `.cifra-menor`.
 * La regla de la ausencia sí es la misma: una raya pequeña, nunca del tamaño
 * del valor, porque con el robot apagado casi todo son rayas.
 */
function Lectura({ etiqueta, valor, unidad, nota }: {
  etiqueta: string
  /** Ya formateado. `null` es «no se sabe». */
  valor?: string | null
  unidad?: string
  nota?: string
}) {
  return (
    <div className="px-5 py-4">
      <div className="microetiqueta">{etiqueta}</div>
      <div className="mt-1.5">
        {valor === null || valor === undefined ? (
          <span className="hueco text-lg leading-none" title="no se sabe">—</span>
        ) : (
          <span className="cifra-menor">
            {valor}
            {unidad !== undefined && <span className="unidad">{unidad}</span>}
          </span>
        )}
      </div>
      {nota !== undefined && (
        <p className="mt-1.5 max-w-prose text-[11px] leading-snug text-muted-foreground">{nota}</p>
      )}
    </div>
  )
}

/**
 * Una celda de la tira de coste: la cifra arriba y su rótulo DEBAJO.
 *
 * 📝 El orden invertido respecto a `Lectura` no es un descuido: aquí la cifra
 * es la razón de que la tira exista —83 %, ~67 kB/s— y el rótulo la explica.
 * Es la disposición de las maquetas de Stitch para una medida de cabecera.
 */
function Coste({ cifra, unidad, etiqueta, nota }: {
  /** Sin cifra se pinta una raya: un coste que nadie ha medido es un hueco. */
  cifra?: string
  unidad?: string
  etiqueta: string
  nota: string
}) {
  return (
    <div className="px-5 py-4">
      <div>
        {cifra === undefined ? (
          <span className="hueco text-lg leading-none" title="no se sabe">—</span>
        ) : (
          <span className="cifra-menor">
            {cifra}
            {unidad !== undefined && <span className="unidad">{unidad}</span>}
          </span>
        )}
      </div>
      <div className="microetiqueta mt-1.5">{etiqueta}</div>
      <p className="mt-1.5 max-w-prose text-[11px] leading-snug text-muted-foreground">{nota}</p>
    </div>
  )
}

export function PanelLidar() {
  const { transporte } = useRobot()
  const scan = useTopic(transporte, '/scan')
  const monitor = useTopic(transporte, '/collision_monitor_state')
  const { arrancarBarrido } = useTeleoperacion(transporte)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [encendiendo, setEncendiendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  // Los colores se leen una vez y se refrescan solo si el tema cambia de
  // verdad. Ver `coloresDelTema()`.
  const [colores, setColores] = useState<ColoresLienzo | null>(null)
  useEffect(() => {
    const leer = () => setColores(coloresDelTema())
    leer()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  /*
   * 🔴🔴 EL LIENZO SE PINTA SIEMPRE, TAMBIEN SIN BARRIDO.
   *
   * Antes el dibujo colgaba de `scan !== null`, asi que con el robot apagado
   * —que es el estado mas frecuente del laboratorio, y el de un robot
   * cargando— esta pantalla entera eran un aviso, una tarjeta de 220 px y un
   * boton: medido en una captura de 1800 px de alto, **el 64 % era papel en
   * blanco**. El instrumento desaparecia justo cuando hacia falta explicar
   * que no estaba roto.
   *
   * Los anillos y la silueta del robot **no dependen de ningun dato**: son la
   * escala del dibujo. Reservarlos siempre da a la pantalla el area que le
   * corresponde y hace que encender el barrido sea rellenar un marco que ya
   * esta ahi.
   *
   * ⚠️ Es un dibujo ESTATICO —se repinta cuando llega un barrido, cuando cambia
   *    el tema y cuando cambia de tamaño, y nada mas—, asi que no choca con la
   *    regla de no animar la llegada de un dato.
   *
   * 🔴 EL BUFER VA ESCALADO POR `devicePixelRatio`, Y ESO NO ES UN DETALLE.
   *    Antes el lienzo tenia 560 px de bufer y 560 de CSS: coincidian, asi que
   *    nadie lo miro. Al dejarlo crecer hasta 700 px —y en una pantalla de 2×,
   *    hasta 1400 fisicos— un bufer fijo se estira y **el dibujo sale borroso**,
   *    justo en la pantalla donde la resolucion ES la informacion (2-3 puntos
   *    por objeto de 5 cm). Se mide el ancho CSS de verdad, se pone el bufer a
   *    `ancho × dpr` y se escala el contexto: `pintar()` sigue dibujando en
   *    unidades CSS y no se entera.
   */
  const repintar = useCallback(() => {
    const cv = lienzo.current
    if (cv === null || colores === null) return
    const lado = cv.clientWidth
    // Antes de que el navegador reparta el ancho, `clientWidth` es 0 y no hay
    // nada que dibujar: el `ResizeObserver` volvera con la medida buena.
    if (lado === 0) return
    const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
    const px = Math.round(lado * dpr)
    // Asignar `width` REINICIA el contexto entero, asi que solo se toca cuando
    // cambia de verdad — y `setTransform` va siempre despues, no antes.
    if (cv.width !== px || cv.height !== px) {
      cv.width = px
      cv.height = px
    }
    const ctx = cv.getContext('2d')
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    pintar(ctx, lado, scan === null ? [] : puntosDelBarrido(scan), colores)
  }, [scan, colores])

  useEffect(() => { repintar() }, [repintar])

  // El lienzo es fluido: al cambiar el ancho de la ventana cambia su tamaño en
  // CSS, y con el el bufer. Sin esto, agrandar la ventana deja un dibujo hecho
  // para otro tamaño.
  useEffect(() => {
    const cv = lienzo.current
    if (cv === null) return
    const ro = new ResizeObserver(() => repintar())
    ro.observe(cv)
    return () => ro.disconnect()
  }, [repintar])

  const seguridad = interpretarSeguridad(monitor)
  const cuenta = scan === null ? null : contarValidos(scan)
  const minima = scan === null ? null : distanciaMinima(scan)

  const encender = async () => {
    setEncendiendo(true)
    setFallo(null)
    try {
      await arrancarBarrido()
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e))
    } finally {
      setEncendiendo(false)
    }
  }

  return (
    /*
      🔴 LAS TRES PANTALLAS DE INSTRUMENTO COMPARTEN RITMO: `space-y-8` entre
         bandas y `gap-4` dentro. Esta era una pila plana de dos tarjetas con
         `space-y-4`, o sea la misma caja repetida y con OTRO ritmo vertical que
         telemetría — que ya estaba bandeada. `Grupo` dice qué es cada cosa: un
         instrumento y su factura no se leen igual.
    */
    <div className="space-y-8">
      <Grupo
        titulo="El instrumento"
        fuente="/scan · ~10 Hz mientras el barrido esté encendido"
      >
        <div className="grid gap-4">
          {seguridad.efecto !== 'DESCONOCIDO' && (
            <Aviso
              nivel={seguridad.efecto === 'BLOQUEA' ? 'ATENCION' : 'NOTA'}
              titulo="La capa de seguridad"
            >
              {seguridad.explicacion}
              {seguridad.queHacer !== '' && <> — <strong>{seguridad.queHacer}</strong>.</>}
            </Aviso>
          )}

          <Tarjeta
            titulo="Lo que el robot ve"
            subtitulo="barrido del LIDAR, en el marco del robot · arriba es «adelante»"
            extremo={
              cuenta === null
                ? <Insignia tono="NEUTRO">sin barrido</Insignia>
                : <Insignia tono="BIEN">{cuenta.validos} de {cuenta.total} puntos</Insignia>
            }
          >
            {/*
              🔴🔴 DOS COLUMNAS: EL DIBUJO A LA IZQUIERDA Y LAS LECTURAS EN UN
                   RAIL. Ver la cabecera del fichero — el lienzo cuadrado
                   centrado dejaba el 48 % de la tarjeta en blanco a los
                   costados, y las lecturas iban debajo en celdas de 360 px con
                   una etiqueta y una raya dentro.

              `px-5`: nada de esto es una `.rejilla`, asi que pone su propio
              relleno. Es el defecto recurrente que documenta `Tarjeta`.
              `items-start` para que el rail no se estire a la altura del dibujo.
            */}
            <div className="grid gap-5 px-5 pb-5 pt-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              {/*
                EL MARCO DEL INSTRUMENTO. El borde lo lleva este contenedor y no
                el `<canvas>`, para que la escala pueda ir DENTRO del marco como
                pie del dibujo (ver abajo).
              */}
              <div className="mx-auto w-full max-w-[700px] rounded-md border border-border">
                <div className="relative">
                  <canvas
                    ref={lienzo}
                    width={LADO_MAX}
                    height={LADO_MAX}
                    role="img"
                    aria-label={
                      cuenta === null
                        ? 'Marco del barrido: los anillos de referencia cada medio metro y la '
                          + 'silueta del robot. Sin puntos, porque no está llegando /scan.'
                        : `Barrido del LIDAR con ${cuenta.validos} puntos válidos de `
                          + `${cuenta.total}, dibujado en el marco del robot.`
                    }
                    /* `aspect-square`: el tamaño lo decide el CSS y el bufer lo
                       sigue en `repintar()`. Antes lo mandaban los atributos. */
                    className="block aspect-square w-full"
                  />
                </div>

                {/*
                  🔴 LA ESCALA, COMO PIE DEL LIENZO Y DENTRO DE SU MARCO.

                  Estaba en la franja de lecturas, en `.cifra-menor`, y era **la
                  única cifra rellena de las tres**: con el robot apagado las dos
                  lecturas de verdad son rayas, así que la leyenda del dibujo
                  pesaba más que las medidas del robot. Y no es una lectura: es
                  un parámetro de este widget metido en un hueco de medida.

                  Aquí es lo que es —la leyenda del dibujo— y no ocupa una celda
                  que pertenece a una lectura.
                */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border px-4 py-2">
                  <span className="microetiqueta">Escala</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    0,5&nbsp;m entre anillo y anillo · el borde está a 2,5&nbsp;m
                  </span>
                </div>
              </div>

              {/*
                EL RAIL. Las dos lecturas del robot apiladas, y encima el «no
                llega /scan» cuando toca.

                🔴 EL CARTEL SALE DE ENCIMA DEL DIBUJO. Iba `absolute` sobre el
                   lienzo, anclado abajo, y tapaba el tercio inferior: los
                   anillos de 1,5, 2,0 y 2,5 m quedaban debajo de un velo. El
                   argumento para ponerlo ahí era que el marco vacío se explica
                   mejor enseñándolo vacío — y eso se cumple MEJOR así: ahora el
                   marco se ve entero y el cartel está a su lado, en la misma
                   tarjeta.
              */}
              <div className="rejilla self-start sm:grid-cols-2 lg:grid-cols-1">
                {scan === null && (
                  <div className="space-y-3 px-5 py-4 sm:col-span-2 lg:col-span-1">
                    <p className="text-sm">
                      No está llegando <code>/scan</code>. <strong>No es una avería</strong>: el
                      barrido arranca apagado a propósito en los 16 robots, porque si no el LIDAR
                      giraría a 11,8&nbsp;Hz las 24&nbsp;horas.
                    </p>
                    <button
                      type="button"
                      onClick={encender}
                      disabled={encendiendo}
                      className="w-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-ring transition-transform duration-150 active:scale-[0.97]"
                    >
                      {encendiendo ? 'esperando un barrido real…' : 'Encender el barrido'}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Espera a que llegue un <code>/scan</code> de verdad, no a que el servicio
                      responda: <code>/start_scan</code> ha devuelto éxito con el puerto del LIDAR
                      muerto.
                    </p>
                  </div>
                )}

                {/*
                  🔴 LAS LECTURAS ESTAN SIEMPRE, CON RAYAS CUANDO NO HAY DATO.
                     Antes solo existían con barrido. La ausencia se pinta como
                     raya —pequeña y apagada—, nunca del tamaño del valor.
                */}
                <Lectura
                  etiqueta="Puntos válidos"
                  valor={cuenta === null ? null : String(cuenta.validos)}
                  nota={
                    cuenta === null
                      ? 'entre el 83 y el 89 % de los rayos de un barrido: lo normal, no una avería'
                      : `de ${cuenta.total} rayos · el 83-89 % es lo normal`
                  }
                />
                <Lectura
                  etiqueta="Lo más cercano"
                  valor={minima === null ? null : numero(minima, 2)}
                  unidad="m"
                  nota="del centro del robot, en línea recta"
                />

                {/*
                  🔴 EL AVISO CIERRA EL RAIL, Y ESTABA EN EL `pie` DE LA TARJETA.
                     Ahi cruzaba la ficha entera de lado a lado mientras el raíl
                     acababa 255 px antes que el dibujo: una franja de prosa
                     debajo, y papel en blanco al lado. Es una advertencia sobre
                     CÓMO LEER ESTE DIBUJO, así que su sitio es junto al dibujo.
                     Y de paso el raíl deja de acabar a media altura.
                */}
                <div className="px-5 py-4 text-[11px] leading-snug text-muted-foreground sm:col-span-2 lg:col-span-1">
                  <div className="microetiqueta mb-1.5">Cómo se lee</div>
                  <p>
                    Los puntos que faltan <strong>no son obstáculos ausentes</strong>: el X2
                    devuelve ~89&nbsp;% de lecturas válidas y el resto se descartan. Y un objeto
                    fino de 5&nbsp;cm da 2-3 puntos a 0,68&nbsp;m, así que <strong>en un barrido
                    suelto puede desaparecer</strong>. Sirve para orientarse, no para decidir que
                    el paso está libre.
                  </p>
                </div>
              </div>
            </div>

            {/* El fallo va aparte: puede ser un mensaje largo y en el raíl no
                cabría sin empujar las lecturas fuera de la vista. */}
            {fallo !== null && (
              <div className="px-5 pb-4">
                <Aviso nivel="ERROR" titulo="No se encendió">{fallo}</Aviso>
              </div>
            )}
          </Tarjeta>
        </div>
      </Grupo>

      {/*
        🔴 EL COSTE, EN PANTALLA — PERO DEBAJO DEL INSTRUMENTO Y COMO DATOS.
           Esto era un `Aviso` de cinco líneas a 12 px: el bloque más grande de
           la pantalla, el único con fondo de color, y colocado ENCIMA del
           dibujo. Sus dos cifras —el 83 % y los ~67 kB/s— iban en negrita
           dentro del párrafo, cuando son exactamente lo que justifica el aviso.
           Ahora son cifras con su rótulo, y la explicación larga se pliega.

        ⚠️ Lo que NO se pliega es que hay una segunda suscripción y que su
           caudal NO está medido: un coste sin medir es un hueco, y un hueco
           callado se lee como «no cuesta nada».
      */}
      <Grupo
        titulo="Lo que cuesta"
        fuente="las dos suscripciones se cierran solas al salir de aquí"
      >
        <Tarjeta
          titulo="El caudal"
          subtitulo="Es la única pantalla de esta aplicación que gasta de verdad."
        >
          <div className="rejilla sm:grid-cols-3">
            <Coste
              cifra="83"
              unidad="%"
              etiqueta="Parte del tráfico"
              nota="de los 80,7 kB/s de un robot navegando, medidos en el robot y en el navegador"
            />
            <Coste
              cifra="≈67"
              unidad="kB/s"
              etiqueta="Coste de /scan"
              nota="todas las demás pantallas juntas cuestan menos que esta sola"
            />
            <Coste
              etiqueta="Coste sin medir"
              nota="/collision_monitor_state publica al cambiar, no cada tanto: en reposo no cuesta nada y nadie ha medido cuánto cuesta conduciendo"
            />
          </div>

          <Contexto>
            <p>
              Por eso la suscripción vive en esta pantalla y no en el marco del robot: al salir de
              la ruta se da de baja, y la baja llega al robot de verdad. Dejarla puesta por
              descuido en las dieciséis pestañas serían ~8,6&nbsp;Mbit/s sobre la única antena del
              aula.
            </p>
            <p>
              Un tope silencioso se escribe: quien mira esto tiene que saber que no sale gratis. Un
              robot cuesta 13,6&nbsp;kB/s en reposo y 80,7 navegando, y de esos 80,7 el barrido es
              el 83&nbsp;%.
            </p>
          </Contexto>
        </Tarjeta>
      </Grupo>
    </div>
  )
}
