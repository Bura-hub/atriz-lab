'use client'

/**
 * EL MURO DEL PROFESOR: los 16 robots a la vez, para mirarlos de lejos.
 *
 * 🔴🔴 LO QUE ESTE MURO NO PUEDE HACER HOY, Y VA ESCRITO EN LA PANTALLA:
 * **no puede saber si un robot esta vivo.** Para eso haria falta el ritmo de
 * `/odom`, que cuesta 1,7 Mbit/s por los 16. `/motor_status` llega a 1 Hz
 * **republicado desde el estado cacheado del driver**, asi que sigue llegando con
 * el RVR apagado: distingue «la Raspberry Pi esta viva» de «no hay nadie», y nada
 * mas.
 *
 * → Por eso la baldosa dice «sin señal de vida» y NUNCA «averiado». Se cierra con
 *   una linea en el driver -un `/latido` a 1 Hz con un contador monotono, ~0,5
 *   kB/s los 16- que hoy no existe en la rama `ros2`.
 *
 * ⚠️ Y cuando exista: **la interfaz tendra que comparar DOS lecturas separadas en
 * el tiempo**, porque el latido va `TRANSIENT_LOCAL` y un suscriptor nuevo puede
 * recibir el ultimo valor latcheado. Una sola lectura no probaria nada. Lo que da
 * la garantia es la republicacion a 1 Hz, no el QoS.
 */

