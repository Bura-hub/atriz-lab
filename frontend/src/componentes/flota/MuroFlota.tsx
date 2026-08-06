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

import { useCallback, useMemo, useState } from 'react'
import { TOPICS_MURO, caudalDeFlota } from '@/lib/flota/presupuesto'
import { Baldosa } from '@/lib/flota/resumen'
import { OrdenMuro, ordenarBaldosas } from '@/lib/flota/orden'
import { ControlesMuro } from './ControlesMuro'
import { ROBOTS, TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { destinoDe } from '@/lib/interfaz/direcciones'
import { numero } from '@/lib/interfaz/formato'
import { AlResumir, BaldosaConectada } from './BaldosaConectada'
import { DondeBuscar, useDirecciones } from './DondeBuscar'

export function MuroFlota() {
  const porRobot = caudalDeFlota(TOPICS_MURO, 1)
  const total = caudalDeFlota(TOPICS_MURO, TOTAL_ROBOTS)
  const { direcciones, poner } = useDirecciones()
  const [proyeccion, setProyeccion] = useState(false)
  const [orden, setOrden] = useState<OrdenMuro>('NUMERO')

  /*
   * El estado de cada ficha, informado desde abajo. Solo se guarda la ATENCION:
   * es lo unico que el orden necesita, y guardar la baldosa entera obligaria a
   * re-renderizar el muro completo con cada mensaje de cada robot.
   */
  const [atenciones, setAtenciones] = useState<Record<number, Baldosa['atencion']>>({})
  const alResumir = useCallback<AlResumir>((id, atencion) => {
    setAtenciones((a) => (a[id] === atencion ? a : { ...a, [id]: atencion }))
  }, [])

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
        LA BARRA DE MÁQUINA. El grafito ocupa una región entera —no
        es un acento— y es lo que hace que esta pantalla se reconozca a tres
        metros aunque no se lea una palabra. La cifra de caudal va en la barra
        porque es la restricción que gobierna el diseño de este muro.
      */}
      <header className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-5 px-4 pb-7 pt-12 sm:px-6">
        <div>
          {/*
            A DOS LINEAS, como lo compuso Stitch. No es capricho: proyectado, un
            titular de una sola linea se come el ancho que necesitan las cifras
            de caudal, y partirlo deja la columna izquierda libre.

            🔴 EL DEGRADADO VA DE TINTA A GRIS, Y ANTES IBA AL REVES. Sus dos
               paradas eran literales -blanco puro arriba y un gris azulado fijo
               abajo-, o sea **luz que cae desde arriba**, que es el gesto
               correcto sobre un pozo negro. Al pasar el tema a papel **nada las
               toco**, porque un literal no sigue a ninguna variable, y el
               titular se volvio **invisible**: tinta blanca sobre papel blanco.

               El gesto NO se quita, se gira: tinta plena arriba aclarando hacia
               abajo. Es el mismo efecto optico con la polaridad que pide el
               fondo. Y el gris de destino no es inventado: `--estado-neutro` ya
               es el gris frio de la paleta, el equivalente en papel del que
               habia. Lo mas oscuro da 17,8:1 y lo mas claro 6,4:1 sobre el
               papel, asi que las dos puntas pasan AA hasta para texto normal.

            📝 Y lo vigila una prohibicion nueva de `estilo.ts` -«parada de
               degradado con color literal»-, sin exencion: `bg-clip-text` dice
               que ahi el degradado es tinta, no que esa tinta se lea.

            ⚠️ En proyeccion se apaga del todo y queda tinta plana: un proyector
               aplasta el rango bajo, asi que la mitad clara de cada letra se
               perderia justo en la pantalla que menos contraste puede regalar.
          */}
          <h1
            className={`font-semibold leading-[0.92] tracking-[-0.05em] ${
              proyeccion
                ? 'text-foreground'
                : 'bg-gradient-to-b from-[rgb(var(--foreground))] to-[rgb(var(--estado-neutro))] bg-clip-text text-transparent'
            }`}
            style={{ fontSize: 'clamp(2.5rem, 6.4vw, 4.875rem)' }}
          >
            Flota<br />Atriz
          </h1>
          <p className="mt-3.5 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
            {TOTAL_ROBOTS} Sphero RVR en el aula. Los que están en color piden algo; los de
            vidrio, no. Cada ficha abre su propio WebSocket y escucha solo{' '}
            <code className="font-mono text-foreground/80">{TOPICS_MURO.join(' + ')}</code>.
          </p>
        </div>

        {/*
          El presupuesto de red, en pastillas de vidrio. No es adorno: es el
          número que decide a qué topics puede suscribirse este muro.
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
        */}
        <dl className="grid grid-cols-2 gap-2.5">
          <div className="vidrio rounded-md px-[18px] py-[13px]">
            <dt className="microetiqueta">por robot</dt>
            <dd className="cifra-menor mt-1">
              {numero(porRobot, 2)}<span className="unidad">kB/s</span>
            </dd>
          </div>
          <div className="vidrio rounded-md px-[18px] py-[13px]">
            <dt className="microetiqueta">los {TOTAL_ROBOTS}</dt>
            <dd className="cifra-menor mt-1">
              {numero(total, 2)}<span className="unidad">kB/s</span>
            </dd>
          </div>
        </dl>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6">
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
        <section className="vidrio mt-8 rounded-ficha p-7">
          <h2
            className="font-semibold tracking-tight text-foreground"
            style={{ fontSize: '1.1875rem' }}
          >
            Cómo leer este muro
          </h2>
          <div className="mt-4 grid gap-x-10 gap-y-7 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
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

            <div className="md:border-l md:border-border md:pl-8">
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
        </section>
      </main>
    </div>
  )
}