import { CSSProperties, useCallback, useMemo, useState } from 'react'
import { TOPICS_MURO, caudalDeFlota } from '@/lib/flota/presupuesto'
import { Baldosa } from '@/lib/flota/resumen'
import { EstadoRobot } from '@/lib/rosbridge/salud'
import { OrdenMuro, ordenarBaldosas } from '@/lib/flota/orden'
import { ControlesMuro } from './ControlesMuro'
import { ROBOTS, TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { destinoDe } from '@/lib/interfaz/direcciones'
import { numero } from '@/lib/interfaz/formato'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { AlResumir, BaldosaConectada } from './BaldosaConectada'
import { DondeBuscar, useDirecciones } from './DondeBuscar'

export function MuroFlota() {
  const porRobot = caudalDeFlota(TOPICS_MURO, 1)
  const total = caudalDeFlota(TOPICS_MURO, TOTAL_ROBOTS)
  const { direcciones, poner } = useDirecciones()
  const [proyeccion, setProyeccion] = useState(false)
  const [orden, setOrden] = useState<OrdenMuro>('NUMERO')

  /*
    EL TONO DE IDENTIDAD DE ESTA PANTALLA, Y ERA LA UNICA DE LAS NUEVE QUE NO LO
    USABA. La portada llega en violeta a sangre y el cuaderno en grafito; el muro
    salia en papel blanco con el titular flotando, mientras el rail —tres
    centimetros a la izquierda— pinta su pastilla activa en cobalto para ese
    mismo sitio.

    Va en dos sitios y hacen falta los dos: en la cabecera lo consume
    `.campo-seccion`, y en el `<main>` baja por herencia a la `.capucha` y al
    `.filete-titulo` de la tarjeta de la leyenda. Mismo mecanismo que
    `MarcoRobot`, no uno nuevo.
  */
  const tono = { '--tono-seccion': 'var(--seccion-flota)' } as CSSProperties

  /*
   * El estado de cada ficha, informado desde abajo. Solo se guardan la ATENCION
   * y el ESTADO: es lo unico que el orden y el aviso de flota entera necesitan, y
   * guardar la baldosa entera obligaria a re-renderizar el muro completo con cada
   * mensaje de cada robot.
   */
  const [atenciones, setAtenciones] = useState<Record<number, Baldosa['atencion']>>({})
  const [estados, setEstados] = useState<Record<number, EstadoRobot>>({})
  const alResumir = useCallback<AlResumir>((id, atencion, estado) => {
    setAtenciones((a) => (a[id] === atencion ? a : { ...a, [id]: atencion }))
    setEstados((e) => (e[id] === estado ? e : { ...e, [id]: estado }))
  }, [])

  /*
   * 🔴 EL HECHO SE DICE UNA VEZ, NO DIECISEIS.
   *
   * Con los robots apagados —el estado mas comun del laboratorio— cada ficha
   * repetia «no llego» y «ultimo dato: nunca», o sea el mismo hecho 32 veces
   * sobre 16 rectangulos casi vacios. Cuando fallan TODOS no hay 16 problemas:
   * hay uno, y es de red o de encendido. Se dice arriba, en una linea.
   *
   * ⚠️ Solo cuando fallan los DIECISEIS. Si cae uno, la ficha apagada entre
   *    quince vivas ya salta a la vista y esta frase mentiria.
   */
  const nadieResponde = ROBOTS.every((id) => estados[id] === 'SIN_CONEXION')

  /*
   * 🔴 EL ORDEN SE APLICA CON `order` DE CSS, NO REORDENANDO EL ARRAY.
   *
   * Mover las fichas en el DOM las desmontaria, y con ellas sus dieciseis
   * WebSockets: el muro entero se reconectaria cada vez que un robot cruzara un
   * umbral. Con `order` cambia la posicion VISUAL y el arbol se queda quieto.
   */
  const posicion = useMemo(() => {
    const fichas = ROBOTS.map((id) => ({
      id,
      baldosa: { atencion: atenciones[id] ?? 'NINGUNA' } as Baldosa,
    }))
    const m: Record<number, number> = {}
    ordenarBaldosas(fichas, orden).forEach((f, i) => { m[f.id] = i })
    return m
  }, [atenciones, orden])

  return (
    <div className={`relative min-h-screen bg-background text-foreground ${proyeccion ? 'proyeccion' : ''}`}>
      {/*
        LA LUZ AMBIENTE. Dos orbes desenfocados y FIJOS que tiñen la pantalla
        entera: es lo que impide que el pozo oscuro se lea como «apagado» en vez
        de como «profundo». Fijos por rendimiento — ver `.luz-ambiente`.
      */}
      <div className="luz-ambiente" aria-hidden="true" />
      {/*
        LA BANDA DE IDENTIDAD, A SANGRE.

        🔴 EL COBALTO OCUPA UNA REGIÓN ENTERA —no es un acento— y es lo que hace
           que esta pantalla se reconozca a tres metros aunque no se lea una
           palabra. Y es el MISMO cobalto con el que el raíl pinta su pastilla
           «Flota»: sin él, el raíl anunciaba un sitio que la pantalla no era.

        📌 La mitad derecha lleva lo que antes flotaba sobre papel: los dos
           controles y las dos cifras de caudal. No es relleno — el caudal es la
           restricción que gobierna el diseño de este muro, así que va donde va
           el nombre de la pantalla.
      */}
      <header className="campo-seccion relative z-10" style={tono}>
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 gap-y-6 px-4 pb-9 pt-12 sm:px-6">
          <div>
            {/*
              A DOS LINEAS, como lo compuso Stitch. No es capricho: proyectado, un
              titular de una sola linea se come el ancho que necesitan las cifras
              de caudal, y partirlo deja la columna izquierda libre.

              🔴 EL TITULAR VA EN BLANCO LISO, Y ANTES ERA UN DEGRADADO
                 TINTA→GRIS CON `bg-clip-text`. Ese degradado esta calculado para
                 leerse sobre papel; sobre un campo cobalto saturado la parada
                 gris se hunde en el fondo y la palabra se parte por la mitad. Es
                 la misma familia de fallo que las paradas de degradado con blanco
                 literal que dejaron tres titulares invisibles al cambiar el tema:
                 una tinta que no mira el fondo sobre el que cae.

              📝 Y desaparece de paso la rama de proyeccion del titular: blanco
                 sobre cobalto da 8,1:1, asi que aguanta el proyector sin
                 tratamiento aparte.

              📐 `clamp(2.5rem, 6vw, 4.5rem)` es el MISMO de la portada y el
                 cuaderno. Antes las tres cabeceras median 72, 78 y 60 px con
                 factores `vw` distintos — tres tamaños no son una escala.
            */}
            <h1
              className="font-semibold leading-[0.92] tracking-[-0.05em] text-white"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
            >
              Flota<br />Atriz
            </h1>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-white/80">
              {TOTAL_ROBOTS} Sphero RVR en el aula. Los que están en color piden algo; los de
              vidrio, no. Cada ficha abre su propio WebSocket y escucha solo{' '}
              <code className="font-mono text-white">{TOPICS_MURO.join(' + ')}</code>.
            </p>
          </div>

          {/*
            El presupuesto de red. No es adorno: es el número que decide a qué
            topics puede suscribirse este muro.
          */}
          <div className="flex flex-col items-start gap-3 sm:items-end">
          <ControlesMuro
            proyeccion={proyeccion}
            alCambiarProyeccion={setProyeccion}
            orden={orden}
            alCambiarOrden={setOrden}
          />
          {/*
            🔴 LAS DOS DEL MISMO ANCHO, Y NO ES SIMETRÍA POR GUSTO: son la MISMA
               magnitud a dos escalas -lo que cuesta un robot y lo que cuestan los
               dieciséis-, así que tienen que leerse como pareja. Dimensionadas al
               contenido, «POR ROBOT» y «LOS 16» daban dos cajas distintas y la
               comparación se perdía. `grid-cols-2` iguala las dos columnas a la
               más ancha sin fijar ninguna medida a mano.

            📝 Y las cifras van en `.cifra-menor` con la unidad en `.unidad`, que
               es la escala que la aplicación ya define: antes eran un `text-[21px]`
               inventado con la unidad a 11 px, o sea la misma decisión tomada dos
               veces y con otros números.

            ⚠️ Sobre el campo dejan de ser `.vidrio`: una ficha de papel blanco
               encima del cobalto se lee como una tarjeta suelta, no como parte de
               la banda. El relleno lo pone el blanco al 10 % SOBRE UN CAMPO
               OPACO, así que vale lo mismo en cualquier punto de la pantalla — es
               la misma regla que hizo opacos los fondos de aviso.
          */}
          <dl className="grid grid-cols-2 gap-2.5">
            <div className="rounded-md border border-white/25 bg-white/10 px-[18px] py-[13px]">
              <dt className="microetiqueta !text-white/70">por robot</dt>
              <dd className="cifra-menor mt-1 text-white">
                {numero(porRobot, 2)}<span className="unidad !text-white/70">kB/s</span>
              </dd>
            </div>
            <div className="rounded-md border border-white/25 bg-white/10 px-[18px] py-[13px]">
              <dt className="microetiqueta !text-white/70">los {TOTAL_ROBOTS}</dt>
              <dd className="cifra-menor mt-1 text-white">
                {numero(total, 2)}<span className="unidad !text-white/70">kB/s</span>
              </dd>
            </div>
          </dl>
          </div>
        </div>
      </header>

      {/*
        🔴 `max-w-6xl` Y NO `max-w-7xl`. Es el ancho de la portada, del cuaderno
           y de las seis pestañas del robot; el muro se habia quedado atras. A
           1920 px la columna de la portada arrancaba en x=545 y la de aqui en
           x=483: **62 px de salto** al cambiar de pantalla, que el ojo lee como
           que la pagina se ha movido.
      */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6" style={tono}>
        {/*
          🔴 El cuadro de direcciones va ANTES de la losa y CERRADO. Es
             configuracion, no estado: no cambia con lo que hace el robot, asi
             que se pliega. Los motivos de una baldosa NO se pliegan nunca —esa
             es la regla— pero esto no es un motivo, es un ajuste de red de
             ESTE navegador.
        */}
        <div className="mb-4">
          <DondeBuscar direcciones={direcciones} poner={poner} />
        </div>

        {/*
          ── EL HECHO, UNA VEZ ────────────────────────────────────────────────
          🔴 FONDO OPACO. `--aviso-atencion` es ese mismo tinte ya resuelto
             sobre la ficha blanca. Con un `bg-warning/[0.08]` la franja pasaria
             por delante de los dos orbes de la luz ambiente, que son FIJOS y
             ocupan cuadrantes distintos: empezaria crema por la izquierda y
             acabaria verde por la derecha.

          ⚠️ Y NO dice «averiado» ni nada parecido: este muro no puede saber si
             un robot esta vivo. Dice el hecho -no llega ninguno- y las dos
             causas que estan al alcance de quien lo lee.
        */}
        {nadieResponde && (
          <p className="mb-3 rounded-ficha border border-warning/40 bg-[rgb(var(--aviso-atencion))] px-5 py-3.5 text-sm leading-relaxed text-foreground">
            Ningún robot responde — comprueba que estén encendidos y en la red.
          </p>
        )}

        {/*
          ── EL ÚNICO MOMENTO DE MOVIMIENTO ORQUESTADO DE LA APLICACIÓN ───────
          Las dieciséis fichas suben 20 px y aparecen al entrar, con 60 ms entre
          una y la siguiente. `craft-floor`: «one authored moment, not scattered
          effects».

          🔴 Y ES CSS, NO JAVASCRIPT, POR UNA RAZÓN QUE IMPORTA. Una entrada
             escalonada hecha con estado de React se repetiría en cada
             re-render, y aquí hay dieciséis WebSockets reconectándose por su
             cuenta: el muro se pondría a barajar sus fichas cada vez que un
             robot volviera. Una animación CSS corre **al montar y nunca más**,
             que es exactamente la garantía que hace falta.

          📌 `4x4` es la forma que pide el encargo: el profesor mira los
             dieciséis a la vez, a veces proyectados. Las columnas de móvil se
             conservan porque un teléfono no puede con cuatro.
        */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ROBOTS.map((id, i) => (
            <div
              key={id}
              // `h-full` en el envoltorio Y en la ficha: si no, el envoltorio de
              // la animacion no estira y las fichas de una misma fila quedan de
              // alturas distintas, con hueco muerto debajo de las cortas.
              className="animate-entrar h-full"
              style={{ animationDelay: `${i * 60}ms`, order: posicion[id] ?? id }}
            >
              <BaldosaConectada
                id={id}
                destino={destinoDe(id, direcciones)}
                alResumir={alResumir}
              />
            </div>
          ))}
        </div>

        {/*
          ── CÓMO SE LEE EL MURO, A DOS COLUMNAS ─────────────────────────────
          🔴 LA LEYENDA ESTABA FUERA Y DESCRIBÍA COLORES SIN ENSEÑAR NINGUNO:
             flotaba suelta encima de la tarjeta diciendo «bloque de color» en
             tinta negra. Y la tarjeta era una losa de 1080 px con el texto a
             `max-w-prose`, o sea con **la mitad derecha vacía**.

             Las dos cosas se arreglan a la vez: la leyenda entra en la columna
             derecha —que es el hueco que ya había— y trae sus muestras de color
             al lado de la palabra, que es lo único que la convierte en leyenda.

          ⚠️ Las tres muestras van juntas en «bloque de color» a propósito, y no
             una por tono: la regla del muro es **bloque = pide algo**, y cuál de
             los tres tonos sea lo dice la PALABRA de cada baldosa, no la
             leyenda. Repartirlas aquí sugeriría que el profesor tiene que
             distinguir lima de coral para entender el muro — que es exactamente
             lo que este proyecto evita, porque una de cada doce personas no
             puede y esto se proyecta.
        */}
        {/*
          🔴 Y ES UNA `Tarjeta`, NO UNA `<section>` A MANO. Era la unica caja de
             esta pantalla sin capucha ni filete: un rectangulo blanco con un
             `<h2>` de 19 px suelto encima, o sea la misma decision que `Tarjeta`
             ya toma, tomada otra vez y sin el tono de la pantalla. Con la
             tarjeta hereda el cobalto del `<main>` y se ata al muro.

          ⚠️ El cuerpo de `Tarjeta` va A SANGRE -para que una `.rejilla` llegue
             al canto-, asi que este `div` pone su propio relleno. Es el defecto
             que ya ha aparecido en cinco paneles de este repositorio.
        */}
        <div className="mt-8">
          <Tarjeta titulo="Cómo leer este muro">
            <div className="grid gap-x-10 gap-y-7 px-5 pb-6 pt-5 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>
                  <strong>Rojo solo por un hecho</strong>: atasco confirmado por el firmware del RVR, o
                  batería por debajo de 6,5 V, y además con señal reciente. Nunca por un hueco.
                </li>
                <li>
                  <strong>«Sin señal de vida» no es una avería.</strong> Un robot cargando —RVR apagado
                  con la Raspberry Pi encendida— es el estado más común del laboratorio y se ve igual que
                  uno dormido.
                </li>
                <li>
                  <strong>La batería se lee en voltios.</strong> El porcentaje del firmware marcó 100 %
                  con la batería a 8,29 V, a 1,29 V del umbral de «baja».
                </li>
                <li>
                  Una baldosa se pone en «sin señal de vida» tras 5 s sin <code>/motor_status</code>.
                  Ese umbral es del muro y no se puede intercambiar con el de la ficha de un robot: son
                  dos topics de ritmos distintos.
                </li>
              </ul>

              {/*
                🔴 `self-start`, Y ESTO ES LO QUE ARREGLA EL FILETE. Un hijo de
                   rejilla se estira al alto de la fila por defecto, asi que el
                   borde izquierdo corria 310 px mientras su contenido acababa a
                   los 155: media linea vertical señalando el vacio. Con
                   `self-start` la caja mide lo que mide su contenido y el filete
                   acaba donde acaba lo que separa.
              */}
              <div className="self-start md:border-l md:border-border md:pl-8">
                <p className="microetiqueta">El idioma del muro</p>
                <dl className="mt-3 space-y-3 text-[12.5px] leading-snug text-muted-foreground">
                  <div>
                    <dt className="flex items-center gap-2 font-semibold text-foreground">
                      <span aria-hidden="true" className="flex gap-1">
                        <span className="block h-3 w-3 rounded-[3px] bg-bloque-ir" />
                        <span className="block h-3 w-3 rounded-[3px] bg-bloque-mirar" />
                        <span className="block h-3 w-3 rounded-[3px] bg-bloque-vivo" />
                      </span>
                      Bloque de color
                    </dt>
                    <dd className="mt-1">este robot pide algo, y su ficha dice qué</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 font-semibold text-foreground">
                      <span
                        aria-hidden="true"
                        className="block h-3 w-3 rounded-[3px] border border-border bg-card"
                      />
                      Vidrio
                    </dt>
                    <dd className="mt-1">sin novedad, o no se llega a él</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Tarjeta>
        </div>
      </main>
    </div>
  )
}
